/**
 * Synthesised stand-ins for every instrument in the score. These were the
 * whole band before the recordings arrived; now each one plays only while its
 * instrument's samples are still loading, or if they failed to load.
 *
 * Each voice writes into the node it is given (an instrument's `synth` bus
 * input), so it gets the same EQ, reverb send and place in the mix as the
 * recording it stands in for.
 */

export class Synth {
  private plucks = new Map<number, AudioBuffer>();

  constructor(
    private ctx: BaseAudioContext,
    private noise: AudioBuffer,
  ) {}

  private noiseSrc(t: number, dur: number): AudioBufferSourceNode {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return src;
  }

  /** Low drum. `pitch` below 1 is the big odaiko. */
  taiko(dest: AudioNode, t: number, vel: number, pitch: number): void {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = Math.min(1.4, vel);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(50 * pitch, t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.85, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / pitch);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.6 / pitch);
    // Stick attack: a short thud of filtered noise.
    const n = this.noiseSrc(t, 0.06);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400 * pitch;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(f);
    f.connect(ng);
    ng.connect(out);
    out.connect(dest);
  }

  /** Rim click. */
  ka(dest: AudioNode, t: number, vel: number): void {
    const ctx = this.ctx;
    const n = this.noiseSrc(t, 0.04);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3100;
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 1.8, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
  }

  shaker(dest: AudioNode, t: number, vel: number): void {
    const ctx = this.ctx;
    const n = this.noiseSrc(t, 0.035);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.24, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
  }

  bass(dest: AudioNode, t: number, freq: number, dur: number, vel: number, cutoff: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 5;
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(170, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.28, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const type of ['sawtooth', 'square'] as OscillatorType[]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    f.connect(g);
    g.connect(dest);
  }

  /** Karplus-Strong plucked string, rendered once per pitch and cached. */
  private pluckBuffer(midi: number, freq: number): AudioBuffer {
    const hit = this.plucks.get(midi);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const n = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * 1.5);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // Soften the pick so it reads as silk string rather than steel.
    for (let i = 1; i < n; i++) d[i] = d[i] * 0.6 + d[i - 1] * 0.4;
    d[n] = d[0] * 0.996;
    for (let i = n + 1; i < len; i++) d[i] = (d[i - n] + d[i - n - 1]) * 0.498;
    // Low strings are still ringing when the buffer ends; fade the tail so it never clicks.
    const fade = Math.floor(len * 0.3);
    for (let i = len - fade; i < len; i++) d[i] *= (len - i) / fade;
    this.plucks.set(midi, buf);
    return buf;
  }

  pluck(dest: AudioNode, t: number, midi: number, freq: number, vel: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pluckBuffer(midi, freq);
    const g = ctx.createGain();
    g.gain.value = vel;
    src.connect(g);
    g.connect(dest);
    src.start(t);
  }

  /** Breathy lead: sine + soft octave, a scoop into the note, vibrato that blooms late, and air noise. */
  flute(dest: AudioNode, t: number, freq: number, dur: number, vel: number): void {
    const ctx = this.ctx;
    const end = t + dur;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.045);
    g.gain.setValueAtTime(vel * 0.5, Math.max(t + 0.05, end - 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.14);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.16);
    depth.gain.linearRampToValueAtTime(freq * 0.007, t + 0.42);
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(end + 0.2);

    const partials: [number, number][] = [[1, 1], [2, 0.22], [3, 0.07]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * mult * 0.965, t);
      o.frequency.exponentialRampToValueAtTime(freq * mult, t + 0.055);
      depth.connect(o.frequency);
      const pg = ctx.createGain();
      pg.gain.value = amp;
      o.connect(pg);
      pg.connect(g);
      o.start(t);
      o.stop(end + 0.2);
    }

    const air = this.noiseSrc(t, dur + 0.2);
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = freq * 2;
    bf.Q.value = 5;
    const ag = ctx.createGain();
    ag.gain.setValueAtTime(0.5, t);
    ag.gain.exponentialRampToValueAtTime(0.14, t + 0.12);
    air.connect(bf);
    bf.connect(ag);
    ag.connect(g);

    g.connect(dest);
  }

  pad(dest: AudioNode, t: number, freqs: number[], dur: number, vel: number): void {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1100;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.11, t + Math.min(0.5, dur * 0.3));
    g.gain.setValueAtTime(vel * 0.11, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    for (const freq of freqs) {
      for (const detune of [-8, 8]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.6);
      }
    }
    f.connect(g);
    g.connect(dest);
  }

  gong(dest: AudioNode, t: number, vel: number): void {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = vel;
    const partials: [number, number, number][] = [
      [82, 0.5, 4.5],
      [165, 0.3, 3.4],
      [226, 0.2, 2.6],
      [320, 0.14, 1.8],
      [443, 0.09, 1.2],
    ];
    for (const [freq, amp, decay] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    out.connect(dest);
  }
}
