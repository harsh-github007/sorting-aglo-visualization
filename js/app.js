/*
 * Sort Bench — UI.
 * Replays the op lists produced by algorithms.js onto a canvas.
 * Each panel keeps checkpoints every CK ops, so jumping anywhere on the
 * timeline costs at most CK op replays.
 */
(function () {
  'use strict';

  const { ALGOS, PRESETS, trace, makeInput, parseCustom } = window.SortBench;
  const CK = 512;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString('en-US');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const S = {
    algoA: 'quick', algoB: 'bubble', race: false,
    preset: 'random', size: 48, seed: (Date.now() % 1e9) | 0, custom: null,
    input: [], panels: [], pos: 0, maxLen: 0,
    playing: false, speed: 55, acc: 0, last: 0,
    sound: false, audio: null, lastTone: 0,
  };

  /* ---------- colours come from the CSS tokens ---------- */
  const C = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bar', 'cmp', 'swap', 'pivot', 'done', 'muted', 'ink']) {
      C[k] = cs.getPropertyValue('--' + k).trim();
    }
  }

  /* ---------- replay state ---------- */
  function fresh(input) {
    return { a: input.slice(), done: new Uint8Array(input.length), lo: -1, hi: -1, pivot: -1, c: 0, s: 0, w: 0, r: 0 };
  }
  function clone(st) {
    return { a: st.a.slice(), done: st.done.slice(), lo: st.lo, hi: st.hi, pivot: st.pivot, c: st.c, s: st.s, w: st.w, r: st.r };
  }
  function apply(st, op) {
    switch (op.t) {
      case 'c': st.c++; break;
      case 's': { const x = st.a[op.i]; st.a[op.i] = st.a[op.j]; st.a[op.j] = x; st.s++; break; }
      case 'w': st.a[op.i] = op.v; st.w++; break;
      case 'r': st.r++; break;
      case 'p': st.pivot = op.i; break;
      case 'g': st.lo = op.lo; st.hi = op.hi; st.pivot = -1; break;
      case 'd': st.done[op.i] = 1; break;
    }
  }

  function seek(p, k) {
    k = Math.max(0, Math.min(k, p.ops.length));
    if (k < p.at || k - p.at > CK) {
      const m = Math.floor(k / CK);
      p.st = clone(p.cps[m]);
      p.at = m * CK;
    }
    while (p.at < k) apply(p.st, p.ops[p.at++]);
  }

  /* ---------- panels ---------- */
  function buildPanel(key) {
    const tr = trace(key, S.input);
    const ops = tr.ops;
    const cps = [];
    const st = fresh(S.input);
    for (let k = 0; k <= ops.length; k++) {
      if (k % CK === 0) cps.push(clone(st));
      if (k < ops.length) apply(st, ops[k]);
    }

    const el = document.createElement('article');
    el.className = 'panel';
    el.innerHTML = `
      <div class="panel-head">
        <h2>${ALGOS[key].name}</h2>
        <span class="chip" data-state="ready">Ready</span>
      </div>
      <div class="canvas-box"><canvas role="img" aria-label="${ALGOS[key].name} bars"></canvas></div>
      <div class="readout">
        <div><span>Comparisons</span><b data-k="c">0</b></div>
        <div><span>Swaps</span><b data-k="s">0</b></div>
        <div><span>Writes</span><b data-k="w">0</b></div>
      </div>`;

    const canvas = el.querySelector('canvas');
    const p = {
      key, ops, cps, st: fresh(S.input), at: 0, hl: [], line: -1,
      max: Math.max(1, ...S.input),
      el, canvas, ctx: canvas.getContext('2d'), w: 0, h: 0,
      chip: el.querySelector('.chip'),
      nums: Object.fromEntries([...el.querySelectorAll('b[data-k]')].map((b) => [b.dataset.k, b])),
    };
    const box = el.querySelector('.canvas-box');
    new ResizeObserver(() => { size(p); draw(p); }).observe(box);
    attachScrub(box);
    return p;
  }

  // Horizontal drag (mouse) or swipe (touch) on a chart moves the timeline.
  // touch-action: pan-y in the CSS keeps vertical page scrolling working.
  function attachScrub(box) {
    let startX = 0, startPos = 0, active = false, moved = false;
    box.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      active = true; moved = false; startX = e.clientX; startPos = S.pos;
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 4) return;
      if (!moved) { moved = true; pause(); }
      goTo(Math.round(startPos + (dx / Math.max(1, box.clientWidth)) * S.maxLen));
    });
    const end = () => { active = false; };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  function size(p) {
    const box = p.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    p.w = box.width; p.h = box.height;
    p.canvas.width = Math.round(box.width * dpr);
    p.canvas.height = Math.round(box.height * dpr);
    p.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(p) {
    const { ctx, w, h, st } = p;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const n = st.a.length;
    const padX = 12, top = n <= 24 ? 24 : 12, base = 14;
    const plotW = w - padX * 2, plotH = h - top - base;
    const bw = plotW / n;
    const gap = bw >= 5 ? Math.min(3, bw * 0.2) : 0;

    // roles from the ops just played; later ops win
    const roles = new Map();
    for (const op of p.hl) {
      if (op.t === 'c') { if (roles.get(op.i) !== 'swap') roles.set(op.i, 'cmp'); if (roles.get(op.j) !== 'swap') roles.set(op.j, 'cmp'); }
      else if (op.t === 's') { roles.set(op.i, 'swap'); roles.set(op.j, 'swap'); }
      else if (op.t === 'w') roles.set(op.i, 'swap');
      else if (op.t === 'r') { if (!roles.has(op.i)) roles.set(op.i, 'cmp'); }
    }

    const hasRange = st.lo >= 0;
    ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < n; i++) {
      const v = st.a[i];
      const bh = Math.max(2, (v / p.max) * plotH);
      const x = padX + i * bw + gap / 2;
      const y = top + plotH - bh;
      const role = roles.get(i) || (i === st.pivot ? 'pivot' : st.done[i] ? 'done' : 'bar');
      ctx.globalAlpha = role === 'bar' && hasRange && (i < st.lo || i > st.hi) ? 0.32 : 1;
      ctx.fillStyle = C[role];
      const bwi = Math.max(1, bw - gap);
      if (bwi >= 8 && ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(x, y, bwi, bh, [3, 3, 0, 0]); ctx.fill();
      } else {
        ctx.fillRect(x, y, bwi, bh);
      }
      if (n <= 24) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = role === 'bar' ? C.muted : C[role];
        ctx.fillText(String(v), x + bwi / 2, y - 6);
      }
      // pointer under the bars being touched
      if (roles.has(i)) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C[roles.get(i)];
        const cx = x + bwi / 2, ty = top + plotH + 4;
        ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx - 4, ty + 7); ctx.lineTo(cx + 4, ty + 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function lastLine(p) {
    for (let k = p.at - 1; k >= Math.max(0, p.at - 64); k--) {
      if (p.ops[k].l != null) return p.ops[k].l;
    }
    return -1;
  }

  function updatePanel(p, prevAt) {
    const len = p.ops.length;
    // highlight what just happened: the last few ops moving forward, just one after a jump back
    const from = p.at > prevAt ? Math.max(prevAt, p.at - 6) : Math.max(0, p.at - 1);
    p.hl = p.at > 0 && p.at < len ? p.ops.slice(from, p.at) : [];
    p.line = p.at < len ? lastLine(p) : -1;
    p.nums.c.textContent = fmt(p.st.c);
    p.nums.s.textContent = fmt(p.st.s);
    p.nums.w.textContent = fmt(p.st.w);
    draw(p);
  }

  function updateChips() {
    const done = S.panels.map((p) => p.at >= p.ops.length);
    S.panels.forEach((p, i) => {
      let state = 'ready', text = 'Ready';
      if (done[i]) {
        const other = S.panels[1 - i];
        const first = S.panels.length === 2 && p.ops.length < other.ops.length;
        state = first ? 'winner' : 'done';
        text = (first ? 'Finished first · ' : 'Sorted · ') + fmt(p.ops.length) + ' steps';
      } else if (p.at > 0) {
        state = 'running'; text = 'Running';
      }
      if (p.chip.dataset.state !== state || p.chip.textContent !== text) {
        p.chip.dataset.state = state; p.chip.textContent = text;
      }
    });
  }

  /* ---------- timeline ---------- */
  function goTo(k) {
    S.pos = Math.max(0, Math.min(k, S.maxLen));
    for (const p of S.panels) {
      const prev = p.at;
      seek(p, S.pos);
      updatePanel(p, prev);
    }
    updateChips();
    $('scrub').value = S.pos;
    $('opcount').textContent = `${fmt(S.pos)} / ${fmt(S.maxLen)}`;
    highlightCode();
  }

  const speedOps = () => Math.round(2 * Math.pow(10, (S.speed / 100) * 3.4)); // 2 … ~5000 per second

  function frame(ts) {
    if (!S.playing) return;
    const dt = S.last ? Math.min(100, ts - S.last) : 16;
    S.last = ts;
    S.acc += (dt * speedOps()) / 1000;
    const steps = Math.floor(S.acc);
    if (steps > 0) { S.acc -= steps; goTo(S.pos + steps); tone(); }
    if (S.pos >= S.maxLen) { pause(); return; }
    requestAnimationFrame(frame);
  }

  function play() {
    if (S.pos >= S.maxLen) goTo(0);
    S.playing = true; S.last = 0; S.acc = 0;
    playButton();
    requestAnimationFrame(frame);
  }
  function pause() { S.playing = false; playButton(); }
  function toggle() { S.playing ? pause() : play(); }
  function step(d) { pause(); goTo(S.pos + d); tone(); }

  function playButton() {
    const b = $('playBtn');
    b.querySelector('use').setAttribute('href', S.playing ? '#i-pause' : '#i-play');
    b.querySelector('span').textContent = S.playing ? 'Pause' : (S.pos >= S.maxLen && S.maxLen ? 'Replay' : 'Play');
  }

  /* ---------- sound ---------- */
  function tone() {
    if (!S.sound || !S.audio || !S.panels.length) return;
    const now = performance.now();
    if (now - S.lastTone < 45) return;
    const p = S.panels[0];
    const op = p.hl[p.hl.length - 1];
    if (!op || op.i == null) return;
    S.lastTone = now;
    const ac = S.audio, t0 = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle';
    o.frequency.value = 180 + 900 * (p.st.a[op.i] / p.max);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    o.connect(g).connect(ac.destination);
    o.start(t0); o.stop(t0 + 0.1);
  }

  /* ---------- info cards ---------- */
  function renderInfo() {
    const box = $('info');
    box.classList.toggle('race', S.race);
    box.innerHTML = S.panels.map((p) => {
      const a = ALGOS[p.key];
      const cx = [['Best', a.best], ['Average', a.avg], ['Worst', a.worst], ['Memory', a.space], ['Stable', a.stable ? 'Yes' : 'No']]
        .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
      const code = a.code.map((line, i) => `<div data-line="${i}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`).join('');
      return `<article class="card">
        <h2>${a.name}</h2>
        <div class="cx">${cx}</div>
        <p>${a.note}</p>
        <pre class="code" aria-label="${a.name} pseudocode">${code}</pre>
      </article>`;
    }).join('');
    S.codeEls = [...box.querySelectorAll('.code')];
  }

  function highlightCode() {
    if (!S.codeEls) return;
    S.panels.forEach((p, i) => {
      const pre = S.codeEls[i];
      if (!pre || pre.dataset.on === String(p.line)) return;
      pre.dataset.on = p.line;
      pre.querySelectorAll('.on').forEach((d) => d.classList.remove('on'));
      const cur = pre.querySelector(`[data-line="${p.line}"]`);
      if (cur) cur.classList.add('on');
    });
  }

  /* ---------- comparison table ---------- */
  let measuredFor = '';
  function renderCompare() {
    const sig = S.input.join(',');
    if (sig !== measuredFor) {
      measuredFor = sig;
      S.measured = Object.keys(ALGOS).map((k) => {
        const { counts } = trace(k, S.input);
        return { k, c: counts.c, s: counts.s, w: counts.w, total: counts.c + counts.s + counts.w + counts.r };
      }).sort((a, b) => a.total - b.total);
    }
    const rows = S.measured;
    const top = Math.log10(Math.max(...rows.map((r) => r.total)) + 1);
    const current = new Set(S.race ? [S.algoA, S.algoB] : [S.algoA]);
    $('compareBody').innerHTML = rows.map((r, i) => {
      const pct = top ? (Math.log10(r.total + 1) / top) * 100 : 0;
      return `<tr data-key="${r.k}" tabindex="0" class="${current.has(r.k) ? 'current' : ''}" aria-label="Load ${ALGOS[r.k].name}">
        <td class="rank">${String(i + 1).padStart(2, '0')}</td>
        <td>${ALGOS[r.k].name}</td>
        <td class="num opt">${fmt(r.c)}</td><td class="num opt">${fmt(r.s)}</td><td class="num opt">${fmt(r.w)}</td>
        <td class="num"><b>${fmt(r.total)}</b></td>
        <td class="meter opt"><div><i style="width:${pct.toFixed(1)}%"></i></div></td>
        <td>${ALGOS[r.k].avg}</td>
      </tr>`;
    }).join('');
    const shape = S.custom ? 'your own numbers' : PRESETS[S.preset].toLowerCase() + ' input';
    const best = rows[0], worst = rows[rows.length - 1];
    $('compareNote').textContent = `${S.input.length} values, ${shape}. ${ALGOS[best.k].name} did the least work and ${ALGOS[worst.k].name} did ${Math.round(worst.total / Math.max(1, best.total))}× as much. Total work counts comparisons, swaps, writes and reads.`;
  }

  function loadFromTable(row) {
    if (!row) return;
    S.algoA = row.dataset.key;
    $('algoA').value = S.algoA;
    rebuild();
    $('bench').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ---------- building ---------- */
  function makeData() {
    S.input = S.custom ? S.custom.slice() : makeInput(S.preset, S.size, S.seed);
  }

  function rebuild() {
    const wasPlaying = S.playing;
    pause();
    const box = $('panels');
    box.innerHTML = '';
    box.classList.toggle('race', S.race);
    const keys = S.race ? [S.algoA, S.algoB] : [S.algoA];
    S.panels = keys.map(buildPanel);
    S.panels.forEach((p) => box.appendChild(p.el));
    S.panels.forEach((p) => size(p));
    S.maxLen = Math.max(...S.panels.map((p) => p.ops.length));
    $('scrub').max = S.maxLen;
    renderInfo();
    renderCompare();
    goTo(0);
    if (wasPlaying) play();
  }

  let pending = 0;
  function rebuildSoon() {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(rebuild);
  }

  /* ---------- controls ---------- */
  function fillSelect(sel, value) {
    sel.innerHTML = Object.entries(ALGOS).map(([k, a]) => `<option value="${k}">${a.name}</option>`).join('');
    sel.value = value;
  }

  function speedLabel() {
    $('speedOut').textContent = fmt(speedOps()) + ' ops/s';
  }

  function effectiveDark() {
    const t = document.documentElement.dataset.theme;
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function redrawAll() { readColors(); S.panels.forEach(draw); }

  function init() {
    try {
      const saved = localStorage.getItem('sortbench-theme');
      if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
    } catch (e) { /* storage unavailable */ }
    readColors();

    fillSelect($('algoA'), S.algoA);
    fillSelect($('algoB'), S.algoB);
    $('presets').innerHTML = Object.entries(PRESETS).map(([k, label]) =>
      `<label><input type="radio" name="preset" value="${k}" ${k === S.preset ? 'checked' : ''}><span>${label}</span></label>`).join('');

    if (reduceMotion) S.speed = 40;
    $('speed').value = S.speed;
    speedLabel();

    $('algoA').addEventListener('change', (e) => { S.algoA = e.target.value; rebuild(); });
    $('algoB').addEventListener('change', (e) => { S.algoB = e.target.value; rebuild(); });
    $('raceToggle').addEventListener('change', (e) => {
      S.race = e.target.checked;
      $('algoBField').hidden = !S.race;
      rebuild();
    });

    $('presets').addEventListener('change', (e) => {
      S.preset = e.target.value; S.custom = null;
      $('custom').value = ''; $('customErr').hidden = true;
      makeData(); rebuild();
    });
    $('size').addEventListener('input', (e) => {
      S.size = +e.target.value; S.custom = null;
      $('sizeOut').textContent = S.size;
      makeData(); rebuildSoon();
    });
    $('newBtn').addEventListener('click', newInput);

    const useCustom = () => {
      const r = parseCustom($('custom').value);
      const err = $('customErr');
      if (r.error) { err.textContent = r.error; err.hidden = false; return; }
      err.hidden = true;
      S.custom = r.values;
      $('sizeOut').textContent = r.values.length;
      makeData(); rebuild();
    };
    $('customBtn').addEventListener('click', useCustom);
    $('custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); useCustom(); } });

    $('speed').addEventListener('input', (e) => { S.speed = +e.target.value; speedLabel(); });
    $('sound').addEventListener('change', (e) => {
      S.sound = e.target.checked;
      if (S.sound && !S.audio) {
        try { S.audio = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (err) { S.sound = false; e.target.checked = false; }
      }
      if (S.audio && S.audio.state === 'suspended') S.audio.resume();
    });

    $('playBtn').addEventListener('click', toggle);
    $('heroPlay').addEventListener('click', () => { goTo(0); play(); });
    $('compareBody').addEventListener('click', (e) => loadFromTable(e.target.closest('tr')));
    $('compareBody').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadFromTable(e.target.closest('tr')); }
    });
    $('backBtn').addEventListener('click', () => step(-1));
    $('fwdBtn').addEventListener('click', () => step(1));
    $('resetBtn').addEventListener('click', () => { pause(); goTo(0); playButton(); });
    $('scrub').addEventListener('input', (e) => { pause(); goTo(+e.target.value); });

    $('themeBtn').addEventListener('click', () => {
      const next = effectiveDark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('sortbench-theme', next); } catch (e) { /* ignore */ }
      redrawAll();
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);

    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' && e.target.type === 'text') return;
      if (tag === 'SELECT' || tag === 'TR' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? 25 : 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -25 : -1); }
      else if (e.key === 'r' || e.key === 'R') { pause(); goTo(0); playButton(); }
      else if (e.key === 'n' || e.key === 'N') newInput();
    });

    makeData();
    rebuild();
  }

  function newInput() {
    S.seed = (S.seed * 1103515245 + 12345) >>> 0;
    S.custom = null;
    $('custom').value = '';
    $('sizeOut').textContent = S.size;
    makeData(); rebuild();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
