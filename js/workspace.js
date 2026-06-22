/* workspace.js — orchestrates the three-pane writing workspace. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const editor = $('#editor');
  const wcEl = $('#wcVal');
  const rtEl = $('#rtVal');
  const scoreEl = $('#scoreVal');
  const saveStateEl = $('#saveState');
  const titleEl = $('#essayTitle');

  let state = {
    draftId: null,
    topicId: null,
    topicTitle: null,
    topics: [],
    samples: null,
    saveTimer: null,
    analyseTimer: null
  };

  // ---------- Tabs ----------
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.parentElement;
      const tab = btn.dataset.tab;
      group.querySelectorAll('.tab-btn').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
      });
      const root = group.parentElement;
      root.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
    });
  });

  // ---------- Load topics ----------
  fetch('data/prompts.json')
    .then(r => r.json())
    .then(data => {
      state.topics = data.topics;
      state.samples = data.sample_essay;
      renderTopics();
      renderScaffold(null);
      const params = new URLSearchParams(location.search);
      const draftParam = params.get('draft');
      if (draftParam) {
        loadDraft(draftParam);
      } else {
        // start with first topic selected for instant feedback demo
        chooseTopic(state.topics[0]);
      }
      renderDrafts();
    })
    .catch(() => {
      // Fallback so the page is still usable if fetch fails (e.g., file://).
      state.topics = [{
        id: 'fallback',
        title: 'Should AI writing tools be allowed in secondary school English classrooms?',
        context: 'Default fallback topic.',
        wordTarget: 350
      }];
      renderTopics();
      renderScaffold(null);
      chooseTopic(state.topics[0]);
    });

  function renderTopics() {
    const list = $('#topicList');
    list.innerHTML = '';
    state.topics.forEach(t => {
      const el = document.createElement('div');
      el.className = 'topic-card' + (t.id === state.topicId ? ' active' : '');
      el.innerHTML = `
        <h4>${escapeHtml(t.title)}</h4>
        <p>${escapeHtml(t.context)}</p>
        <p class="text-muted" style="margin-top:6px">Target: ${t.wordTarget} words · ${t.level || 'Grade 11'}</p>
      `;
      el.addEventListener('click', () => chooseTopic(t));
      list.appendChild(el);
    });
  }

  function chooseTopic(t) {
    state.topicId = t.id;
    state.topicTitle = t.title;
    titleEl.textContent = t.title;
    renderTopics();
  }

  // ---------- Drafts ----------
  function renderDrafts() {
    const wrap = $('#draftList');
    const drafts = AM.Storage.getDrafts().sort((a, b) => b.updatedAt - a.updatedAt);
    if (drafts.length === 0) {
      wrap.innerHTML = '<p class="text-muted text-sm">No drafts yet.</p>';
      return;
    }
    wrap.innerHTML = '';
    drafts.forEach(d => {
      const div = document.createElement('div');
      div.className = 'draft-list-row';
      div.innerHTML = `
        <div>
          <div style="font-weight:600">${escapeHtml((d.topicTitle || '').slice(0, 48))}${(d.topicTitle || '').length > 48 ? '…' : ''}</div>
          <div class="meta">${AM.fmtDate(d.updatedAt)} · v${d.version || 1} · ${ArguMentorEngine.wordCount(d.content)} words${d.submitted ? ' · submitted' : ''}</div>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-ghost btn-sm" data-act="open">Open</button>
          <button class="btn btn-ghost btn-sm" data-act="del">×</button>
        </div>
      `;
      div.querySelector('[data-act="open"]').addEventListener('click', () => loadDraft(d.id));
      div.querySelector('[data-act="del"]').addEventListener('click', () => {
        if (confirm('Delete this draft?')) {
          AM.Storage.deleteDraft(d.id);
          if (state.draftId === d.id) newDraft();
          renderDrafts();
        }
      });
      wrap.appendChild(div);
    });
  }

  function loadDraft(id) {
    const d = AM.Storage.getDraft(id);
    if (!d) return;
    state.draftId = id;
    state.topicId = d.topicId;
    state.topicTitle = d.topicTitle;
    titleEl.textContent = d.topicTitle || 'Untitled';
    editor.value = d.content || '';
    runAnalysis();
    setSaveState('saved');
    renderDrafts();
  }

  function newDraft() {
    state.draftId = null;
    editor.value = '';
    chooseTopic(state.topics[0]);
    runAnalysis();
    setSaveState('unsaved');
    editor.focus();
  }

  $('#newDraftBtn').addEventListener('click', newDraft);

  $('#saveBtn').addEventListener('click', () => saveNow(false));
  $('#submitBtn').addEventListener('click', () => {
    if (!editor.value.trim()) {
      AM.toast('Nothing to submit yet.');
      return;
    }
    const draft = saveNow(true);
    AM.toast('Submitted to your teacher for review.');
    openReflection(draft);
  });

  function saveNow(submit) {
    const text = editor.value;
    const now = Date.now();
    let draft;
    if (state.draftId) {
      draft = AM.Storage.getDraft(state.draftId) || {};
      draft.content = text;
      draft.topicId = state.topicId;
      draft.topicTitle = state.topicTitle;
      draft.updatedAt = now;
      if (submit) {
        draft.submitted = true;
        draft.version = (draft.version || 1) + 1;
        // Process-writing theory: keep each submitted revision rather than
        // overwriting, so progress is visible and diffable later.
        draft.revisions = (draft.revisions || []).concat([{ version: draft.version, content: text, at: now }]);
      }
    } else {
      draft = {
        id: AM.uid(),
        studentName: AM.Storage.getProfile().name || 'Student',
        topicId: state.topicId,
        topicTitle: state.topicTitle,
        content: text,
        createdAt: now,
        updatedAt: now,
        version: 1,
        submitted: !!submit,
        revisions: submit ? [{ version: 1, content: text, at: now }] : []
      };
      state.draftId = draft.id;
    }
    AM.Storage.saveDraft(draft);
    setSaveState('saved');
    renderDrafts();
    return draft;
  }

  function setSaveState(s) {
    saveStateEl.textContent = s === 'saved' ? 'saved' : (s === 'saving' ? 'saving…' : 'unsaved');
    saveStateEl.style.color = s === 'saved' ? 'var(--success)' : 'var(--text-muted)';
  }

  // ---------- Live analysis ----------
  editor.addEventListener('input', () => {
    setSaveState('unsaved');
    clearTimeout(state.analyseTimer);
    state.analyseTimer = setTimeout(runAnalysis, 250);
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      if (editor.value.trim().length > 0) saveNow(false);
    }, 1500);
  });

  let lastComponents = null;
  function runAnalysis() {
    const text = editor.value;
    const r = ArguMentorEngine.analyse(text);
    lastComponents = r.components;
    wcEl.textContent = r.wordCount;
    rtEl.textContent = r.readingTime;
    scoreEl.textContent = text.trim() ? r.scores.overall : '—';
    renderScaffold(r.components);
    renderFeedback(r);
    renderScores(r);
    if (!highlightView.hidden) renderHighlightView();
  }

  // ---------- Components view (read-only highlighted preview) ----------
  const viewToggle = $('#viewToggle');
  const highlightView = $('#highlightView');
  viewToggle.addEventListener('click', () => {
    const show = highlightView.hidden;
    highlightView.hidden = !show;
    editor.hidden = show;
    viewToggle.setAttribute('aria-pressed', String(show));
    viewToggle.textContent = show ? 'Edit text' : 'Show components';
    if (show) renderHighlightView();
  });

  function renderHighlightView() {
    highlightView.innerHTML = annotate(editor.value, lastComponents) + componentLegend();
  }

  // Wrap each detected component's matched span in a coloured marker.
  function annotate(text, components) {
    if (!text.trim()) return '<p class="text-muted">Nothing to show yet — start writing.</p>';
    const priority = ['rebuttal', 'qualifier', 'backing', 'warrant', 'data', 'claim'];
    const ranges = [];
    Object.keys(components || {}).forEach(comp => {
      components[comp].forEach(h => ranges.push({ start: h.index, end: h.index + h.length, comp }));
    });
    ranges.sort((a, b) => a.start - b.start || (priority.indexOf(a.comp) - priority.indexOf(b.comp)));
    const clean = [];
    let lastEnd = -1;
    ranges.forEach(r => { if (r.start >= lastEnd) { clean.push(r); lastEnd = r.end; } });
    let out = '', cursor = 0;
    clean.forEach(r => {
      out += escapeHtml(text.slice(cursor, r.start));
      out += `<span data-comp="${r.comp}" title="${r.comp}">${escapeHtml(text.slice(r.start, r.end))}</span>`;
      cursor = r.end;
    });
    out += escapeHtml(text.slice(cursor));
    return out.replace(/\n/g, '<br>');
  }

  function componentLegend() {
    const items = [['claim', 'Claim'], ['data', 'Data'], ['warrant', 'Warrant'], ['backing', 'Backing'], ['qualifier', 'Qualifier'], ['rebuttal', 'Rebuttal']];
    return '<div class="legend-row">' + items.map(([k, l]) => `<span class="tag tag-${k}">${l}</span>`).join('') + '</div>';
  }

  // ---------- Optional AI review (on demand) ----------
  const aiBtn = $('#aiReviewBtn');
  const aiFeedback = $('#aiFeedback');
  const aiPill = $('#aiPill');
  refreshAiPill();
  function refreshAiPill() {
    const on = window.ArguMentorLLM && ArguMentorLLM.isConfigured();
    aiPill.textContent = on ? 'on' : 'optional';
    aiPill.classList.toggle('pill-on', !!on);
  }

  aiBtn.addEventListener('click', async () => {
    if (!window.ArguMentorLLM || !ArguMentorLLM.isConfigured()) {
      aiFeedback.innerHTML = '<div class="feedback-empty">AI review is optional. Add your own model key in <a href="settings.html">Settings</a> to enable it. The rule-based feedback below always works.</div>';
      return;
    }
    const text = editor.value.trim();
    if (!text) { aiFeedback.innerHTML = '<div class="feedback-empty">Write something first.</div>'; return; }
    aiBtn.disabled = true;
    aiFeedback.innerHTML = '<div class="feedback-empty">Asking your model…</div>';
    try {
      const res = await ArguMentorLLM.analyseEssay(text, state.topicTitle);
      renderAiFeedback(res);
    } catch (e) {
      aiFeedback.innerHTML = '<div class="feedback-item style"><div class="label">AI unavailable — using rule-based feedback</div>' + escapeHtml(e.message || String(e)) + '</div>';
    } finally {
      aiBtn.disabled = false;
    }
  });

  function renderAiFeedback(res) {
    const labels = { claim: 'Claim', data: 'Data', warrant: 'Warrant', backing: 'Backing', qualifier: 'Qualifier', rebuttal: 'Rebuttal' };
    let html = '';
    if (res.overall && res.overall.comment) {
      html += `<div class="feedback-item argument"><div class="label">Overall</div>${escapeHtml(res.overall.comment)}</div>`;
    }
    Object.keys(labels).forEach(k => {
      const c = res.components && res.components[k];
      if (c && c.feedback) {
        html += `<div class="feedback-item ${c.present ? 'argument' : 'style'}"><div class="label">${labels[k]} ${c.present ? '✓' : '○'}</div>${escapeHtml(c.feedback)}</div>`;
      }
    });
    if (res.overall && res.overall.next_steps && res.overall.next_steps.length) {
      html += '<div class="feedback-item"><div class="label">Next steps</div><ul style="margin:6px 0 0 16px">' +
        res.overall.next_steps.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ul></div>';
    }
    html += '<p class="text-muted text-sm mt-12">AI feedback is a suggestion from your chosen model — judge it critically, like any source.</p>';
    aiFeedback.innerHTML = html || '<div class="feedback-empty">No AI feedback returned.</div>';
  }

  // ---------- Post-submit self-assessment (process reflection) ----------
  function openReflection(draft) {
    const comps = [['claim', 'Claim'], ['data', 'Data'], ['warrant', 'Warrant'], ['backing', 'Backing'], ['qualifier', 'Qualifier'], ['rebuttal', 'Rebuttal']];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reflTitle">
        <h3 id="reflTitle" style="margin-top:0">Quick reflection</h3>
        <p class="text-muted text-sm">Before you see the feedback, how confident are you about each part of your argument? This is just for you.</p>
        <div id="reflBody">
          ${comps.map(([k, l]) => `
            <div class="refl-row">
              <span class="tag tag-${k}">${l}</span>
              <input type="range" min="1" max="5" value="3" name="refl-${k}" aria-label="${l} confidence (1 low to 5 high)" />
            </div>`).join('')}
        </div>
        <div class="flex gap-8 mt-12" style="justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" id="reflSkip">Skip</button>
          <button class="btn btn-primary btn-sm" id="reflSave">Save reflection</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#reflSkip').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#reflSave').addEventListener('click', () => {
      const out = { draftId: draft.id, version: draft.version, at: Date.now(), ratings: {} };
      comps.forEach(([k]) => {
        const el = overlay.querySelector(`[name="refl-${k}"]`);
        out.ratings[k] = Number(el.value);
      });
      let all = [];
      try { all = JSON.parse(localStorage.getItem('argumentor.reflections.v1')) || []; } catch (e) { all = []; }
      all.push(out);
      localStorage.setItem('argumentor.reflections.v1', JSON.stringify(all));
      AM.toast('Reflection saved.');
      close();
    });
  }

  // ---------- Toulmin scaffold ----------
  const COMPONENTS = [
    { key: 'claim',     label: 'Claim',     desc: 'The position you are defending.', example: 'I argue that AI writing tools should be permitted only with explicit teacher guidance.' },
    { key: 'data',      label: 'Data / Grounds', desc: 'Evidence supporting the claim.', example: 'Lam, Hew and Chiu (2018) found a blended approach improved HK students\' argumentative writing.' },
    { key: 'warrant',   label: 'Warrant',   desc: 'The reasoning that links data to claim.', example: 'This shows that pedagogy, not access, drives the gain.' },
    { key: 'backing',   label: 'Backing',   desc: 'Broader support for the warrant.', example: 'Marzuki et al. (2023) replicated the finding across Indonesian classrooms.' },
    { key: 'qualifier', label: 'Qualifier', desc: 'How strongly the claim is stated.', example: 'In most cases, when paired with guided instruction…' },
    { key: 'rebuttal',  label: 'Rebuttal',  desc: 'A counter-argument and your response.', example: 'Critics argue AI erodes critical thinking; however, this conflates the tool with its use.' }
  ];

  function renderScaffold(components) {
    const wrap = $('#scaffoldList');
    wrap.innerHTML = '';
    COMPONENTS.forEach(c => {
      const detected = components && components[c.key] && components[c.key].length > 0;
      const div = document.createElement('div');
      div.className = 'toulmin-step' + (detected ? ' detected' : '');
      div.innerHTML = `
        <div class="toulmin-step-header">
          <div class="flex gap-8" style="align-items:center">
            <span class="tag tag-${c.key}">${c.label}</span>
          </div>
          <span class="check">${detected ? '✓ found' : '○ missing'}</span>
        </div>
        <div class="toulmin-step-body">
          ${escapeHtml(c.desc)}
          <div class="example-box">${escapeHtml(c.example)}</div>
        </div>
      `;
      wrap.appendChild(div);
    });
  }

  // ---------- Feedback panel ----------
  function renderFeedback(r) {
    const tipsEl = $('#argTips');
    tipsEl.innerHTML = '';
    if (r.argumentTips.length === 0 && r.wordCount > 0) {
      tipsEl.innerHTML = '<div class="feedback-empty">All six Toulmin components detected. Now refine the wording.</div>';
    } else if (r.argumentTips.length === 0) {
      tipsEl.innerHTML = '<div class="feedback-empty">Start typing to receive feedback.</div>';
    } else {
      r.argumentTips.forEach(t => {
        const div = document.createElement('div');
        div.className = 'feedback-item argument';
        div.innerHTML = `<div class="label">${escapeHtml(t.label)}</div>${escapeHtml(t.message)}`;
        tipsEl.appendChild(div);
      });
    }

    const grEl = $('#grammarList');
    grEl.innerHTML = '';
    if (r.grammarIssues.length === 0) {
      grEl.innerHTML = r.wordCount === 0
        ? '<div class="feedback-empty">No issues yet — start typing.</div>'
        : '<div class="feedback-empty">No grammar or style issues detected. Nice work.</div>';
    } else {
      r.grammarIssues.forEach(i => {
        const div = document.createElement('div');
        div.className = 'feedback-item ' + i.type;
        div.innerHTML = `
          <div class="label">${escapeHtml(i.label)}</div>
          <div>${escapeHtml(i.message)}</div>
          <div style="margin-top:6px"><span class="quote">${escapeHtml(i.quote)}</span></div>
        `;
        grEl.appendChild(div);
      });
    }
  }

  // ---------- Scores panel ----------
  function renderScores(r) {
    const wrap = $('#scoreList');
    const items = [
      { label: 'Overall', value: r.scores.overall, weight: 'composite' },
      { label: 'Claim',     value: r.scores.sub.claim },
      { label: 'Data',      value: r.scores.sub.data },
      { label: 'Warrant',   value: r.scores.sub.warrant },
      { label: 'Backing',   value: r.scores.sub.backing },
      { label: 'Qualifier', value: r.scores.sub.qualifier },
      { label: 'Rebuttal',  value: r.scores.sub.rebuttal },
      { label: 'Organisation', value: r.scores.organization },
      { label: 'Language',  value: r.scores.language }
    ];
    wrap.innerHTML = items.map(it => `
      <div class="score-row">
        <div class="score-row-head"><span>${it.label}</span><span>${it.value}</span></div>
        <div class="score-bar"><div class="score-bar-fill" style="width:${it.value}%"></div></div>
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  }
})();
