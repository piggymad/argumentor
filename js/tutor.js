/* tutor.js — Socratic chat that scaffolds rather than ghost-writes. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const messagesEl = $('#messages');
  const chipsEl = $('#chips');
  const form = $('#form');
  const input = $('#input');

  const STARTERS = [
    'What is the strongest claim you want to make?',
    'Help me find evidence for my argument',
    'How do I write a good rebuttal?',
    'Explain Toulmin\'s model with an example',
    'Critique my thesis statement',
    'Suggest a counter-argument I should address'
  ];

  const history = [];

  function addMessage(role, text, record = true) {
    const div = document.createElement('div');
    div.className = 'message ' + role;
    if (role === 'tutor') {
      div.innerHTML = `<span class="role-tag">Tutor</span>${escapeHtml(text).replace(/\n/g, '<br>')}`;
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (record) history.push({ role, text });
    return div;
  }

  function getDraftContext() {
    const drafts = AM.Storage.getDrafts();
    if (!drafts.length) return null;
    const latest = drafts.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    return { draftLength: ArguMentorEngine.wordCount(latest.content), text: latest.content };
  }

  function renderChips() {
    chipsEl.innerHTML = '';
    STARTERS.forEach(text => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'chip';
      c.textContent = text;
      c.addEventListener('click', () => {
        input.value = text;
        form.dispatchEvent(new Event('submit'));
      });
      chipsEl.appendChild(c);
    });
  }

  // Greeting
  addMessage('tutor', "Hi — I'm your argumentation tutor.\n\nI won't draft the essay for you, but I'll ask you the questions a careful teacher would. To start, what argumentative essay topic are you working on, and what is your current claim?");
  renderChips();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage('user', text);
    input.value = '';

    const ctx = getDraftContext();
    const useLLM = window.ArguMentorLLM && ArguMentorLLM.isConfigured();

    if (!useLLM) {
      // Offline Socratic engine.
      setTimeout(() => {
        addMessage('tutor', ArguMentorEngine.tutorReply(text, ctx));
      }, 420); // small delay feels more natural
      return;
    }

    // Optional model-backed tutor, with graceful fallback.
    const typing = addMessage('tutor', '…', false);
    typing.classList.add('typing');
    try {
      const reply = await ArguMentorLLM.tutorReply(history, ctx && ctx.text);
      typing.remove();
      addMessage('tutor', reply || ArguMentorEngine.tutorReply(text, ctx));
    } catch (err) {
      typing.remove();
      addMessage('tutor', ArguMentorEngine.tutorReply(text, ctx));
      AM.toast('AI tutor unavailable — using the offline tutor.');
    }
  });

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  }
})();
