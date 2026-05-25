/* teacher.js — submission queue + hybrid feedback editor for teachers. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  let selectedId = null;

  function refresh() {
    const all = AM.Storage.getDrafts();
    const submitted = all.filter(d => d.submitted).sort((a, b) => b.updatedAt - a.updatedAt);
    const list = $('#studentList');
    list.innerHTML = '';
    if (submitted.length === 0) {
      list.innerHTML = '<p class="text-muted text-sm">No submissions yet.</p>';
      return;
    }
    const notes = AM.Storage.getTeacherNotes();
    submitted.forEach(d => {
      const reviewed = !!notes[d.id];
      const div = document.createElement('div');
      div.className = 'student-row';
      if (d.id === selectedId) div.style.borderColor = 'var(--primary)';
      div.innerHTML = `
        <div class="info">
          <h4>${escapeHtml(d.studentName || 'Student')}</h4>
          <p>${escapeHtml((d.topicTitle || 'Untitled').slice(0, 50))}…</p>
          <p>${AM.fmtDate(d.updatedAt)} · v${d.version || 1}</p>
        </div>
        ${reviewed ? '<span class="tag tag-data">reviewed</span>' : '<span class="badge">pending</span>'}
      `;
      div.addEventListener('click', () => openDraft(d.id));
      list.appendChild(div);
    });
  }

  function openDraft(id) {
    selectedId = id;
    const draft = AM.Storage.getDraft(id);
    if (!draft) return;
    const r = ArguMentorEngine.analyse(draft.content);
    const notes = AM.Storage.getTeacherNotes();
    const existingNote = notes[id] || '';

    const area = $('#reviewArea');
    area.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <div class="flex-between" style="margin-bottom:6px">
          <h3 style="margin:0">${escapeHtml(draft.studentName || 'Student')} · v${draft.version || 1}</h3>
          <span class="text-muted text-sm">${AM.fmtDate(draft.updatedAt)}</span>
        </div>
        <p style="margin:0; color:var(--text-muted)">${escapeHtml(draft.topicTitle || '')}</p>
      </div>

      <div class="card" style="margin-bottom:18px">
        <h3 style="margin-top:0">Student draft</h3>
        <div class="sample-essay" id="essayBody"></div>
      </div>

      <div class="dashboard-grid" style="margin-bottom:18px">
        <div class="card">
          <h3 style="margin-top:0">AI scores</h3>
          <div id="aiScores"></div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">AI feedback summary</h3>
          <div id="aiSummary"></div>
        </div>
      </div>

      <div class="card review-form">
        <h3 style="margin-top:0">Your review</h3>
        <p class="text-muted text-sm" style="margin-top:0">This is what the student sees on their dashboard.</p>
        <textarea id="teacherNote" placeholder="Strengths, areas to revise, and a specific next step…">${escapeHtml(existingNote)}</textarea>
        <div class="flex gap-8 mt-12">
          <button class="btn btn-primary" id="saveNote">Save review</button>
          <button class="btn btn-ghost" id="clearNote">Clear</button>
        </div>
      </div>
    `;

    // Render essay with annotated component highlighting
    renderAnnotated($('#essayBody'), draft.content, r.components);

    // Scores
    const ss = r.scores;
    $('#aiScores').innerHTML = [
      ['Overall', ss.overall],
      ['Claim', ss.sub.claim], ['Data', ss.sub.data],
      ['Warrant', ss.sub.warrant], ['Backing', ss.sub.backing],
      ['Qualifier', ss.sub.qualifier], ['Rebuttal', ss.sub.rebuttal],
      ['Organisation', ss.organization], ['Language', ss.language]
    ].map(([l, v]) => `
      <div class="score-row">
        <div class="score-row-head"><span>${l}</span><span>${v}</span></div>
        <div class="score-bar"><div class="score-bar-fill" style="width:${v}%"></div></div>
      </div>
    `).join('');

    // Summary
    let html = '';
    if (r.argumentTips.length) {
      html += '<h4 style="margin:0 0 8px">Argument issues</h4>';
      r.argumentTips.forEach(t => {
        html += `<div class="feedback-item argument"><div class="label">${escapeHtml(t.label)}</div>${escapeHtml(t.message)}</div>`;
      });
    } else {
      html += '<p class="text-muted">No argument-structure issues detected.</p>';
    }
    if (r.grammarIssues.length) {
      html += '<h4 style="margin:14px 0 8px">Grammar / style</h4>';
      r.grammarIssues.slice(0, 6).forEach(i => {
        html += `<div class="feedback-item ${i.type}"><div class="label">${escapeHtml(i.label)}</div>${escapeHtml(i.message)}</div>`;
      });
      if (r.grammarIssues.length > 6) {
        html += `<p class="text-muted text-sm">…and ${r.grammarIssues.length - 6} more.</p>`;
      }
    }
    $('#aiSummary').innerHTML = html;

    $('#saveNote').addEventListener('click', () => {
      const v = $('#teacherNote').value.trim();
      AM.Storage.saveTeacherNote(id, v);
      AM.toast('Review saved.');
      refresh();
    });
    $('#clearNote').addEventListener('click', () => {
      $('#teacherNote').value = '';
    });

    refresh();
  }

  // ---------- Annotated rendering ----------
  // For each detected component, wrap its matched span in a coloured marker.
  function renderAnnotated(host, text, components) {
    // Build a flat list of {start, end, comp} ranges, merge overlaps by priority.
    const priority = ['rebuttal', 'qualifier', 'backing', 'warrant', 'data', 'claim'];
    const ranges = [];
    Object.keys(components || {}).forEach(comp => {
      components[comp].forEach(h => {
        ranges.push({ start: h.index, end: h.index + h.length, comp });
      });
    });
    ranges.sort((a, b) => a.start - b.start || (priority.indexOf(a.comp) - priority.indexOf(b.comp)));

    // Strip overlaps
    const clean = [];
    let lastEnd = -1;
    ranges.forEach(r => {
      if (r.start >= lastEnd) { clean.push(r); lastEnd = r.end; }
    });

    let out = '';
    let cursor = 0;
    clean.forEach(r => {
      out += escapeHtml(text.slice(cursor, r.start));
      out += `<span data-comp="${r.comp}">${escapeHtml(text.slice(r.start, r.end))}</span>`;
      cursor = r.end;
    });
    out += escapeHtml(text.slice(cursor));

    host.innerHTML = out.replace(/\n/g, '<br>') + buildLegend();
  }

  function buildLegend() {
    const items = [
      ['claim', 'Claim'], ['data', 'Data'], ['warrant', 'Warrant'],
      ['backing', 'Backing'], ['qualifier', 'Qualifier'], ['rebuttal', 'Rebuttal']
    ];
    return '<div style="margin-top:14px; padding-top:12px; border-top:1px dashed var(--border); font-size:12px; display:flex; flex-wrap:wrap; gap:8px">'
      + items.map(([k, l]) => `<span class="tag tag-${k}">${l}</span>`).join('')
      + '</div>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  }

  refresh();
})();
