/**
 * Sound effects are synthesised with WebAudio: an oscillator or filtered-noise
 * burst with an envelope. The score, which plays recorded instruments from
 * public/audio, lives in music.ts.
 *
 * Browsers only allow audio after a user gesture, so nothing is created until
 * `unlock()` runs from a key press or click. Every call is safe before that.
 */
import type { ElementId } from '../game/types';
import { Music, createMasterChain, prefetchSamples, type CueName, type ScoreState, type TrackName } from './music';

type FilterKind = 'lowpass' | 'bandpass' | 'highpass';

const MUTE_KEY = 'bendstorm.muted';

/**
 * The medley Tyler works through, one note per shot, as semitones above middle C.
 * All traditional or long out of copyright: Happy Birthday, Twinkle Twinkle, Ode to Joy,
 * Mary Had a Little Lamb, Jingle Bells, Hot Cross Buns.
 */
const TUNES = [
  7, 7, 9, 7, 12, 11, 7, 7, 9, 7, 14, 12, 7, 7, 19, 16, 12, 11, 9, 17, 17, 16, 12, 14, 12,
  0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0,
  4, 4, 5, 7, 7, 5, 4, 2, 0, 0, 2, 4, 4, 2, 2,
  4, 2, 0, 2, 4, 4, 4, 2, 2, 2, 4, 7, 7,
  4, 4, 4, 4, 4, 4, 4, 7, 0, 2, 4,
  4, 2, 0, 4, 2, 0, 0, 0, 0, 0, 2, 2, 2, 2, 4, 2, 0,
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music: Music | null = null;
  private noise!: AudioBuffer;
  /** The piece that should be playing; applied as soon as audio is unlocked. */
  private wanted: TrackName = 'title';
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be unavailable (private windows); sound just starts unmuted.
    }
    // The music's samples can download before the first key press; only decoding has to wait for unlock().
    prefetchSamples();
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    // Compressor → limiter → soft ceiling; built in music/mix.ts so tests can render through it.
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(createMasterChain(ctx, ctx.destination));
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.music = new Music(ctx, this.master, this.noise);
    if (this.match) this.music.setMatch(this.match, this.key, this.bpm);
    else this.music.play(this.wanted, false, this.key, this.bpm);
  }

  private key = 0;
  private bpm = 132;

  /** The two benders of the match in progress, so audio unlocked mid-match can still start its score. */
  private match: [string, string] | null = null;

  /** Menu music. `transpose` (semitones) and `bpm` only matter for the plain battle theme. */
  setTrack(name: TrackName, restart = false, transpose = 0, bpm = 132): void {
    this.wanted = name;
    this.key = transpose;
    this.bpm = bpm;
    if (name === 'title') this.match = null;
    this.music?.play(name, restart, transpose, bpm);
  }

  /** Starts a match's score: both benders' themes, in the arena's key and tempo. */
  setMatch(elements: [string, string], transpose: number, bpm: number): void {
    this.wanted = 'battle';
    this.key = transpose;
    this.bpm = bpm;
    this.match = elements;
    this.music?.setMatch(elements, transpose, bpm);
  }

  /** Feeds the score a snapshot of the fight. Called every frame of a match. */
  score(state: ScoreState): void {
    this.music?.score(state);
  }

  /** A musical stinger for something that just happened (see CueName for whose index to pass). */
  cue(name: CueName, player: 0 | 1 = 0, power = 0): void {
    this.music?.cue(name, player, power);
  }

  /** Win fanfare in the winner's theme, which then hands over to the title theme. */
  victory(winner: 0 | 1 | null = null): void {
    this.wanted = 'title';
    this.match = null;
    this.music?.victory(winner);
  }

  duckMusic(on: boolean): void {
    this.music?.duck(on);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // Ignore: the preference just won't persist.
    }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.03);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(kind: FilterKind, f0: number, f1: number, dur: number, vol: number, q = 0.8, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = kind;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  jump(): void {
    this.tone('sine', 260, 540, 0.12, 0.1);
  }
  airJump(): void {
    this.tone('sine', 420, 860, 0.12, 0.1);
    this.burst('bandpass', 1500, 3200, 0.12, 0.07);
  }
  land(power: number): void {
    this.burst('lowpass', 420, 110, 0.12, Math.min(0.28, 0.05 + power / 110));
  }
  dash(): void {
    this.burst('bandpass', 800, 2600, 0.18, 0.16, 1.4);
  }
  swing(): void {
    this.burst('bandpass', 600, 1900, 0.15, 0.14, 1.2);
  }

  shoot(el: ElementId, big: boolean): void {
    const v = big ? 1.5 : 1;
    switch (el) {
      case 'fire':
        this.burst('bandpass', 950, 280, 0.24 * v, 0.2 * v, 0.7);
        this.tone('sawtooth', 220, 85, 0.16 * v, 0.05 * v);
        break;
      case 'water':
        this.tone('sine', 520, 190, 0.22 * v, 0.14 * v);
        this.burst('bandpass', 1300, 480, 0.22 * v, 0.1 * v, 2);
        break;
      case 'earth':
        this.tone('sine', 140, 48, 0.24 * v, 0.3);
        this.burst('lowpass', 520, 120, 0.22 * v, 0.2 * v);
        break;
      case 'air':
        this.burst('bandpass', 1900, 5200, 0.17 * v, 0.14 * v, 1.2);
        break;
      case 'lightning':
        this.burst('highpass', 3200, 6500, 0.12 * v, 0.2 * v);
        this.tone('sawtooth', 1900, 160, 0.1 * v, 0.1 * v);
        break;
      case 'metal':
        this.tone('triangle', 1500, 950, 0.16 * v, 0.14 * v);
        this.tone('square', 2230, 2230, 0.07 * v, 0.04 * v);
        break;
      case 'shadow':
        this.tone('sine', 190, 80, 0.3 * v, 0.2 * v);
        this.burst('bandpass', 420, 180, 0.3 * v, 0.1 * v, 2);
        break;
      case 'void':
        this.tone('sine', 70, 240, 0.26 * v, 0.24 * v);
        this.burst('bandpass', 260, 1400, 0.24 * v, 0.07 * v, 3);
        break;
      case 'cash':
        // A wad of bills leaving the hand.
        this.burst('highpass', 2600, 5200, 0.07 * v, 0.14 * v);
        this.burst('bandpass', 1400, 900, 0.1 * v, 0.08 * v, 2);
        break;
      case 'tyler':
        // The note itself is the sound (see tylerNote).
        break;
    }
  }

  /**
   * Tyler's Wrong Notes. Each shot plays the next note of a nursery-rhyme medley, on something
   * like a school recorder, reliably out of tune and now and then with a chord that helps nobody.
   */
  tylerNote(i: number): void {
    const semis = TUNES[i % TUNES.length];
    // Up to a quarter-tone off either way, and one time in six a whole semitone wrong.
    const sour = (Math.random() - 0.5) * 0.9 + (Math.random() < 0.17 ? (Math.random() < 0.5 ? 1 : -1) : 0);
    const f = 261.63 * Math.pow(2, (semis + sour) / 12);
    this.tone('square', f * 0.99, f, 0.2, 0.05);
    this.tone('sine', f * 2, f * 2.02, 0.18, 0.05);
    this.burst('bandpass', f * 2, f * 2, 0.1, 0.03, 6);
    if (Math.random() < 0.14) {
      // A "chord".
      this.tone('square', f * 1.06, f * 1.06, 0.22, 0.035);
      this.tone('square', f * 1.41, f * 1.41, 0.22, 0.03);
    }
  }
  /** Three detuned horns, dropping. */
  airhorn(): void {
    for (const f of [370, 466, 554]) {
      this.tone('sawtooth', f, f * 0.93, 0.55, 0.09);
      this.tone('sawtooth', f * 1.01, f * 0.94, 0.55, 0.07, 0.62);
    }
  }
  /** A grand piano meeting the floor: every key at once, then the strings ringing. */
  pianoCrash(): void {
    for (let i = 0; i < 12; i++) {
      const f = 55 * Math.pow(2, Math.random() * 5);
      this.tone('triangle', f, f * 0.98, 0.9 + Math.random() * 0.8, 0.07);
    }
    this.burst('lowpass', 3000, 120, 0.5, 0.5);
    this.tone('sine', 70, 28, 0.6, 0.5);
  }
  splat(): void {
    this.burst('lowpass', 900, 160, 0.16, 0.3);
    this.tone('sine', 190, 60, 0.12, 0.2);
  }
  squeak(): void {
    this.tone('sine', 1500, 2300, 0.07, 0.08);
    this.tone('sine', 2100, 1500, 0.07, 0.06, 0.07);
  }
  /** A cash register. */
  kaching(): void {
    this.tone('triangle', 1319, 1319, 0.1, 0.14);
    this.tone('triangle', 1976, 1976, 0.5, 0.14, 0.09);
    this.tone('sine', 2637, 2637, 0.6, 0.07, 0.09);
    this.burst('highpass', 6000, 8000, 0.12, 0.1, 0.8, 0.09);
  }
  /** An engine that costs more than the stage. */
  vroom(): void {
    this.tone('sawtooth', 70, 210, 0.75, 0.2);
    this.tone('square', 35, 105, 0.75, 0.14);
    this.burst('lowpass', 400, 1600, 0.75, 0.16);
  }

  /** A thunderclap: the crack, then the roll. */
  thunder(): void {
    this.burst('highpass', 2500, 5000, 0.09, 0.4);
    this.burst('lowpass', 2400, 90, 0.9, 0.5);
    this.tone('sine', 95, 30, 0.8, 0.45);
  }
  /** Metal on metal. */
  clang(): void {
    this.tone('triangle', 1180, 1120, 0.3, 0.2);
    this.tone('sine', 2710, 2650, 0.22, 0.09);
    this.burst('highpass', 4000, 6000, 0.04, 0.15);
  }
  /** Reality hiccups: teleports, swaps and portals. */
  warp(): void {
    this.tone('sine', 900, 140, 0.16, 0.16);
    this.tone('sine', 140, 1100, 0.2, 0.1, 0.05);
  }
  /** A singularity letting go. */
  implode(): void {
    this.tone('sine', 420, 28, 0.5, 0.5);
    this.burst('lowpass', 300, 4000, 0.18, 0.3, 0.8, 0.2);
    this.burst('lowpass', 5000, 80, 0.9, 0.5, 0.8, 0.36);
  }
  /** "Nyah-nyah": a cheeky little figure on a nasal square wave. */
  taunt(kind: number): void {
    const seq = kind === 2 ? [392, 330, 262] : kind === 1 ? [659, 659, 523, 659, 523] : [523, 440, 523, 440, 349];
    seq.forEach((f, i) => this.tone('square', f, f * (kind === 1 ? 0.9 : 1), kind === 2 ? 0.22 : 0.1, 0.06, i * (kind === 2 ? 0.2 : 0.115)));
  }

  hit(power: number): void {
    const p = Math.min(1, power / 45);
    this.tone('sine', 210, 44, 0.12 + p * 0.2, 0.3 + p * 0.4);
    this.burst('lowpass', 3200, 220, 0.09 + p * 0.1, 0.25 + p * 0.2);
    if (power > 26) this.tone('square', 95, 30, 0.38, 0.2);
  }

  shield(): void {
    this.tone('triangle', 1250, 900, 0.1, 0.15);
  }
  shieldBreak(): void {
    this.burst('highpass', 3200, 2400, 0.45, 0.3);
    this.tone('triangle', 1600, 700, 0.3, 0.2);
    this.tone('triangle', 1100, 400, 0.4, 0.15, 0.06);
  }
  parry(): void {
    this.tone('triangle', 1760, 2640, 0.2, 0.22);
    this.tone('sine', 2637, 2637, 0.35, 0.12);
    this.burst('highpass', 5000, 7000, 0.08, 0.12);
  }
  clash(): void {
    this.tone('triangle', 950, 300, 0.13, 0.2);
    this.burst('bandpass', 2400, 900, 0.12, 0.15, 1);
  }
  rumble(): void {
    this.tone('sine', 58, 92, 0.36, 0.25);
    this.burst('lowpass', 160, 260, 0.36, 0.2);
  }
  erupt(): void {
    this.burst('lowpass', 900, 80, 0.42, 0.45);
    this.tone('sine', 115, 34, 0.42, 0.5);
  }
  ko(): void {
    this.burst('lowpass', 6500, 80, 1.35, 0.6);
    this.tone('sine', 125, 24, 1.2, 0.6);
    this.tone('sawtooth', 1900, 190, 0.5, 0.1);
  }
  respawn(): void {
    this.tone('sine', 480, 980, 0.32, 0.12);
  }
  ultStart(): void {
    this.tone('sawtooth', 80, 660, 0.85, 0.16);
    this.burst('bandpass', 300, 3200, 0.85, 0.15, 1.2);
    this.tone('sine', 110, 108, 1.7, 0.3);
  }
  ultFire(): void {
    this.burst('lowpass', 5200, 280, 1.25, 0.5);
    this.tone('sawtooth', 62, 44, 1.2, 0.28);
    this.tone('sine', 880, 220, 1.1, 0.08);
  }
  count(n: number): void {
    if (n > 0) this.tone('square', 440, 440, 0.14, 0.12);
    else {
      this.tone('square', 880, 880, 0.4, 0.14);
      this.tone('square', 1320, 1320, 0.4, 0.08);
    }
  }
  uiMove(): void {
    this.tone('square', 720, 720, 0.05, 0.05);
  }
  uiConfirm(): void {
    this.tone('triangle', 600, 1200, 0.15, 0.14);
  }
  uiBack(): void {
    this.tone('triangle', 520, 260, 0.14, 0.12);
  }
}

export const audio = new AudioEngine();
