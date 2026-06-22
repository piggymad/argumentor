/* app.js — shared utilities: storage, toasts, nav highlighting. */

(function (global) {
  'use strict';

  const KEY_DRAFTS = 'argumentor.drafts.v1';
  const KEY_PROFILE = 'argumentor.profile.v1';
  const KEY_TEACHER_NOTES = 'argumentor.teacher.v1';

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const Storage = {
    getDrafts() { return load(KEY_DRAFTS, []); },
    saveDraft(draft) {
      const drafts = this.getDrafts();
      const idx = drafts.findIndex(d => d.id === draft.id);
      if (idx >= 0) drafts[idx] = draft; else drafts.push(draft);
      save(KEY_DRAFTS, drafts);
      return draft;
    },
    deleteDraft(id) {
      save(KEY_DRAFTS, this.getDrafts().filter(d => d.id !== id));
    },
    getDraft(id) {
      return this.getDrafts().find(d => d.id === id);
    },
    getProfile() { return load(KEY_PROFILE, { name: 'Student', role: 'student' }); },
    saveProfile(p) { save(KEY_PROFILE, p); },
    getTeacherNotes() { return load(KEY_TEACHER_NOTES, {}); },
    saveTeacherNote(draftId, note) {
      const all = this.getTeacherNotes();
      all[draftId] = note;
      save(KEY_TEACHER_NOTES, all);
    }
  };

  function toast(message, ms = 1800) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function highlightNav() {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === here) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  // Shared mobile navigation toggle (present on every page's nav).
  function wireNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (!toggle || !links) return;
    toggle.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  function uid() {
    return 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fmtDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ----- Built-in demo seed so dashboards/teacher pages aren't empty on first run.
  function seedIfEmpty() {
    if (Storage.getDrafts().length === 0) {
      const now = Date.now();
      const seed = [
        {
          id: uid(),
          studentName: 'Demo · Wong K.',
          topicId: 'ai-classroom',
          topicTitle: 'Should AI writing tools be allowed in secondary school English classrooms?',
          content:
            'AI writing tools should be permitted in secondary school English classrooms. They give students faster feedback than a teacher with thirty essays to mark. Lam, Hew and Chiu (2018) found that a blended, technology-supported approach improved Hong Kong secondary students\' argumentative writing. However, critics may argue that students will become dependent on the tool. This is a real risk; the solution is teacher supervision, not a ban.\n\nIn most cases, supervised AI use is therefore beneficial.',
          createdAt: now - 1000 * 60 * 60 * 26,
          updatedAt: now - 1000 * 60 * 60 * 26,
          version: 1,
          submitted: true
        },
        {
          id: uid(),
          studentName: 'Demo · Wong K.',
          topicId: 'ai-classroom',
          topicTitle: 'Should AI writing tools be allowed in secondary school English classrooms?',
          content:
            'I argue that AI writing tools should be permitted in secondary school English classrooms, but only when paired with explicit instruction on argument quality. Lam, Hew and Chiu (2018) found that Hong Kong secondary students who received structured, technology-supported instruction produced stronger arguments than peers taught conventionally. This shows that AI access alone is not the cause of improvement; structured pedagogy is. Marzuki et al. (2023) reported similar teacher-observed gains in content and organisation across EFL classrooms, lending broader support.\n\nCritics argue that AI access erodes critical thinking. However, this position conflates the tool with how it is used, which is an analytical error. In most cases, when paired with guided instruction, AI use enhances rather than replaces the cognitive work of writing.',
          createdAt: now - 1000 * 60 * 60 * 2,
          updatedAt: now - 1000 * 60 * 60 * 2,
          version: 2,
          submitted: true
        }
      ];
      seed.forEach(s => Storage.saveDraft(s));
    }
  }

  global.AM = { Storage, toast, highlightNav, uid, fmtDate, seedIfEmpty };

  document.addEventListener('DOMContentLoaded', () => {
    highlightNav();
    wireNavToggle();
    seedIfEmpty();
  });
})(window);
