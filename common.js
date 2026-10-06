/* Shared helpers for all spider-dashboard versions. Data URL/poll interval are set by live.js on the public site. */
(function () {
  const SD = (window.SD = {});
  SD.DATA_URL = '../data.json';
  SD.POLL_MS = 30000;
  const esc = (SD.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  SD.usd = (v, dp) => v == null || isNaN(v) ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: dp ?? 2, maximumFractionDigits: dp ?? 2 });
  SD.signedUsd = v => v == null ? '—' : (v >= 0 ? '+' : '−') + SD.usd(Math.abs(v));
  SD.pct = (v, dp = 2) => v == null || isNaN(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(dp) + '%';
  SD.cls = v => v == null ? 'flat' : v > 0.004 ? 'up' : v < -0.004 ? 'down' : 'flat';
  SD.price = v => v == null ? '—' : v >= 1000 ? SD.usd(v, 0) : v >= 1 ? SD.usd(v, 2) : v >= 0.01 ? '$' + v.toFixed(4) : '$' + Number(v).toPrecision(3);
  SD.qty = v => v == null ? '—' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v >= 1 ? v.toFixed(2) : v.toFixed(5);
  SD.hm = s => { const m = /(\d{1,2}:\d{2})/.exec(s || ''); return m ? m[1] : (s || '—'); };
  SD.trunc = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n - 1) + '…' : s;
  SD.dirIcon = d => ({ bullish: '▲', bearish: '▼', avoid: '⚠', neutral: '●' }[d] || '●');
  SD.botName = id => ({ news: 'News Scanner', x: 'X Scanner', chat: 'Chatter Scanner', launch: 'Launch Scanner', whale: 'Whale Tracker', list: 'Listings Scanner', unlock: 'Unlock Tracker', hype: 'Hype Tracker', core: 'Paper Trader', meme: 'Memecoin Trader' }[id] || id);
  SD.SHORT = { news: 'NEWS', x: 'X', chat: 'CHAT', launch: 'LAUNCH', whale: 'WHALE', list: 'LIST', unlock: 'UNLOCK', hype: 'HYPE', core: 'CORE', meme: 'MEME' };
  SD.COLORS = { news: '#ffb84c', x: '#a78bff', chat: '#3ee8d0', launch: '#ff6b3d', whale: '#8dff5a', list: '#ffe14d', unlock: '#ff8fa3', hype: '#5ef0ff', core: '#4cc9ff', meme: '#ff5fd2' };
  SD.SCANNERS = ['news', 'x', 'chat', 'launch', 'whale', 'list', 'unlock', 'hype'];
  SD.isOn = b => b && b.status === 'active';

  SD.start = function (render) {
    let first = true;
    const tick = () => fetch(SD.DATA_URL + '?t=' + Date.now(), { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { SD.data = d; render(d, first); first = false; document.documentElement.classList.remove('sd-nodata'); })
      .catch(e => { console.warn('data.json not available', e); document.documentElement.classList.add('sd-nodata'); if (first) render(SD.empty(), true); first = false; });
    tick(); setInterval(tick, SD.POLL_MS);
  };
  SD.empty = () => ({ empty: true, generated_at_et: 'waiting for data.json', price_source: 'none', bots: [], sources: [], links: [], traders: { core: { name: 'Crypto Paper Trader', available: false }, meme: { name: 'Memecoin Paper Trader', available: false } }, scanners: { x: {}, news: {} }, signals: [], provenance: ['data.json not found yet: run python3 data.py'] });

  /* Graph model: bots + sources with resolved links */
  SD.graph = function (d) {
    const nodes = [];
    (d.bots || []).forEach(b => nodes.push({ id: b.id, label: b.name, short: b.short, type: 'bot', kind: b.kind, status: b.status, last: b.last_activity, note: b.note, on: b.status === 'active' }));
    (d.sources || []).forEach(s => nodes.push({ id: 's_' + s.id, sid: s.id, label: s.label, type: 'source', group: s.group, seen: s.seen_in_files, by: s.scanned_by }));
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const srcIds = new Set((d.sources || []).map(s => s.id));
    const links = (d.links || []).map(l => ({ ...l, s: byId[srcIds.has(l.source) ? 's_' + l.source : l.source], t: byId[l.target] })).filter(l => l.s && l.t);
    return { nodes, links, byId };
  };

  /* Random pulse scheduler. fn(link, kind) where kind in scan|signal|price */
  SD.pulses = function (graph, fn, o = {}) {
    // scans to bots without output yet are shown 3x less often; signals only from bots that have produced output
    const scan = graph.links.filter(l => l.type === 'scan').flatMap(l => l.t.on ? [l, l, l] : [l]), price = graph.links.filter(l => l.type === 'price'), sig = graph.links.filter(l => l.type === 'signal' && l.s.on);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const timers = [];
    const loop = (arr, kind, ms) => { if (!arr.length) return; const go = () => { fn(pick(arr), kind); timers.push(setTimeout(go, ms * (0.5 + Math.random()))); }; timers.push(setTimeout(go, Math.random() * ms)); };
    loop(scan, 'scan', o.scan || 420); loop(price, 'price', o.price || 1300);
    const weighted = sig.flatMap(l => Array(1 + Math.min(4, l.count || 0)).fill(l));
    loop(weighted, 'signal', o.signal || 1500);
    return () => timers.forEach(clearTimeout);
  };

  /* ---------- HTML fragments (each version styles the sd-* classes) ---------- */
  SD.waitHTML = (title, detail) => `<div class="sd-wait"><div class="sd-wait-t">${esc(title)}</div><div class="sd-wait-d">${esc(detail || '')}</div></div>`;
  SD.kpiHTML = function (t) {
    if (!t || !t.available) return SD.waitHTML('WAITING FOR DATA', `No portfolio file found for ${t ? t.name : 'trader'}${t && t.dir ? ' in ' + t.dir : ''}.`);
    return `<div class="sd-kpi"><div class="sd-eq">${SD.usd(t.equity)}</div>
      <div class="sd-pnl ${SD.cls(t.pnl)}">${SD.signedUsd(t.pnl)} <span>${SD.pct(t.pnl_pct)}</span></div>
      <div class="sd-sub">vs ${SD.usd(t.start, 0)} start · cash ${SD.usd(t.cash, 0)} (${(t.cash_pct || 0).toFixed(0)}%) · ${t.positions.length} pos</div></div>`;
  };
  SD.positionsHTML = function (t, n = 8) {
    if (!t || !t.available) return '';
    if (!t.positions.length) return SD.waitHTML('NO OPEN POSITIONS', 'All cash.');
    return `<table class="sd-pos"><tbody>${t.positions.slice(0, n).map(p => `<tr><td class="sym">${esc(p.sym)}</td><td class="val">${SD.usd(p.value, 0)}</td><td class="px">${SD.price(p.price)}</td><td class="pl ${SD.cls(p.pnl)}">${SD.pct(p.pnl_pct)}</td></tr>`).join('')}</tbody></table>`;
  };
  SD.tradesHTML = function (t, n = 5, reasonLen = 46) {
    if (!t || !t.available) return '';
    if (!t.trades || !t.trades.length) return SD.waitHTML('NO TRADES YET', 'trades file is empty.');
    return `<ul class="sd-trades">${t.trades.slice(0, n).map(x => `<li class="sd-trade ${x.side === 'BUY' ? 'buy' : 'sell'}${x.link ? ' sd-link' : ''}"${x.link ? ` data-link="${esc(x.link)}" title="Open ${esc(x.link_kind || x.link)}"` : ''}><span class="tm">${SD.hm(x.time)}</span><span class="sd-side">${esc(x.side)}</span><b>${esc(x.coin)}</b><span class="usd">${SD.usd(x.usd, 0)}</span><span class="why">${esc(SD.trunc(x.reason, reasonLen))}</span></li>`).join('')}</ul>`;
  };
  SD.signalsHTML = function (d, n = 6, filter, len = 90) {
    let s = (d.signals || []).filter(filter || (() => true));
    const rank = g => (g.kind === 'applied adjustment' ? 0 : g.coin ? 1 : 2);
    s = s.slice().sort((a, b) => rank(a) - rank(b));
    if (!s.length) return SD.waitHTML('NO SIGNALS YET', 'Scanners have not written any signals.');
    return `<ul class="sd-sigs">${s.slice(0, n).map(g => `<li class="sd-sig dir-${g.direction}${g.link ? ' sd-link' : ''}"${g.link ? ` data-link="${esc(g.link)}" title="Open ${esc(g.link_kind || g.link)}"` : ''}><div class="sd-sig-h"><span class="ic">${SD.dirIcon(g.direction)}</span><b>${esc(g.coin || 'MARKET')}</b><span class="route">${g.from === 'x' ? 'X' : 'NEWS'} → ${g.to === 'core' ? 'CORE' : 'MEME'}</span>${g.adj ? `<span class="adj">${g.adj > 0 ? '+' : ''}${Math.round(g.adj * 100)} pts</span>` : ''}<span class="tm">${esc(SD.hm(g.time))}</span></div><div class="sd-sig-t">${esc(SD.trunc(g.text, len))}</div></li>`).join('')}</ul>`;
  };
  SD.statusHTML = function (d) {
    return `<ul class="sd-status">${(d.bots || []).map(b => `<li class="st-${b.status === 'active' ? 'on' : 'off'}"><i></i><b>${esc(b.name)}</b><span>${esc(b.status)}${b.last_activity ? ' · ' + esc(SD.hm(b.last_activity)) : ''}</span></li>`).join('')}</ul>`;
  };
  SD.botSub = b => b.status === 'active' && b.note ? '◐ working · no signals yet' : b.status === 'active' ? '● active' + (b.last_activity || b.last ? ' · ' + SD.hm(b.last_activity || b.last) : '') : '○ awaiting first output';
  SD.footHTML = d => `<span class="sd-paper">PAPER TRADING · pretend money</span> <span>data ${esc(d.generated_at_et)}</span> · <span>prices: ${esc(d.price_source)}</span> · <span>pulses are illustrative</span>`;
  SD.sparkPath = function (pts, w, h) {
    const v = (pts || []).map(p => p.v); if (v.length < 2) return null;
    const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
    return v.map((y, i) => (i ? 'L' : 'M') + (i / (v.length - 1) * w).toFixed(1) + ',' + (h - (y - lo) / r * h).toFixed(1)).join('');
  };
  SD.series = t => { if (!t || !t.available) return []; const a = (t.equity_series || []).concat((t.valuation_history || []).map(p => ({ t: p.t, v: p.v }))); a.push({ t: 'now', v: t.equity }); return a; };
  SD.sparkSVG = function (t, w = 220, h = 40, color = 'currentColor') {
    const p = SD.sparkPath(SD.series(t), w, h);
    if (!p) return `<div class="sd-spark-wait">equity history: waiting for more data points</div>`;
    return `<svg class="sd-spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><path d="${p}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
  };

  /* SVG helpers */
  const NS = 'http://www.w3.org/2000/svg';
  SD.el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  /* Animate a glowing dot (with trail) along an SVG path element. */
  SD.svgPulse = function (layer, path, color, dur, o = {}) {
    const L = path.getTotalLength(), n = o.trail ?? 4, r = o.r ?? 3, dots = [];
    for (let i = 0; i < n; i++) dots.push(SD.el('circle', { r: Math.max(0.6, r - i * r / n), fill: color, opacity: 1 - i / n, filter: o.filter || '' }, layer));
    const t0 = performance.now();
    (function f(now) {
      const p = (now - t0) / dur;
      if (p >= 1) { dots.forEach(d => d.remove()); o.done && o.done(); return; }
      dots.forEach((d, i) => { const q = Math.max(0, p - i * (o.gap ?? 0.03)), pt = path.getPointAtLength((o.reverse ? 1 - q : q) * L); d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y); });
      requestAnimationFrame(f);
    })(t0);
  };
  SD.ripple = function (layer, x, y, color, r0 = 10, r1 = 40, dur = 900) {
    const c = SD.el('circle', { cx: x, cy: y, r: r0, fill: 'none', stroke: color, 'stroke-width': 2 }, layer), t0 = performance.now();
    (function f(now) { const p = (now - t0) / dur; if (p >= 1) return c.remove(); c.setAttribute('r', r0 + (r1 - r0) * p); c.setAttribute('opacity', 1 - p); requestAnimationFrame(f); })(t0);
  };
})();
