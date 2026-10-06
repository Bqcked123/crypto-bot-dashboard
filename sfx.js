// SUIT sound effects: 100% synthesized at runtime with the Web Audio API (oscillators + filtered noise).
// No recorded, copied or downloaded audio. Starts muted; the choice is saved in localStorage ('suit_sound' = on/off).
// Browsers (phones especially) only allow audio after a user gesture, so the context is created on the first tap/click.
const KEY = 'suit_sound';
let ctx = null, master = null, noiseBuf = null, thr = null, muted = true;
try { muted = localStorage.getItem(KEY) !== 'on'; } catch (e) { /* storage blocked: stay muted */ }
const listeners = new Set();

function noise(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
const env = (g, t0, a, peak, dec, hold = 0) => { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.setValueAtTime(peak, t0 + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + hold + dec); };
function noiseSrc(c, t0, dur) { const s = c.createBufferSource(); s.buffer = noise(c); s.loop = true; s.start(t0, Math.random()); s.stop(t0 + dur + .05); return s; }
function osc(c, type, f, t0, dur) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); o.start(t0); o.stop(t0 + dur + .05); return o; }

// ---- one-shot voices: (context, destination, start time) ----
export const VOICES = {
  burst(c, dst, t0) { // deceleration blast: filtered noise sweeping down + low thump
    const n = noiseSrc(c, t0, 1), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = .8;
    bp.frequency.setValueAtTime(2600, t0); bp.frequency.exponentialRampToValueAtTime(380, t0 + .8); env(g, t0, .04, .55, .85); n.connect(bp).connect(g).connect(dst);
    const o = osc(c, 'sine', 90, t0, .6), og = c.createGain(); o.frequency.exponentialRampToValueAtTime(38, t0 + .5); env(og, t0, .02, .35, .5); o.connect(og).connect(dst);
  },
  clank(c, dst, t0) { // heavy metallic touchdown: body thump + inharmonic ringing partials + impact click
    const th = osc(c, 'sine', 150, t0, .5), tg = c.createGain(); th.frequency.exponentialRampToValueAtTime(42, t0 + .28); env(tg, t0, .005, 1, .42); th.connect(tg).connect(dst);
    [207, 331, 523, 846, 1311, 1987, 2871].forEach((f, i) => { const o = osc(c, i % 2 ? 'triangle' : 'sine', f * (1 + (Math.random() - .5) * .02), t0, 1.4), g = c.createGain();
      env(g, t0, .003, .26 / Math.sqrt(i + 1), 1.1 / (1 + i * .35)); o.connect(g).connect(dst); });
    const n = noiseSrc(c, t0, .12), hp = c.createBiquadFilter(), ng = c.createGain(); hp.type = 'highpass'; hp.frequency.value = 1400; env(ng, t0, .002, .5, .07); n.connect(hp).connect(ng).connect(dst);
    const lo = noiseSrc(c, t0, .4), lp = c.createBiquadFilter(), lg = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 260; env(lg, t0, .004, .7, .3); lo.connect(lp).connect(lg).connect(dst);
  },
  clink(c, dst, t0, k = 1) { // small armour-plate tick
    [2350 * k, 3610 * k, 5170 * k].forEach((f, i) => { const o = osc(c, 'sine', f, t0, .3), g = c.createGain(); env(g, t0, .002, .07 / (i + 1), .16 + Math.random() * .08); o.connect(g).connect(dst); });
  },
  servo(c, dst, t0, dur = .45, f0 = 380) { // settling servo whir
    const o = osc(c, 'sawtooth', f0, t0, dur), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 3.5;
    o.frequency.linearRampToValueAtTime(f0 * 2, t0 + dur * .45); o.frequency.linearRampToValueAtTime(f0 * 1.35, t0 + dur);
    const lfo = osc(c, 'sine', 31, t0, dur), lg = c.createGain(); lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
    env(g, t0, .04, .06, dur * .7, dur * .2); o.connect(bp).connect(g).connect(dst);
  },
  powerDown(c, dst, t0) { // thrusters spooling down
    const o = osc(c, 'triangle', 820, t0, .9), g = c.createGain(); o.frequency.exponentialRampToValueAtTime(90, t0 + .85); env(g, t0, .02, .07, .85); o.connect(g).connect(dst);
    const n = noiseSrc(c, t0, .9), lp = c.createBiquadFilter(), ng = c.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t0); lp.frequency.exponentialRampToValueAtTime(120, t0 + .8); env(ng, t0, .01, .25, .8); n.connect(lp).connect(ng).connect(dst);
  },
  launch(c, dst, t0) { // take-off roar: rising filtered noise + thump
    const n = noiseSrc(c, t0, 1.1), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = .7;
    bp.frequency.setValueAtTime(280, t0); bp.frequency.exponentialRampToValueAtTime(2200, t0 + .55); env(g, t0, .08, .6, .9, .15); n.connect(bp).connect(g).connect(dst);
    const o = osc(c, 'sine', 70, t0, .5), og = c.createGain(); o.frequency.exponentialRampToValueAtTime(140, t0 + .35); env(og, t0, .02, .4, .4); o.connect(og).connect(dst);
  },
  beep(c, dst, t0, hi = 1) { // soft UI confirm
    [[1046 * hi, 0], [1568 * hi, .075]].forEach(([f, d]) => { const o = osc(c, 'sine', f, t0 + d, .12), g = c.createGain(); env(g, t0 + d, .006, .08, .1); o.connect(g).connect(dst); });
  },
};

