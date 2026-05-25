/* dashboard.js — student progress overview with custom canvas charts. */

(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);

  const drafts = AM.Storage.getDrafts().sort((a, b) => a.updatedAt - b.updatedAt);

  if (drafts.length === 0) {
    $('#stats').innerHTML = '<div class="card"><p>No drafts yet. <a href="workspace.html">Start writing →</a></p></div>';
    return;
  }

  // ---------- Stats cards ----------
  const analyses = drafts.map(d => ({ draft: d, r: ArguMentorEngine.analyse(d.content) }));
  const latest = analyses[analyses.length - 1];
  const totalWords = analyses.reduce((s, a) => s + a.r.wordCount, 0);
  const submittedCount = drafts.filter(d => d.submitted).length;
  const overallTrend = analyses.length > 1
    ? latest.r.scores.overall - analyses[0].r.scores.overall
    : 0;

  $('#stats').innerHTML = `
    <div class="stat-card">
      <div class="label">Drafts</div>
      <div class="value">${drafts.length}</div>
      <div class="delta">${submittedCount} submitted</div>
    </div>
    <div class="stat-card">
      <div class="label">Total words written</div>
      <div class="value">${totalWords.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="label">Latest score</div>
      <div class="value">${latest.r.scores.overall}</div>
      <div class="delta ${overallTrend < 0 ? 'down' : ''}">${overallTrend >= 0 ? '+' : ''}${overallTrend} since first draft</div>
    </div>
    <div class="stat-card">
      <div class="label">Strongest dimension</div>
      <div class="value" style="font-size:22px">${strongestDimensionLabel(latest.r)}</div>
    </div>
  `;

  // ---------- Radar chart ----------
  drawRadar($('#radarChart'), latest.r);

  // ---------- Trend chart ----------
  drawTrend($('#trendChart'), analyses);

  // ---------- Draft list ----------
  const list = $('#draftListFull');
  const reverseAnalyses = analyses.slice().reverse();
  reverseAnalyses.forEach(({ draft, r }) => {
    const div = document.createElement('div');
    div.className = 'draft-list-row';
    div.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml((draft.topicTitle || 'Untitled').slice(0, 70))}</div>
        <div class="meta">${AM.fmtDate(draft.updatedAt)} · v${draft.version || 1} · ${r.wordCount} words · score ${r.scores.overall}</div>
      </div>
      <div class="flex gap-8">
        ${draft.submitted ? '<span class="tag tag-claim">submitted</span>' : '<span class="tag">draft</span>'}
        <a class="btn btn-ghost btn-sm" href="workspace.html?draft=${encodeURIComponent(draft.id)}">Open</a>
      </div>
    `;
    list.appendChild(div);
  });

  // ---------- Helpers ----------
  function strongestDimensionLabel(r) {
    const map = {
      Claim: r.scores.sub.claim, Data: r.scores.sub.data, Warrant: r.scores.sub.warrant,
      Backing: r.scores.sub.backing, Qualifier: r.scores.sub.qualifier, Rebuttal: r.scores.sub.rebuttal,
      Organisation: r.scores.organization, Language: r.scores.language
    };
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0][0];
  }

  function drawRadar(canvas, r) {
    const labels = ['Claim', 'Data', 'Warrant', 'Backing', 'Qualifier', 'Rebuttal'];
    const values = [
      r.scores.sub.claim, r.scores.sub.data, r.scores.sub.warrant,
      r.scores.sub.backing, r.scores.sub.qualifier, r.scores.sub.rebuttal
    ];
    fitCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) / 2 - 36;
    const N = 6;

    // grid
    ctx.strokeStyle = '#e3e6ef';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + (Math.PI * 2 * i) / N;
        const r2 = (R * g) / 4;
        const x = cx + Math.cos(a) * r2;
        const y = cy + Math.sin(a) * r2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = '#e3e6ef';
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / N;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }

    // data polygon
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / N;
      const v = (values[i] || 0) / 100;
      const x = cx + Math.cos(a) * R * v;
      const y = cy + Math.sin(a) * R * v;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,70,229,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.stroke();

    // points
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / N;
      const v = (values[i] || 0) / 100;
      const x = cx + Math.cos(a) * R * v;
      const y = cy + Math.sin(a) * R * v;
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }

    // labels
    ctx.fillStyle = '#1d2434';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / N;
      const x = cx + Math.cos(a) * (R + 18);
      const y = cy + Math.sin(a) * (R + 18);
      ctx.fillText(labels[i], x, y);
    }

    $('#radarLegend').textContent = `Latest draft: "${(latest.draft.topicTitle || '').slice(0, 60)}…" · ${AM.fmtDate(latest.draft.updatedAt)}`;
  }

  function drawTrend(canvas, items) {
    fitCanvas(canvas);
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);

    const padL = 36, padR = 18, padT = 18, padB = 30;
    const W = w - padL - padR, H = h - padT - padB;

    // y grid 0..100
    ctx.strokeStyle = '#e3e6ef';
    ctx.fillStyle = '#5b6479';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let v = 0; v <= 100; v += 25) {
      const y = padT + H - (v / 100) * H;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
      ctx.fillText(v, padL - 6, y + 3);
    }

    if (items.length < 1) return;

    // line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    items.forEach((it, i) => {
      const x = padL + (items.length === 1 ? W / 2 : (W * i) / (items.length - 1));
      const y = padT + H - (it.r.scores.overall / 100) * H;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    items.forEach((it, i) => {
      const x = padL + (items.length === 1 ? W / 2 : (W * i) / (items.length - 1));
      const y = padT + H - (it.r.scores.overall / 100) * H;
      ctx.fillStyle = '#4f46e5';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d2434';
      ctx.font = '600 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('v' + (it.draft.version || 1), x, padT + H + 18);
      ctx.fillStyle = '#5b6479';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText(it.r.scores.overall, x, y - 8);
    });
  }

  function fitCanvas(canvas) {
    if (!canvas.style.height) canvas.style.height = '320px';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
  }
})();
