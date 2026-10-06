/* GitHub Pages data loader: live data.json from the repo's "data" branch (updated by the box every few minutes,
   no Pages rebuild needed), polled every 60s with a cache-busting param; falls back to the bundled snapshot. */
(function () {
  if (!window.SD) return;
  SD.REMOTE_URL = 'https://raw.githubusercontent.com/Bqcked123/crypto-bot-dashboard/data/data.json';
  SD.SNAPSHOT_URL = 'data.json';
  SD.DATA_URL = SD.REMOTE_URL;
  SD.POLL_MS = 60000;
  const get = u => fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now(), { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  SD.start = function (render) {
    let first = true;
    const show = (d, src) => { SD.data = d; SD.dataSource = src; render(d, first); first = false;
      document.documentElement.classList.remove('sd-nodata'); document.documentElement.dataset.source = src; };
    const tick = () => get(SD.REMOTE_URL).then(d => show(d, 'live')).catch(e => {
      console.warn('live data not reachable, using fallback', e && e.message);
      if (SD.dataSource === 'live') return;                       // keep the newer live data already on screen
      return get(SD.SNAPSHOT_URL).then(d => show(d, 'snapshot')).catch(e2 => {
        console.warn('snapshot data.json not available', e2 && e2.message);
        document.documentElement.classList.add('sd-nodata'); if (first) { render(SD.empty(), true); first = false; } });
    });
    tick(); setInterval(tick, SD.POLL_MS);
  };
})();
