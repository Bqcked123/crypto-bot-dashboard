/* GitHub Pages data loader.
   Live data lives on the repo's "data" branch (pushed by the box every few minutes; no Pages rebuild needed).
   Every 60s (only while the tab is visible): ask the GitHub API for the data branch's latest commit (ETag-revalidated,
   so unchanged polls are cheap 304s), then fetch data.json at that exact commit from raw.githubusercontent.com
   (a new URL per update, so no stale CDN copy). If the API is unavailable/rate-limited, fall back to the branch URL
   with a cache-busting param (CDN may lag up to ~5 min), and finally to the snapshot bundled with the page. */
(function () {
  if (!window.SD) return;
  const BASE = 'https://raw.githubusercontent.com/Bqcked123/crypto-bot-dashboard/';
  SD.API_URL = 'https://api.github.com/repos/Bqcked123/crypto-bot-dashboard/branches/data';
  SD.REMOTE_URL = BASE + 'data/data.json';
  SD.SNAPSHOT_URL = 'data.json';
  SD.DATA_URL = SD.REMOTE_URL;
  SD.POLL_MS = 60000;
  const json = r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  const bust = u => u + (u.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
  SD.start = function (render) {
    let first = true, lastSha = null, busy = false;
    const show = (d, src) => { SD.data = d; SD.dataSource = src; render(d, first); first = false;
      document.documentElement.classList.remove('sd-nodata'); document.documentElement.dataset.source = src; };
    const viaApi = () => fetch(SD.API_URL, { cache: 'no-cache' }).then(json).then(b => {
      const sha = b && b.commit && b.commit.sha; if (!sha) throw new Error('no sha');
      if (sha === lastSha && SD.dataSource === 'live') return;      // nothing new
      return fetch(BASE + sha + '/data.json').then(json).then(d => { lastSha = sha; show(d, 'live'); });
    });
    const viaBranch = () => fetch(bust(SD.REMOTE_URL), { cache: 'no-store' }).then(json).then(d => {
      if (SD.data && SD.dataSource === 'live' && d.generated_at && SD.data.generated_at && d.generated_at < SD.data.generated_at) return;
      show(d, 'live');
    });
    const viaSnapshot = () => fetch(bust(SD.SNAPSHOT_URL), { cache: 'no-store' }).then(json).then(d => show(d, 'snapshot'));
    const tick = () => {
      if (busy || (!first && document.hidden)) return; busy = true;
      viaApi().catch(e => { console.warn('GitHub API check failed, trying data branch URL:', e && e.message); return viaBranch(); })
        .catch(e => {
          console.warn('live data not reachable:', e && e.message);
          if (SD.dataSource === 'live') return;                     // keep the newer live data already on screen
          return viaSnapshot().catch(e2 => { console.warn('snapshot data.json not available', e2 && e2.message);
            document.documentElement.classList.add('sd-nodata'); if (first) { render(SD.empty(), true); first = false; } });
        })
        .finally(() => { busy = false; });
    };
    tick(); setInterval(tick, SD.POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  };
})();
