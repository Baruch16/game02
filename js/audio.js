// Procedural WebAudio sound engine (no asset files).
class AudioEngine {
  constructor() { this.ctx = null; this.vol = 0.7; this.engine = null; this.loops = {}; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    // shared noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // brown noise buffer for rumble
    this.brown = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const b = this.brown.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
  }

  setVolume(v) { this.vol = v; if (this.master) this.master.gain.value = v; }

  _noiseSrc(buf = this.noise, loop = false) {
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s;
  }

  // ---------------------------------------------------------- engine loop
  startEngine() {
    if (!this.ctx || this.engine) return;
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const rumble = this._noiseSrc(this.brown, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    rumble.connect(lp); lp.connect(out);
    const hiss = this._noiseSrc(this.noise, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    const hissG = c.createGain(); hissG.gain.value = 0.12;
    hiss.connect(bp); bp.connect(hissG); hissG.connect(out);
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 90;
    const oscG = c.createGain(); oscG.gain.value = 0.025;
    const oscLp = c.createBiquadFilter(); oscLp.type = 'lowpass'; oscLp.frequency.value = 600;
    osc.connect(oscLp); oscLp.connect(oscG); oscG.connect(out);
    // wind (speed)
    const wind = this._noiseSrc(this.noise, true);
    const wf = c.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 600;
    const wg = c.createGain(); wg.gain.value = 0;
    wind.connect(wf); wf.connect(wg); wg.connect(this.master);
    rumble.start(); hiss.start(); osc.start(); wind.start();
    this.engine = { out, lp, bp, osc, hissG, wg, wf, srcs: [rumble, hiss, osc, wind] };
    out.gain.setTargetAtTime(0.5, c.currentTime, 0.5);
  }

  updateEngine(throttle, boost, speedFrac) {
    if (!this.engine) return;
    const e = this.engine, t = this.ctx.currentTime;
    e.lp.frequency.setTargetAtTime(250 + throttle * 450 + (boost ? 500 : 0), t, 0.1);
    e.bp.frequency.setTargetAtTime(1200 + throttle * 1500 + (boost ? 1500 : 0), t, 0.1);
    e.hissG.gain.setTargetAtTime(0.06 + throttle * 0.1 + (boost ? 0.18 : 0), t, 0.1);
    e.osc.frequency.setTargetAtTime(70 + throttle * 60 + (boost ? 40 : 0), t, 0.2);
    e.wg.gain.setTargetAtTime(Math.min(0.25, speedFrac * speedFrac * 0.18), t, 0.2);
    e.wf.frequency.setTargetAtTime(400 + speedFrac * 1200, t, 0.2);
  }

  stopEngine() {
    if (!this.engine) return;
    const e = this.engine; this.engine = null;
    e.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    e.wg.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    setTimeout(() => e.srcs.forEach(s => { try { s.stop(); } catch (_) {} }), 1500);
  }

  // ---------------------------------------------------------- one-shots
  gunBurst(heavy = false, laser = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    if (laser) {
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(1800, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
      const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.1); return;
    }
    const s = this._noiseSrc();
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 500 : 900; f.Q.value = 1.2;
    const g = c.createGain(); g.gain.setValueAtTime(heavy ? 0.5 : 0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.12 : 0.06));
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + 0.15);
  }

  missileLaunch() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSrc();
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2500, t + 0.4); f.frequency.exponentialRampToValueAtTime(800, t + 1.4);
    const g = c.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.6, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 1.6);
  }

  explosion(dist = 0, big = false) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + Math.min(1.5, dist / 900);
    const vol = Math.max(0.05, 1 - dist / 6000) * (big ? 1.2 : 0.8);
    const s = this._noiseSrc(this.brown);
    const f = c.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(big ? 1600 : 1000, t); f.frequency.exponentialRampToValueAtTime(80, t + (big ? 2.5 : 1.5));
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + (big ? 3 : 1.8));
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 3.2);
    const s2 = this._noiseSrc();
    const g2 = c.createGain(); g2.gain.setValueAtTime(vol * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    s2.connect(g2); g2.connect(this.master); s2.start(t); s2.stop(t + 0.35);
  }

  hit() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSrc();
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = c.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + 0.12);
  }

  thunder() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + 0.3 + Math.random() * 1.5;
    const s = this._noiseSrc(this.brown);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = c.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.9, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 4);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 4.2);
  }

  flare() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.07;
      const s = this._noiseSrc();
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 2;
      const g = c.createGain(); g.gain.setValueAtTime(0.2, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(tt, Math.random()); s.stop(tt + 0.15);
    }
  }

  beep(freq = 1000, dur = 0.08, vol = 0.12, type = 'sine') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  // continuous tone loops (lock tone, missile warning)
  setTone(name, on, freq = 1200, vol = 0.08, type = 'sine') {
    if (!this.ctx) return;
    const L = this.loops[name];
    if (on && !L) {
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = this.ctx.createGain(); g.gain.value = vol;
      o.connect(g); g.connect(this.master); o.start();
      this.loops[name] = { o, g };
    } else if (!on && L) {
      L.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      const o = L.o; setTimeout(() => { try { o.stop(); } catch (_) {} }, 200);
      delete this.loops[name];
    } else if (on && L) {
      L.o.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01);
    }
  }
  stopAllTones() { Object.keys(this.loops).forEach(k => this.setTone(k, false)); }

  click() { this.beep(1400, 0.03, 0.06, 'square'); }
  buy() { this.beep(880, 0.07, 0.1, 'triangle'); setTimeout(() => this.beep(1320, 0.12, 0.1, 'triangle'), 80); }
  deny() { this.beep(180, 0.15, 0.12, 'square'); }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 0.12, 'triangle'), i * 110)); }
}

export const audio = new AudioEngine();
