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
  SD.empty = () => ({ empty: true, generated_at_et: 'waiting for data.json', price_source: 'none', bots: [], sources: [], links: [], traders: { core: { name: 'Crypto Paper Trader', available: false }, meme: { name: 'Memecoin Paper Trader', available: false } }, scanners: { x: {}, news: {} }, signals: [], day_trade: { symbol: 'SPY', bars: [], equity: [], balance: 100000, starting_equity: 100000, side: 'flat', paper: true, status: 'waiting_for_next_session' }, provenance: ['data.json not found yet: run python3 data.py'] });

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
  SD.dayTradeCandleSVG = function (bars, w, h) {
    bars = (bars || []).filter(b => b && b.o != null && b.h != null && b.l != null && b.c != null);
    if (!bars.length) return '';
    const pad = 4, n = bars.length;
    const lo = Math.min(...bars.map(b => +b.l)), hi = Math.max(...bars.map(b => +b.h));
    const r = hi - lo || 1;
    const y = v => pad + (1 - (v - lo) / r) * (h - pad * 2);
    const slot = (w - pad * 2) / n, bw = Math.max(1.2, Math.min(6, slot * 0.55));
    let parts = '';
    bars.forEach((b, i) => {
      const x = pad + i * slot + slot / 2;
      const up = +b.c >= +b.o;
      const col = up ? '#3dffa8' : '#ff5470';
      parts += `<line x1="${x.toFixed(1)}" y1="${y(+b.h).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(+b.l).toFixed(1)}" stroke="${col}" stroke-width="1" opacity=".85"/>`;
      const y1 = y(Math.max(+b.o, +b.c)), y2 = y(Math.min(+b.o, +b.c));
      const bh = Math.max(1, y2 - y1);
      parts += `<rect x="${(x - bw / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" opacity=".9"/>`;
    });
    return `<svg class="dt-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true">${parts}</svg>`;
  };
  SD.dayTradeLineSVG = function (bars, w, h) {
    bars = (bars || []).filter(b => b && b.c != null);
    if (bars.length < 2) return SD.dayTradeCandleSVG(bars, w, h);
    const pad = 4;
    const vals = bars.map(b => +b.c);
    const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
    const path = vals.map((v, i) => {
      const x = pad + i / (vals.length - 1) * (w - pad * 2);
      const y = pad + (1 - (v - lo) / r) * (h - pad * 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join('');
    const last = vals[vals.length - 1], first = vals[0];
    const col = last >= first ? '#3dffa8' : '#ff5470';
    return `<svg class="dt-chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${path}" fill="none" stroke="${col}" stroke-width="1.8" filter="drop-shadow(0 0 3px ${col})"/></svg>`;
  };
  SD.dayTradeEquitySVG = function (eq, w, h) {
    const pts = (eq || []).filter(p => p && p.v != null);
    const p = SD.sparkPath(pts, w, h);
    if (!p) return '';
    const wide = w >= 120;
    const cls = wide ? 'dt-chart' : 'dt-eq';
    const wh = wide ? `width="100%" height="${h}"` : `width="${w}" height="${h}"`;
    return `<svg class="${cls}" viewBox="0 0 ${w} ${h}" ${wh} preserveAspectRatio="none" aria-hidden="true"><path d="${p}" fill="none" stroke="#5fd8ff" stroke-width="${wide ? 1.8 : 1.4}" opacity=".9" filter="drop-shadow(0 0 3px #5fd8ff)"/></svg>`;
  };
  SD.dayTradeBalance = function (dt) {
    if (dt && dt.balance != null && !isNaN(+dt.balance)) return +dt.balance;
    const eq = ((dt && dt.equity) || []).filter(p => p && p.v != null);
    if (eq.length) return +eq[eq.length - 1].v;
    return null;
  };
  SD.dayTradeSessionLabel = function (dt) {
    const s = (dt && dt.session_date) || '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return (dt && dt.status === 'waiting_for_next_session') ? 'WAIT' : 'DAY';
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[+m[2] - 1] + ' ' + (+m[3]);
  };
  /* Bot vs S&P 500 (SPY), both as % change from the bot's session start (data.py day_trade.compare). Real data only. */
  SD.dayTradeCompareSVG = function (cmp, w, h) {
    if (!cmp) return '';
    const mins = t => { const m = /(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
    const prep = a => (a || []).map(p => ({ x: mins(p.t), y: +p.pct })).filter(p => p.x != null && !isNaN(p.y));
    const bot = prep(cmp.bot), spy = prep(cmp.spy);
    if (!bot.length && spy.length < 2) return '';
    const xs = bot.concat(spy).map(p => p.x), ys = bot.concat(spy).map(p => p.y).concat([0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), xr = x1 - x0 || 1;
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const mid = (lo + hi) / 2; if (hi - lo < 0.1) { lo = mid - 0.05; hi = mid + 0.05; }   // >=0.1pt range so tiny moves don't look huge
    const pad = 4, X = v => pad + (v - x0) / xr * (w - pad * 2), Y = v => pad + (1 - (v - lo) / (hi - lo)) * (h - pad * 2);
    const path = a => a.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('');
    let g = `<line x1="0" x2="${w}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#4f7f99" stroke-width="1" stroke-dasharray="3 4" opacity=".7" vector-effect="non-scaling-stroke"/>`;
    if (spy.length >= 2) g += `<path d="${path(spy)}" fill="none" stroke="#ffb547" stroke-width="1.6" opacity=".95" vector-effect="non-scaling-stroke"/>`;
    if (bot.length >= 2) g += `<path d="${path(bot)}" fill="none" stroke="#5fd8ff" stroke-width="2" filter="drop-shadow(0 0 3px #5fd8ff)" vector-effect="non-scaling-stroke"/>`;
    const lb = bot[bot.length - 1];
    if (lb) g += `<circle cx="${X(lb.x).toFixed(1)}" cy="${Y(lb.y).toFixed(1)}" r="2.6" fill="#5fd8ff"/>`;
    return `<svg class="dt-chart dt-cmp" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" aria-label="Bot vs S&amp;P 500, % change since session start">${g}</svg>`;
  };
  SD.dayTradeLegendHTML = function (cmp) {
    if (!cmp) return '';
    const f = v => v == null || isNaN(+v) ? '' : ` <b class="${SD.cls(+v)}">${(+v >= 0 ? '+' : '') + (+v).toFixed(2)}%</b>`;
    const hasBot = (cmp.bot || []).length > 0, hasSpy = (cmp.spy || []).length >= 2;
    if (!hasBot && !hasSpy) return '';
    return `<span class="dt-legend" title="% change since the bot's session start${cmp.start_t ? ' (' + esc(cmp.start_t) + ' ET)' : ''}${cmp.spy_source ? '; S&amp;P 500 = SPY, ' + esc(cmp.spy_source) : ''}">${hasBot ? `<span class="lg lg-bot"><i></i>Bot${f(cmp.bot_pct)}</span>` : ''}${hasSpy ? `<span class="lg lg-spy"><i></i>S&amp;P 500${f(cmp.spy_pct)}</span>` : ''}${cmp.start_t ? `<span class="lg-since">since ${esc(cmp.start_t)}</span>` : ''}</span>`;
  };
  SD.dtMarkets = { '1': 'NASDAQ', '2': 'NYSE' };
  SD.dtTraderTag = tr => tr ? `T${tr}${SD.dtMarkets[tr] ? ' · ' + SD.dtMarkets[tr] : ''}` : '';
  SD.dayTradeTradingHTML = function (dt) {
    const ops = (dt.open_positions || []).filter(p => p && p.symbol && p.trader);
    const per = ['1', '2'].map(tr => ops.find(p => p.trader === tr)).filter(Boolean);
    if (String(dt.side || 'flat').toLowerCase() !== 'flat' && per.length === 2) {   // both traders hold positions
      return `<div class="dt-trading" title="${esc(ops.map(p => p.symbol + ' (' + SD.dtTraderTag(p.trader) + ')').join(', '))}">Trading ${per.map(p => `<b class="dt-tk">${esc(p.symbol)}</b> <span class="dt-trtag">${esc(SD.dtTraderTag(p.trader))}</span> <span class="dt-sd side-${esc(p.side || 'long')}">${esc(String(p.side || '').toUpperCase())}</span>`).join(' <span class="dt-plus">+</span> ')}</div>`;
    }
    const side = String(dt.side || 'flat').toLowerCase();
    if (side !== 'flat' && dt.symbol) {
      const more = (dt.open_positions || []).filter(p => p && p.symbol && p.symbol !== dt.symbol);
      return `<div class="dt-trading" title="${esc(['Open: ' + dt.symbol].concat(more.map(p => p.symbol)).join(', '))}">Trading <b class="dt-tk">${esc(dt.symbol)}</b>${dt.name ? ` · <span class="dt-nm">${esc(dt.name)}</span>` : ''} · <span class="dt-sd side-${esc(side)}">${esc(side.toUpperCase())}</span>${more.length ? ` <span class="dt-more">+${more.map(p => esc(p.symbol)).join(' +')}</span>` : ''}</div>`;
    }
    const last = dt.last_traded;
    if (last) {
      const nm = dt.symbol && dt.name && String(dt.symbol).toUpperCase() === String(last).toUpperCase() ? dt.name : '';
      return `<div class="dt-trading">Last <b class="dt-tk">${esc(last)}</b>${nm ? ` · <span class="dt-nm">${esc(nm)}</span>` : ''} · <span class="dt-sd side-flat">flat</span></div>`;
    }
    return `<div class="dt-trading"><span class="dt-sd side-flat">Flat</span></div>`;
  };
  /* Light "frosted card" day-trade footer: live trade card + TOP CLOSES. Real data only (data.py day_trade). */
  SD.dtMins = t => { const m = /(?:T|^)(\d{1,2}):(\d{2})/.exec(String(t || '')); return m ? +m[1] * 60 + +m[2] : null; };
  /* Candlestick chart of the traded stock (5m) with the bot's real B/S fills; optional thin gold SPY session line.
     o: { upto: draw only bars with time <= upto (replay), last, spy: [{t,pct}], label } */
  SD.dtCandlesInner = function (bars, trades, o) {
    o = o || {};
    bars = (bars || []).filter(b => b && b.o != null && b.h != null && b.l != null && b.c != null && SD.dtMins(b.t) != null);
    if (!bars.length) return '';
    const w = 600, h = 100, padR = 13, padL = 1, padY = 9;
    const x0 = SD.dtMins(bars[0].t), x1 = SD.dtMins(bars[bars.length - 1].t) + 5, xr = x1 - x0 || 1;
    const fills = (trades || []).filter(t => t && t.price != null && SD.dtMins(t.t) != null);
    const lo = Math.min(...bars.map(b => +b.l), ...fills.map(t => +t.price)), hi = Math.max(...bars.map(b => +b.h), ...fills.map(t => +t.price)), r = hi - lo || 1;
    const X = m => padL + (m - x0) / xr * (100 - padL - padR);         // percent of width
    const Yp = v => padY + (1 - (v - lo) / r) * (100 - padY * 2);       // percent of height
    const upto = o.upto != null ? o.upto : Infinity;
    const shown = bars.filter(b => SD.dtMins(b.t) <= upto);
    const slot = (100 - padL - padR) / Math.max(bars.length, 1), bw = Math.max(0.25, Math.min(1.1, slot * 0.62));
    let g = '';
    if (o.spy && o.spy.length >= 2) {   // whole-session S&P 500 (SPY) %, own scale, thin gold
      const sp = o.spy.filter(p => SD.dtMins(p.t) != null && SD.dtMins(p.t) <= upto);
      const vs = o.spy.map(p => +p.pct); let a = Math.min(...vs), z = Math.max(...vs); if (z - a < 0.1) { const m = (a + z) / 2; a = m - 0.05; z = m + 0.05; }
      if (sp.length >= 2) g += `<path d="${sp.map((p, i) => (i ? 'L' : 'M') + (X(SD.dtMins(p.t) + 2.5) * w / 100).toFixed(1) + ',' + ((padY + (1 - (+p.pct - a) / (z - a)) * (100 - padY * 2)) * h / 100).toFixed(1)).join('')}" fill="none" stroke="#e3a21a" stroke-width="1.2" opacity=".75" vector-effect="non-scaling-stroke"/>`;
    }
    shown.forEach(b => {
      const xc = X(SD.dtMins(b.t) + 2.5) * w / 100, up = +b.c >= +b.o, col = up ? '#1fb889' : '#f06a7f';
      g += `<line x1="${xc.toFixed(2)}" y1="${(Yp(+b.h) * h / 100).toFixed(2)}" x2="${xc.toFixed(2)}" y2="${(Yp(+b.l) * h / 100).toFixed(2)}" stroke="${col}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      const y1 = Yp(Math.max(+b.o, +b.c)) * h / 100, y2 = Yp(Math.min(+b.o, +b.c)) * h / 100;
      g += `<rect x="${(xc - bw * w / 200).toFixed(2)}" y="${y1.toFixed(2)}" width="${(bw * w / 100).toFixed(2)}" height="${Math.max(0.8, y2 - y1).toFixed(2)}" fill="${col}"/>`;
    });
    let html = '';
    const lastBar = shown[shown.length - 1];
    const last = o.last != null && o.upto == null ? +o.last : lastBar ? +lastBar.c : null;
    if (last != null) {
      const ly = Yp(last);
      g += `<line x1="0" x2="${w}" y1="${(ly * h / 100).toFixed(1)}" y2="${(ly * h / 100).toFixed(1)}" stroke="#9aa3c7" stroke-width="1" stroke-dasharray="1.5 3" vector-effect="non-scaling-stroke"/>`;
      html += `<span class="dtc-tag ${last >= +bars[0].o ? 'up' : 'down'}" style="top:${ly.toFixed(1)}%">${esc(SD.price(last))}</span>`;
    }
    fills.filter(t => SD.dtMins(t.t) <= upto).forEach(t => {   // exact time + price of each fill
      const m = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(t.t) || [], mins = SD.dtMins(t.t) + (+(m[3] || 0)) / 60;
      const buy = String(t.side).toUpperCase().startsWith('B');
      html += `<span class="mk ${buy ? 'b' : 's'}${o.upto != null ? ' pop' : ''}" style="left:${X(mins).toFixed(2)}%;top:${Yp(+t.price).toFixed(2)}%" title="${t.trader ? esc(SD.dtTraderTag(t.trader)) + ' · ' : ''}${buy ? 'BUY' : 'SELL'} ${esc(t.qty != null ? (+t.qty).toLocaleString('en-US') + ' ' : '')}${esc(t.symbol)} @ ${esc(SD.price(+t.price))} · ${esc((m[1] || '') + ':' + (m[2] || ''))} ET${t.pnl != null ? ' · P&amp;L ' + esc(SD.usd(+t.pnl)) : ''}">${buy ? `<i>▲</i><b${t.trader ? ' class="tr"' : ''}>B${esc(t.trader || '')}</b>` : `<b${t.trader ? ' class="tr"' : ''}>S${esc(t.trader || '')}</b><i>▼</i>`}<em>${esc(SD.price(+t.price))}</em></span>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${g}</svg>${html}${o.label ? `<span class="dtc-clabel">${o.label}</span>` : ''}`;
  };
  SD.dtFillsFor = (trades, sym, day) => (trades || []).filter(t => t && t.symbol === String(sym || '').toUpperCase() && (!day || String(t.t).startsWith(day)));
  SD.dtChartHTML = function (dt) {
    const sym = String(dt.symbol || '').toUpperCase(), day = dt.session_date;
    const inner = SD.dtCandlesInner(dt.bars, SD.dtFillsFor(dt.trades, sym, day), { last: dt.last, spy: (dt.compare || {}).spy_session,
      label: `<b class="live-dot"></b>LIVE · ${esc(SD.dayTradeSessionLabel(dt))} · ${esc(sym)} · 5m` });
    return inner ? `<div class="dtc-chart">${inner}</div>` : '';
  };
  /* Replay: candles drawn one by one, fills pop in at their real times, running P&L; loops. State survives re-renders. */
  SD.dtReplayState = { key: null, t0: 0, n: -1 };
  SD.dtReplayLabel = rp => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rp.date || ''); return m ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1] + ' ' + (+m[3]) : (rp.date || ''); };
  SD.dtReplayPnl = function (rp, upto) {
    const start = rp.starting_equity != null ? +rp.starting_equity : null;
    const eq = (rp.equity || []).filter(p => p && p.v != null && SD.dtMins(p.t) != null && SD.dtMins(p.t) <= upto);
    if (start != null && (rp.equity || []).length) return eq.length ? +eq[eq.length - 1].v - start : 0;
    return (rp.trades || []).filter(t => t.pnl != null && SD.dtMins(t.t) <= upto).reduce((s, t) => s + +t.pnl, 0);
  };
  SD.dtReplayTick = function () {
    const el = document.querySelector('.dtc-chart[data-replay]');
    const rp = SD.data && SD.data.day_trade && SD.data.day_trade.mode === 'replay' && SD.data.day_trade.replay;
    if (!el || !rp || !(rp.bars || []).length) return;
    const st = SD.dtReplayState, key = rp.date + '|' + rp.symbol + '|' + rp.bars.length;
    if (st.key !== key) { st.key = key; st.t0 = performance.now(); st.n = -1; }
    const N = rp.bars.length, drawMs = Math.max(8000, Math.min(16000, N * 160)), holdMs = 3500;
    const t = (performance.now() - st.t0) % (drawMs + holdMs), n = Math.min(N, Math.floor(t / drawMs * N) + 1);
    if (n === st.n && el.firstChild) return;
    st.n = n;
    const upto = SD.dtMins(rp.bars[n - 1].t) + (n === N ? 1440 : 4.99);
    el.innerHTML = SD.dtCandlesInner(rp.bars, SD.dtFillsFor(rp.trades, rp.symbol, rp.date), { upto, label: `REPLAY · ${esc(SD.dtReplayLabel(rp).toUpperCase())} · ${esc(rp.symbol)} · ${esc(rp.bars[n - 1].t)} ET` });
    const pnl = SD.dtReplayPnl(rp, upto), pe = document.querySelector('.dtc-rp-pnl');
    if (pe) { pe.textContent = (pnl >= 0 ? '+' : '−') + SD.usd(Math.abs(pnl)); pe.className = 'dtc-rp-pnl ' + SD.cls(pnl); }
  };
  if (typeof setInterval === 'function' && typeof document !== 'undefined' && document.querySelector) setInterval(SD.dtReplayTick, 90);
  SD.dtLegendHTML = function (cmp) {
    if (!cmp) return '';
    const f = v => v == null || isNaN(+v) ? '—' : `<b class="${SD.cls(+v)}">${(+v >= 0 ? '+' : '−') + Math.abs(+v).toFixed(2)}%</b>`;
    const sess = (cmp.spy_session || []).length >= 2, since = (cmp.bot || []).length > 0 && (cmp.spy || []).length >= 2;
    if (!sess && !since) return '';
    return `<div class="dtc-legend" title="Gold line: SPY % from the 9:30 open (own scale). Bot vs S&amp;P: % change since the bot's session start${cmp.start_t ? ' (' + esc(cmp.start_t) + ' ET)' : ''}${cmp.spy_source ? '. SPY: ' + esc(cmp.spy_source) : ''}">${sess ? `<span class="lg spy"><i></i>S&amp;P 500 ${f(cmp.spy_session_pct)} today</span>` : ''}${since ? `<span class="lg cmp">since ${esc(cmp.start_t)}: Bot ${f(cmp.bot_pct)} vs S&amp;P ${f(cmp.spy_pct)}</span>` : ''}</div>`;
  };
  SD.dtTopClosesHTML = function (dt) {
    const closed = (dt.trades || []).filter(t => t && t.closed && t.pnl != null && !isNaN(+t.pnl));
    const top = closed.slice().sort((a, b) => +b.pnl - +a.pnl).slice(0, 3);
    const total = closed.reduce((s, t) => s + +t.pnl, 0);
    const mx = Math.max(1e-9, ...top.map(t => Math.abs(+t.pnl)));
    const sgn = v => (v >= 0 ? '+' : '−') + SD.usd(Math.abs(v));
    let rows = top.map(t => `<div class="tc-row"><b class="tc-tk">${esc(t.symbol)}${t.trader ? `<span class="tc-tr">${esc(SD.dtTraderTag(t.trader))}</span>` : ''}</b><span class="tc-bar"><i class="${+t.pnl >= 0 ? 'up' : 'down'}" style="width:${Math.max(6, Math.abs(+t.pnl) / mx * 100).toFixed(0)}%"></i></span><span class="tc-usd ${+t.pnl >= 0 ? 'up' : 'down'}">${sgn(+t.pnl)}</span></div>`).join('');
    for (let i = top.length; i < 3; i++) rows += `<div class="tc-row tc-empty"><span class="tc-dots"></span></div>`;
    return `<div class="dtc-card dtc-closes">
      <div class="dtc-head"><span class="dtc-cap">TOP CLOSES</span><span class="tc-total ${closed.length ? (total >= 0 ? 'up' : 'down') : 'flat'}" title="realized P&amp;L of all ${closed.length} closed trade(s)">${closed.length ? sgn(total) : '—'}</span></div>
      ${rows}
      <div class="tc-note">${closed.length ? `${closed.length} closed trade${closed.length > 1 ? 's' : ''} · realized` : 'no closed trades yet'}${(dt.trades || []).some(t => t && t.trader) ? ' · <b class="tc-key">T1 NASDAQ · T2 NYSE</b>' : ''}</div>
    </div>`;
  };
  SD.footHTML = function (d) {
    const dt = (d && d.day_trade) || {};
    const bars = dt.bars || [];
    const waiting = !bars.length || dt.status === 'waiting_for_next_session';
    const side = String(dt.side || 'flat').toLowerCase();
    const start = dt.starting_equity != null && !isNaN(+dt.starting_equity) ? +dt.starting_equity : 100000;
    let bal = SD.dayTradeBalance(dt);
    if (bal == null && waiting) bal = start;
    const gain = bal != null ? bal - start : null;
    const dir = gain == null || Math.abs(gain) < 0.005 ? 'flat' : gain > 0 ? 'up' : 'down';
    const whole = bal == null ? '—' : '$' + Math.trunc(bal).toLocaleString('en-US');
    const cents = bal == null ? '' : '.' + Math.round(Math.abs(bal % 1) * 100).toString().padStart(2, '0').slice(-2);
    const pos = dt.position;
    const uDir = pos ? SD.cls(pos.unrealized_usd) : 'flat';
    const pill = (dt.mode === 'replay' && dt.replay) ? '<span class="dtc-pill replay">REPLAY</span>' : side === 'long' ? '<span class="dtc-pill long">LONG</span>' : side === 'short' ? '<span class="dtc-pill short">SHORT</span>' : '<span class="dtc-pill flat">FLAT</span>';
    const mode = dt.mode || (bars.length && side !== 'flat' ? 'live' : 'waiting'), rp = dt.replay;
    const chart = mode === 'replay' && rp ? `<div class="dtc-chart dtc-replay" data-replay="1">${SD.dtCandlesInner(rp.bars, SD.dtFillsFor(rp.trades, rp.symbol, rp.date), { upto: -1, label: `REPLAY · ${esc(SD.dtReplayLabel(rp).toUpperCase())} · ${esc(rp.symbol)}` })}</div>`
      : mode === 'live' ? SD.dtChartHTML(dt) : '';
    const sub = waiting ? 'waiting for next session (9:30 AM ET)' : `${dt.symbol ? esc(dt.symbol) + ' ' : ''}${dt.last != null ? SD.price(+dt.last) : ''} <span class="${SD.cls(dt.change_pct)}">${dt.change_pct != null ? SD.pct(dt.change_pct) : ''}</span> today${dt.session_date ? ' · ' + esc(SD.dayTradeSessionLabel(dt)) : ''}`;
    return `<div class="dtc-wrap">
      <div class="dtc-card dtc-trade">
        <div class="dtc-team">DAY TRADING TEAM</div>
        <div class="dtc-head">${SD.dayTradeTradingHTML(dt)}${pill}</div>
        <div class="dtc-mid">
          <div class="dtc-eq">
            <div class="dt-balance dtc-bal ${dir}" title="paper equity"><span class="w">${whole}</span><span class="c">${cents}</span></div>
            <div class="dtc-gain"><span class="tri ${dir}">${dir === 'down' ? '▼' : '▲'}</span><b class="${dir}">${gain == null ? '—' : (gain >= 0 ? '+' : '−') + SD.usd(Math.abs(gain))}</b><span class="from">from ${SD.usd(start, 0)}</span><span class="paper">paper</span></div>
          </div>
          ${mode === 'replay' && rp ? `<div class="dtc-unr">
            <div class="dtc-cap">REPLAY P&amp;L · ${esc(SD.dtReplayLabel(rp))}</div>
            <div class="dtc-unr-row"><b class="dtc-rp-pnl flat">$0.00</b></div>
            <div class="dtc-mut">${esc(rp.symbol)}${rp.name ? ' · ' + esc(rp.name) : ''} · ${(rp.trades || []).length} fill${(rp.trades || []).length === 1 ? '' : 's'}</div>
          </div>` : `<div class="dtc-unr">
            <div class="dtc-cap">UNREALIZED${pos ? ' · ' + esc(pos.symbol) : ''}</div>
            <div class="dtc-unr-row"><b class="${uDir}">${pos ? (pos.unrealized_usd >= 0 ? '+' : '−') + SD.usd(Math.abs(pos.unrealized_usd)) : '—'}</b><b class="pct ${uDir}">${pos ? SD.pct(pos.unrealized_pct) : ''}</b></div>
            <div class="dtc-mut">${pos ? `${(+pos.qty).toLocaleString('en-US')} sh @ ${SD.price(+pos.entry)} → ${SD.price(+pos.last)}` : 'no open position'}</div>
          </div>`}
        </div>
        ${chart || `<div class="dtc-chart dtc-chart-empty">Stock Day Trader · waiting for next session (9:30 AM ET)</div>`}
        <div class="dtc-foot">${mode === 'replay' && rp ? `<span class="dtc-mut">bot is not in a trade · replaying the last session with trades · <span class="mk-key b">▲B</span> buy <span class="mk-key s">S▼</span> sell</span>` : mode === 'live' ? `<span class="dtc-mut">${sub}</span>${SD.dtLegendHTML(dt.compare)}` : `<span class="dtc-mut">no past session with trades yet</span>`}</div>
      </div>
      ${SD.dtTopClosesHTML(dt)}
    </div>`;
  };

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
