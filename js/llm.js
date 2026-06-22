/* llm.js — OPTIONAL large-language-model enhancement.
 *
 * ArguMentor works fully offline with the rule-based ArguMentorEngine. This
 * module is a thin, provider-agnostic client that a student or teacher can
 * switch on by supplying their OWN API key. Nothing here runs unless a key is
 * saved, and every caller falls back to the heuristic engine on any error.
 *
 * Privacy: the key and configuration live only in this browser's localStorage.
 * Requests go directly from the browser to the chosen provider — ArguMentor
 * has no backend and never sees the key or the essay text. */

(function (global) {
  'use strict';

  const KEY = 'argumentor.llm.v1';

  const DEFAULTS = {
    provider: 'anthropic',                 // 'anthropic' | 'openai'
    apiKey: '',
    model: 'claude-haiku-4-5-20251001',    // a small, fast, low-cost model
    baseUrl: ''                            // optional, OpenAI-compatible only
  };

  function getConfig() {
    try {
      const raw = localStorage.getItem(KEY);
      return Object.assign({}, DEFAULTS, raw ? JSON.parse(raw) : {});
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveConfig(cfg) {
    const merged = Object.assign(getConfig(), cfg || {});
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isConfigured() {
    return !!(getConfig().apiKey || '').trim();
  }

  // ---- Low-level chat completion -----------------------------------------
  async function complete({ system, messages, maxTokens = 900, temperature = 0.3 }) {
    const cfg = getConfig();
    if (!cfg.apiKey) throw new Error('No API key configured.');

    if (cfg.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          // Required for direct browser-to-Anthropic calls.
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: cfg.model || DEFAULTS.model,
          max_tokens: maxTokens,
          temperature,
          system: system || '',
          messages: messages
        })
      });
      if (!res.ok) throw new Error(await describeError(res));
      const data = await res.json();
      const block = (data.content || []).find(b => b.type === 'text');
      return (block && block.text || '').trim();
    }

    // OpenAI-compatible (OpenAI, Azure-style gateways, local proxies, etc.)
    const base = (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini',
        max_tokens: maxTokens,
        temperature,
        messages: system
          ? [{ role: 'system', content: system }].concat(messages)
          : messages
      })
    });
    if (!res.ok) throw new Error(await describeError(res));
    const data = await res.json();
    return ((data.choices && data.choices[0] && data.choices[0].message.content) || '').trim();
  }

  async function describeError(res) {
    let detail = '';
    try {
      const body = await res.json();
      detail = (body.error && (body.error.message || body.error.type)) || JSON.stringify(body);
    } catch (e) {
      detail = res.statusText;
    }
    if (res.status === 401) return 'Authentication failed (check your API key). ' + detail;
    if (res.status === 429) return 'Rate limit or quota reached. ' + detail;
    return 'Request failed (HTTP ' + res.status + '). ' + detail;
  }

  // ---- Connection test ----------------------------------------------------
  async function testConnection() {
    try {
      const reply = await complete({
        system: 'You are a connection test. Reply with the single word: OK.',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        maxTokens: 8,
        temperature: 0
      });
      return { ok: true, message: 'Connected. Model replied: "' + reply.slice(0, 40) + '".' };
    } catch (e) {
      return { ok: false, message: e.message || String(e) };
    }
  }

  // ---- Essay analysis (augments the heuristic component view) -------------
  const ANALYSIS_SYSTEM =
    'You are ArguMentor, a writing coach for Hong Kong Grade-11 ESL students learning ' +
    'argumentative writing with Toulmin\'s model (claim, data, warrant, backing, qualifier, ' +
    'rebuttal). Give specific, encouraging, age-appropriate feedback. Never rewrite the essay ' +
    'for the student and never invent facts, statistics or sources. Respond with STRICT JSON ' +
    'only, no markdown fences, matching exactly this shape: ' +
    '{"components":{"claim":{"present":boolean,"feedback":string},' +
    '"data":{"present":boolean,"feedback":string},"warrant":{"present":boolean,"feedback":string},' +
    '"backing":{"present":boolean,"feedback":string},"qualifier":{"present":boolean,"feedback":string},' +
    '"rebuttal":{"present":boolean,"feedback":string}},' +
    '"overall":{"comment":string,"strengths":[string],"next_steps":[string]}}. ' +
    'Each feedback string is one or two sentences. Keep next_steps concrete and actionable.';

  async function analyseEssay(text, topicTitle) {
    const user =
      'Topic: ' + (topicTitle || '(none given)') + '\n\n' +
      'Student essay:\n"""\n' + text + '\n"""\n\n' +
      'Return the JSON described in your instructions.';
    const raw = await complete({
      system: ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: user }],
      maxTokens: 1100,
      temperature: 0.2
    });
    return parseJsonLoose(raw);
  }

  // ---- Socratic tutor reply ----------------------------------------------
  const TUTOR_SYSTEM =
    'You are ArguMentor\'s Socratic writing tutor for Hong Kong Grade-11 ESL students. ' +
    'Your role follows Vygotsky\'s "more knowledgeable other": you scaffold thinking, you do ' +
    'NOT do it for the student. Hard rules: never write or rewrite the essay or a paragraph for ' +
    'them; never invent facts or sources; usually answer with ONE focused guiding question that ' +
    'moves their argument forward. Anchor your guidance in Toulmin\'s six components. Keep replies ' +
    'short (2-5 sentences), warm and concrete. British English.';

  async function tutorReply(history, draftText) {
    const messages = (history || []).map(m => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: m.text
    }));
    if (draftText && draftText.trim()) {
      messages.unshift({
        role: 'user',
        content: 'For context, here is my current draft (do not rewrite it):\n"""\n' +
          draftText.slice(0, 4000) + '\n"""'
      });
    }
    return complete({ system: TUTOR_SYSTEM, messages, maxTokens: 400, temperature: 0.5 });
  }

  function parseJsonLoose(raw) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('Model did not return JSON.');
    return JSON.parse(raw.slice(start, end + 1));
  }

  global.ArguMentorLLM = {
    DEFAULTS,
    getConfig,
    saveConfig,
    clear,
    isConfigured,
    complete,
    testConnection,
    analyseEssay,
    tutorReply
  };
})(window);