function thrusterLoop(c, dst) { // continuous jet: band-passed noise + hiss + sub rumble; driven by thrust(power, speed)
  const n = noiseSrc(c, c.currentTime, 1e6), bp = c.createBiquadFilter(), g = c.createGain(); bp.type = 'bandpass'; bp.Q.value = .6; bp.frequency.value = 500; g.gain.value = 0;
  const hs = c.createBiquadFilter(), hg = c.createGain(); hs.type = 'highpass'; hs.frequency.value = 3500; hg.gain.value = 0;
  const r = osc(c, 'sawtooth', 44, c.currentTime, 1e6), rl = c.createBiquadFilter(), rg = c.createGain(); rl.type = 'lowpass'; rl.frequency.value = 160; rg.gain.value = 0;
  n.connect(bp).connect(g).connect(dst); n.connect(hs).connect(hg).connect(dst); r.connect(rl).connect(rg).connect(dst);
  return { bp, g, hg, r, rg };
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .7;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp).connect(ctx.destination);
  thr = thrusterLoop(ctx, master); return ctx;
}
const live = () => ctx && !muted && ctx.state === 'running';
const play = (name, delay = 0, ...a) => { if (!live()) return; VOICES[name](ctx, master, ctx.currentTime + delay, ...a); };

export const SFX = {
  get muted() { return muted; },
  get state() { return ctx ? ctx.state : 'none'; },
  onChange(fn) { listeners.add(fn); fn(muted); },
  setMuted(m) {
    muted = !!m; try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch (e) { }
    if (!muted) { ensure(); if (ctx && ctx.state !== 'running') ctx.resume(); }
    if (master) master.gain.setTargetAtTime(muted ? 0 : .7, ctx.currentTime, .05);
    listeners.forEach(fn => fn(muted));
  },
  toggle() { this.setMuted(!muted); },
  gesture() { if (!muted) { ensure(); if (ctx && ctx.state !== 'running') ctx.resume(); } },   // call from any user tap/click
  thrust(power, speed = 0) { if (!live() || !thr) return; const t = ctx.currentTime, p = Math.max(0, power);
    thr.g.gain.setTargetAtTime(Math.min(.34, p * .2 + speed * .05), t, .09); thr.bp.frequency.setTargetAtTime(320 + 700 * p + 600 * speed, t, .12);
    thr.hg.gain.setTargetAtTime(Math.min(.06, p * .035), t, .1); thr.r.frequency.setTargetAtTime(38 + 26 * p, t, .2); thr.rg.gain.setTargetAtTime(Math.min(.22, p * .14), t, .12); },
  burst() { play('burst'); }, clank() { play('clank'); },
  settle() { play('clink', .12, 1); play('clink', .27, 1.18); play('clink', .43, .9); play('servo', .2, .42, 360); play('servo', .62, .38, 470); },
  powerDown() { play('powerDown'); }, launch() { play('launch'); }, servo() { play('servo', 0, .3, 520); },
  beep(hi = 1) { play('beep', 0, hi); },
  // test helper: render each voice offline and report its peak level (proves the synth produces sound without a speaker)
  async selfTest() { const out = {}; for (const name of Object.keys(VOICES)) { const oc = new OfflineAudioContext(1, 44100 * 1.6, 44100); VOICES[name](oc, oc.destination, 0);
      const buf = await oc.startRendering(), d = buf.getChannelData(0); let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); out[name] = +pk.toFixed(3); } return out; },
};
