/* research.js — Researcher console: roster, rubric entry, drafting logs, export.
 *
 * Produces the study dataset in the same shape as the analysis database:
 * participants (per-component pre/post/gain + totals), interview_codes, and
 * drafting_logs. All data is de-identified (P-001…) and held in localStorage. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const RKEY = 'argumentor.research.v1';
  const COMP = ['claim', 'data', 'warrant', 'backing', 'qualifier', 'rebuttal'];
  const MAX = { claim: 15, data: 20, warrant: 15, backing: 15, qualifier: 15, rebuttal: 20 };

  let selectedId = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(RKEY)) || { participants: [], seq: 1 }; }
    catch (e) { return { participants: [], seq: 1 }; }
  }
  function save(s) { localStorage.setItem(RKEY, JSON.stringify(s)); }

  function pad(n) { return 'P-' + String(n).padStart(3, '0'); }

  function addParticipant(group) {
    const s = load();
    const p = { id: pad(s.seq), group, pre: {}, post: {}, interview: null };
    s.seq += 1;
    s.participants.push(p);
    save(s);
    return p;
  }

  function sumComp(obj) {
    return COMP.reduce((a, c) => a + (Number(obj[c]) || 0), 0);
  }
  function complete(obj) {
    return COMP.every(c => obj[c] !== undefined && obj[c] !== '' && obj[c] !== null);
  }

  // ---------- Roster ----------
  function renderRoster() {
    const s = load();
    const host = $('#roster');
    if (!s.participants.length) {
      host.innerHTML = '<p class="text-muted text-sm">No participants yet. Add one above.</p>';
      renderSummary();
      return;
    }
    let html = '<table class="data-table"><thead><tr><th>ID</th><th>Group</th><th>Pre</th>'
      + '<th>Post</th><th>Interview</th><th></th></tr></thead><tbody>';
    s.participants.forEach(p => {
      html += `<tr${p.id === selectedId ? ' class="sel"' : ''}>
        <td>${p.id}</td><td>${p.group}</td>
        <td>${complete(p.pre) ? '✓' : '—'}</td>
        <td>${complete(p.post) ? '✓' : '—'}</td>
        <td>${p.interview ? '✓' : '—'}</td>
        <td class="flex gap-8">
          <button class="btn btn-ghost btn-sm" data-act="sel" data-id="${p.id}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="del" data-id="${p.id}">×</button>
        </td></tr>`;
    });
    html += '</tbody></table>';
    host.innerHTML = html;
    host.querySelectorAll('[data-act="sel"]').forEach(b =>
      b.addEventListener('click', () => { selectedId = b.dataset.id; renderAll(); }));
    host.querySelectorAll('[data-act="del"]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('Delete ' + b.dataset.id + '?')) return;
        const st = load();
        st.participants = st.participants.filter(x => x.id !== b.dataset.id);
        save(st);
        if (selectedId === b.dataset.id) selectedId = null;
        renderAll();
      }));
    renderSummary();
  }

  // ---------- Rubric score editor ----------
  function renderScoreEditor() {
    const host = $('#scoreEditor');
    const p = load().participants.find(x => x.id === selectedId);
    if (!p) { host.innerHTML = '<p class="text-muted">No participant selected.</p>'; return; }
    const field = (phase, c) => `<input type="number" min="0" max="${MAX[c]}" step="0.01"
        data-phase="${phase}" data-comp="${c}" value="${p[phase][c] !== undefined ? p[phase][c] : ''}"
        aria-label="${phase} ${c}" />`;
    let rows = COMP.map(c => `<tr><td>${c[0].toUpperCase() + c.slice(1)} <span class="text-muted">/${MAX[c]}</span></td>
        <td>${field('pre', c)}</td><td>${field('post', c)}</td></tr>`).join('');
    host.innerHTML = `
      <p><strong>${p.id}</strong> · ${p.group}</p>
      <table class="data-table"><thead><tr><th>Component</th><th>Pre</th><th>Post</th></tr></thead>
      <tbody>${rows}
        <tr><td><strong>Total</strong></td><td><strong id="preTot">${sumComp(p.pre).toFixed(2)}</strong></td>
        <td><strong id="postTot">${sumComp(p.post).toFixed(2)}</strong></td></tr>
        <tr><td>Gain</td><td colspan="2" id="gainTot">${(sumComp(p.post) - sumComp(p.pre)).toFixed(2)}</td></tr>
      </tbody></table>
      <div class="flex gap-8 mt-12"><button class="btn btn-primary" id="saveScores">Save scores</button>
        <span id="scoreStatus" class="text-muted text-sm" role="status" aria-live="polite"></span></div>`;

    host.querySelectorAll('input[type="number"]').forEach(inp => {
      inp.addEventListener('input', () => {
        const draftPre = {}, draftPost = {};
        host.querySelectorAll('input[type="number"]').forEach(i => {
          (i.dataset.phase === 'pre' ? draftPre : draftPost)[i.dataset.comp] = i.value;
        });
        $('#preTot').textContent = sumComp(draftPre).toFixed(2);
        $('#postTot').textContent = sumComp(draftPost).toFixed(2);
        $('#gainTot').textContent = (sumComp(draftPost) - sumComp(draftPre)).toFixed(2);
      });
    });
    $('#saveScores').addEventListener('click', () => {
      const s = load();
      const t = s.participants.find(x => x.id === selectedId);
      host.querySelectorAll('input[type="number"]').forEach(i => {
        const v = i.value === '' ? '' : Number(i.value);
        t[i.dataset.phase][i.dataset.comp] = v;
      });
      save(s);
      $('#scoreStatus').textContent = 'Saved.';
      renderRoster();
    });
  }

  // ---------- Interview coding ----------
  function renderInterviewEditor() {
    const host = $('#interviewEditor');
    const p = load().participants.find(x => x.id === selectedId);
    if (!p) { host.innerHTML = '<p class="text-muted">No participant selected.</p>'; return; }
    const iv = p.interview || {};
    const dims = [['usefulness', 'Usefulness'], ['usability', 'Usability'],
      ['learning', 'Learning experience'], ['ethical', 'Ethical acceptability']];
    host.innerHTML = `
      <p><strong>${p.id}</strong> · ${p.group}</p>
      <label class="field" style="max-width:220px"><span>Performance band</span>
        <select id="ivBand">
          <option value="">— not interviewed —</option>
          <option ${iv.band === 'High' ? 'selected' : ''}>High</option>
          <option ${iv.band === 'Medium' ? 'selected' : ''}>Medium</option>
          <option ${iv.band === 'Low' ? 'selected' : ''}>Low</option>
        </select></label>
      <div class="likert" style="margin-top:10px">
        ${dims.map(([k, l]) => `<label class="likert-opt"><input type="checkbox" data-dim="${k}"
          ${iv[k] ? 'checked' : ''} /> <span>${l}</span></label>`).join('')}
      </div>
      <div class="flex gap-8 mt-12"><button class="btn btn-primary" id="saveIv">Save interview code</button>
        <button class="btn btn-ghost" id="clearIv">Clear</button>
        <span id="ivStatus" class="text-muted text-sm" role="status" aria-live="polite"></span></div>`;
    $('#saveIv').addEventListener('click', () => {
      const s = load();
      const t = s.participants.find(x => x.id === selectedId);
      const band = $('#ivBand').value;
      if (!band) { t.interview = null; }
      else {
        t.interview = { band };
        host.querySelectorAll('input[data-dim]').forEach(c => { t.interview[c.dataset.dim] = c.checked ? 1 : 0; });
      }
      save(s);
      $('#ivStatus').textContent = 'Saved.';
      renderRoster();
    });
    $('#clearIv').addEventListener('click', () => {
      const s = load();
      s.participants.find(x => x.id === selectedId).interview = null;
      save(s);
      renderAll();
    });
  }

  // ---------- Summary ----------
  function groupMean(parts, phase) {
    const done = parts.filter(p => complete(p[phase]));
    if (!done.length) return '—';
    return (done.reduce((a, p) => a + sumComp(p[phase]), 0) / done.length).toFixed(2);
  }
  function renderSummary() {
    const s = load();
    const host = $('#collectSummary');
    const by = g => s.participants.filter(p => p.group === g);
    const exp = by('Experimental'), ctrl = by('Control');
    const iv = s.participants.filter(p => p.interview).length;
    const bothDone = s.participants.filter(p => complete(p.pre) && complete(p.post)).length;
    host.innerHTML = `<table class="data-table"><thead><tr><th>Group</th><th>n</th>
      <th>Pre mean</th><th>Post mean</th></tr></thead><tbody>
      <tr><td>Experimental</td><td>${exp.length}</td><td>${groupMean(exp, 'pre')}</td><td>${groupMean(exp, 'post')}</td></tr>
      <tr><td>Control</td><td>${ctrl.length}</td><td>${groupMean(ctrl, 'pre')}</td><td>${groupMean(ctrl, 'post')}</td></tr>
      </tbody></table>
      <p class="text-muted text-sm mt-12">${s.participants.length} participants · ${bothDone} with complete pre+post · ${iv} interviews coded.</p>`;
  }

  // ---------- Export ----------
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function csv(rows) {
    return rows.map(r => r.map(v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
  }

  function participantsRows() {
    const head = ['participant_id', 'group_name', 'group_code', 'pre_total', 'post_total', 'gain_total'];
    COMP.forEach(c => head.push('pre_' + c, 'post_' + c, 'gain_' + c));
    head.push('pre_component_sum', 'post_component_sum');
    const rows = [head];
    load().participants.forEach(p => {
      const preT = sumComp(p.pre), postT = sumComp(p.post);
      const r = [p.id, p.group, p.group === 'Experimental' ? 1 : 0,
        preT.toFixed(4), postT.toFixed(4), (postT - preT).toFixed(4)];
      COMP.forEach(c => {
        const a = Number(p.pre[c]) || 0, b = Number(p.post[c]) || 0;
        r.push(a, b, (b - a).toFixed(4));
      });
      r.push(preT.toFixed(4), postT.toFixed(4));
      rows.push(r);
    });
    return rows;
  }

  function interviewRows() {
    const rows = [['interview_id', 'participant_id', 'performance_band',
      'usefulness_positive', 'usability_positive', 'learning_experience_positive',
      'ethical_acceptability_positive']];
    let n = 0;
    load().participants.forEach(p => {
      if (!p.interview) return;
      n += 1;
      rows.push(['INT-' + String(n).padStart(2, '0'), p.id, p.interview.band,
        p.interview.usefulness || 0, p.interview.usability || 0,
        p.interview.learning || 0, p.interview.ethical || 0]);
    });
    return rows;
  }

  function draftingRows() {
    const rows = [['draft_id', 'student', 'topic', 'version', 'submitted', 'created_at',
      'updated_at', 'word_count', 'score_overall'].concat(COMP.map(c => 'engine_' + c))];
    AM.Storage.getDrafts().forEach(d => {
      const r = ArguMentorEngine.analyse(d.content || '');
      rows.push([d.id, d.studentName || '', (d.topicTitle || '').slice(0, 60), d.version || 1,
        d.submitted ? 1 : 0, new Date(d.createdAt).toISOString(), new Date(d.updatedAt).toISOString(),
        r.wordCount, r.scores.overall].concat(COMP.map(c => r.scores.sub[c])));
    });
    return rows;
  }

  $('#addParticipant').addEventListener('click', () => { addParticipant($('#newGroup').value); renderAll(); });
  $('#seedRoster').addEventListener('click', () => {
    if (!confirm('Add 37 Experimental + 37 Control blank participants?')) return;
    for (let i = 0; i < 37; i++) addParticipant('Experimental');
    for (let i = 0; i < 37; i++) addParticipant('Control');
    renderAll();
  });
  $('#expParticipants').addEventListener('click', () => download('participants.csv', csv(participantsRows())));
  $('#expInterviews').addEventListener('click', () => download('interview_codes.csv', csv(interviewRows())));
  $('#expDrafts').addEventListener('click', () => download('drafting_logs.csv', csv(draftingRows())));
  $('#expJson').addEventListener('click', () => download('argumentor_dataset.json',
    JSON.stringify({ exportedAt: new Date().toISOString(), research: load(),
      drafting_logs: draftingRows() }, null, 2), 'application/json'));

  function renderAll() { renderRoster(); renderScoreEditor(); renderInterviewEditor(); }
  renderAll();
})();
