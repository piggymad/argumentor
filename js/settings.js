/* settings.js — AI key configuration, data export/reset, acceptance survey. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);

  // ---------- Optional LLM config ----------
  const providerEl = $('#provider');
  const modelEl = $('#model');
  const keyEl = $('#apiKey');
  const baseUrlEl = $('#baseUrl');
  const baseUrlField = $('#baseUrlField');
  const aiStatus = $('#aiStatus');

  function modelPlaceholder(provider) {
    return provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001';
  }

  function syncProviderUI() {
    const isOpenAI = providerEl.value === 'openai';
    baseUrlField.hidden = !isOpenAI;
    modelEl.placeholder = modelPlaceholder(providerEl.value);
  }

  function loadConfig() {
    const cfg = ArguMentorLLM.getConfig();
    providerEl.value = cfg.provider || 'anthropic';
    modelEl.value = cfg.model && cfg.model !== ArguMentorLLM.DEFAULTS.model ? cfg.model : (cfg.model || '');
    keyEl.value = cfg.apiKey || '';
    baseUrlEl.value = cfg.baseUrl || '';
    syncProviderUI();
    aiStatus.textContent = ArguMentorLLM.isConfigured()
      ? 'AI feedback is ON (key saved in this browser).'
      : 'AI feedback is OFF — using the offline rule-based engine.';
  }

  providerEl.addEventListener('change', syncProviderUI);

  $('#saveAi').addEventListener('click', () => {
    ArguMentorLLM.saveConfig({
      provider: providerEl.value,
      model: modelEl.value.trim() || modelPlaceholder(providerEl.value),
      apiKey: keyEl.value.trim(),
      baseUrl: baseUrlEl.value.trim()
    });
    AM.toast('AI settings saved.');
    loadConfig();
  });

  $('#clearAi').addEventListener('click', () => {
    ArguMentorLLM.clear();
    keyEl.value = '';
    AM.toast('Key removed. Back to the offline engine.');
    loadConfig();
  });

  $('#testAi').addEventListener('click', async () => {
    const key = keyEl.value.trim();
    if (!key) { aiStatus.textContent = 'Enter and save a key first.'; return; }
    // Save the current form so the test uses what the user sees.
    ArguMentorLLM.saveConfig({
      provider: providerEl.value,
      model: modelEl.value.trim() || modelPlaceholder(providerEl.value),
      apiKey: key,
      baseUrl: baseUrlEl.value.trim()
    });
    aiStatus.textContent = 'Testing…';
    const result = await ArguMentorLLM.testConnection();
    aiStatus.textContent = (result.ok ? '✓ ' : '✗ ') + result.message;
  });

  // ---------- Data export / reset ----------
  const APP_KEYS = [
    'argumentor.drafts.v1',
    'argumentor.profile.v1',
    'argumentor.teacher.v1',
    'argumentor.survey.v1',
    'argumentor.reflections.v1'
  ];

  $('#exportData').addEventListener('click', () => {
    const bundle = { exportedAt: new Date().toISOString(), app: 'ArguMentor', data: {} };
    APP_KEYS.forEach(k => {
      const raw = localStorage.getItem(k);
      if (raw) { try { bundle.data[k] = JSON.parse(raw); } catch (e) { bundle.data[k] = raw; } }
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'argumentor-data-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    $('#dataStatus').textContent = 'Exported.';
  });

  $('#resetData').addEventListener('click', () => {
    if (!confirm('Clear all drafts, scores, teacher notes and survey answers from this browser? This cannot be undone.')) return;
    APP_KEYS.forEach(k => localStorage.removeItem(k));
    $('#dataStatus').textContent = 'All learning data cleared. Reload to re-seed the demo.';
    AM.toast('Data cleared.');
  });

  // ---------- Acceptance survey (RQ2 / AT-EAI aligned) ----------
  const SURVEY_KEY = 'argumentor.survey.v1';
  const ITEMS = [
    { id: 'usefulness', label: 'Usefulness', q: 'ArguMentor helps me write a stronger argument.' },
    { id: 'usability', label: 'Usability', q: 'ArguMentor is easy to use.' },
    { id: 'learning', label: 'Learning experience', q: 'Using ArguMentor helps me learn how arguments work.' },
    { id: 'ethical', label: 'Ethical acceptability', q: 'I am comfortable that ArguMentor supports my thinking rather than replacing it.' }
  ];
  const SCALE = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  function renderSurvey() {
    const saved = loadSurvey();
    const host = $('#surveyForm');
    host.innerHTML = ITEMS.map(it => `
      <fieldset class="survey-item">
        <legend><span class="tag">${it.label}</span> ${escapeHtml(it.q)}</legend>
        <div class="likert" role="radiogroup" aria-label="${escapeHtml(it.q)}">
          ${SCALE.map((s, i) => `
            <label class="likert-opt">
              <input type="radio" name="${it.id}" value="${i + 1}" ${saved[it.id] === i + 1 ? 'checked' : ''} />
              <span>${s}</span>
            </label>`).join('')}
        </div>
      </fieldset>
    `).join('') + `
      <label class="field field-wide mt-12">
        <span>Anything else? (optional)</span>
        <textarea id="surveyComment" rows="3" placeholder="One thing that helped, one thing to improve…">${escapeHtml(saved.comment || '')}</textarea>
      </label>
      <div class="flex gap-8 mt-12">
        <button class="btn btn-primary" id="saveSurvey" type="button">Save my answers</button>
        <span id="surveyStatus" class="text-muted text-sm" role="status" aria-live="polite">${saved.savedAt ? 'Last saved ' + AM.fmtDate(saved.savedAt) : ''}</span>
      </div>`;

    $('#saveSurvey').addEventListener('click', () => {
      const out = { savedAt: Date.now(), comment: ($('#surveyComment').value || '').trim() };
      ITEMS.forEach(it => {
        const checked = document.querySelector('input[name="' + it.id + '"]:checked');
        if (checked) out[it.id] = Number(checked.value);
      });
      localStorage.setItem(SURVEY_KEY, JSON.stringify(out));
      $('#surveyStatus').textContent = 'Saved. Thank you!';
      AM.toast('Survey saved.');
    });
  }

  function loadSurvey() {
    try { return JSON.parse(localStorage.getItem(SURVEY_KEY)) || {}; } catch (e) { return {}; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }

  loadConfig();
  renderSurvey();
})();
