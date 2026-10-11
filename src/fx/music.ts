/**
 * The score.
 *
 * Three kinds of music, all played by one 16th-note step sequencer on recorded
 * instruments through a mixing desk (EQ, bus compression, a concert hall):
 *
 *   title    a composed 8-bar loop in D minor, for the menus
 *   match    the fight's own score, built live from the two benders' themes
 *            and steered by what is happening in the fight (see below)
 *   battle   the older composed battle theme; still what `play('battle')`
 *            gives you until `setMatch` has been called
 *
 *   music.ts          the sequencer, the three pieces, how each note is played
 *   music/themes.ts   the ten bender themes
 *   music/samples.ts  the recordings: manifest, loading, note → sample lookup
 *   music/mix.ts      the mixing desk and the game's master output chain
 *   music/synth.ts    synthesised stand-ins, used while samples load or if they fail
 *
 * ── Driving the match score ──────────────────────────────────────────────
 *
 *   setMatch([p1Element, p2Element], transpose, bpm)
 *       Once, when a match starts (before or at the countdown). Starts the
 *       match score: war drums until the countdown ends, then the themes.
 *
 *   score(state)
 *       Every frame, or at least ten times a second, with a ScoreState. Cheap:
 *       a little arithmetic, no allocation, no audio work unless something
 *       changed. Everything in it is optional except stocks and damage.
 *
 *   cue(name, player?, power?)
 *       A one-shot stinger for a sim event. See CueName for which and for what
 *       `player` means in each. Ignored while the title theme is playing, so
 *       the menu's demo fight can share the same wiring.
 *
 *   victory(winner?)
 *       As before, but in a match it plays the winner's theme as the fanfare.
 *
 * How the score reacts:
 *
 *   who is ahead      Stocks, damage and who has been landing hits lately make
 *                     a lead from -1 (player 2) to +1 (player 1). Every four
 *                     bars one bender "owns" the phrase: their mode, chords,
 *                     drums and accompaniment. The further ahead a bender is,
 *                     the more phrases they own. When it is close the phrase
 *                     is a duel: the owner states two bars of their tune and
 *                     the other answers with two of theirs, bent into the
 *                     owner's mode. When one is clearly ahead they play all
 *                     four bars and the other is reduced to a quiet echo of
 *                     their opening, or (far behind) to nothing.
 *   intensity         Damage, stocks lost and recent hits set a level 0-3 at
 *                     each bar: 0 half-weight drums, no rim or shaker; 1 the
 *                     theme's full pattern; 2 adds strings, sixteenth shaker
 *                     and a fill into each new phrase; 3 adds ghost strokes, a
 *                     second drum, the tune doubled on koto and 4% more tempo.
 *   last stock        Anyone on their last stock (or `heat = true`) pins the
 *                     level at 3.
 *   off-stage         While a living fighter is off-stage, drums and bass drop
 *                     to a third and the tune is left exposed; they return the
 *                     moment the fighter is back.
 *   ultimate          The whole band is pulled down to a quarter under a drum
 *                     roll while it charges, and comes back on the hit.
 *   stingers          KO, parry, break-free, shield break, respawn, heavy hit.
 *
 * Nothing changes mid-bar except the two pull-downs and the stingers, which
 * are meant to be immediate. Each player's tune sits on their side of the
 * stereo field: player 1 left of centre, player 2 right.
 *
 * Notes are written as [step, pitch, lengthInSteps] per bar, 16 steps to a bar.
 */
import { createMusicMix, type Bus, type MusicMix, type Seats } from './music/mix';
import { SampleBank, type Instrument, type Sample } from './music/samples';
import { Synth } from './music/synth';
import { THEMES, degree, type LeadId, type Theme, type ThemeId } from './music/themes';

export { createMasterChain } from './music/mix';
export { prefetchSamples } from './music/samples';
export type { ThemeId } from './music/themes';

export type TrackName = 'title' | 'battle';

/** What one fighter is doing, as far as the music cares. */
export interface PlayerScore {
  /** Stocks left, counting the one in play. */
  stocks: number;
  /** Damage percent. */
  damage: number;
  /** Alive, airborne and beyond the stage's edge: fighting to get back. */
  offstage?: boolean;
  /** Between losing a stock and respawning. An off-stage dead fighter is not "recovering". */
  dead?: boolean;
  /** Spirit meter, 0-100. A full meter adds a little tension. */
  meter?: number;
}

/** A snapshot of the fight for `Music.score`. */
export interface ScoreState {
  players: [PlayerScore, PlayerScore];
  /** Seconds of countdown left; 0 or absent once the fight is on. The themes start when this reaches 0. */
  countdown?: number;
  /** Index of the player whose ultimate is charging (the freeze before it fires), else null or absent. */
  ultimate?: 0 | 1 | null;
  /** True once the match is decided. */
  over?: boolean;
  /** Who won, once `over`. */
  winner?: 0 | 1 | null;
}

/**
 * One-shot stingers. `player` is:
 *   ko           the fighter who was KO'd (the other one gets the flourish)
 *   parry        the fighter who parried
 *   burst        the fighter who broke free
 *   shieldBreak  the fighter whose shield broke
 *   ultStart     the fighter charging (also covered by ScoreState.ultimate; sending both is fine)
 *   ultFire      the fighter whose ultimate just fired
 *   respawn      the fighter coming back
 *   hit          the attacker; pass the hit's knockback `power`. Only heavy hits (power ≥ 26) sound.
 *   gameover     the winner. Silent: it only tells `victory()` whose theme to play.
 */
export type CueName = 'ko' | 'parry' | 'burst' | 'shieldBreak' | 'ultStart' | 'ultFire' | 'respawn' | 'hit' | 'gameover';

type Note = [step: number, pitch: string, len: number];
type Chord = 'Dm' | 'Bb' | 'C' | 'A' | 'F' | 'Gm';

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' / 'Bb3' → MIDI note number (A4 = 69), shifted by `transpose` semitones. */
function midiOf(name: string, transpose = 0): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) return 69;
  const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (Number(m[3]) + 1) + semi + transpose;
}

function hzOf(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Per chord: bass root, the five tones the koto arpeggiates, and the pad voicing. */
const CHORDS: Record<Chord, { bass: string; arp: string[]; pad: string[] }> = {
  Dm: { bass: 'D2', arp: ['D3', 'A3', 'D4', 'F4', 'A4'], pad: ['D3', 'A3', 'F4'] },
  Bb: { bass: 'Bb1', arp: ['Bb2', 'F3', 'Bb3', 'D4', 'F4'], pad: ['Bb2', 'F3', 'D4'] },
  C: { bass: 'C2', arp: ['C3', 'G3', 'C4', 'E4', 'G4'], pad: ['C3', 'G3', 'E4'] },
  A: { bass: 'A1', arp: ['A2', 'E3', 'A3', 'C#4', 'E4'], pad: ['A2', 'E3', 'C#4'] },
  F: { bass: 'F2', arp: ['F3', 'C4', 'F4', 'A4', 'C5'], pad: ['F3', 'C4', 'A4'] },
  Gm: { bass: 'G1', arp: ['G2', 'D3', 'G3', 'Bb3', 'D4'], pad: ['G2', 'D3', 'Bb3'] },
};
const ARP_ORDER = [0, 2, 3, 2, 4, 3, 2, 3];

// ---- Battle theme: 132 BPM. A 4-bar drum intro, then A (8 bars) and B (8 bars) looping. ----

const BATTLE_BPM = 132;
const BATTLE_INTRO = 4;
const BATTLE_CHORDS: Chord[] = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'A', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'A', 'A'];
const BATTLE_LEAD: Note[][] = [
  [[0, 'A4', 6], [6, 'D5', 2], [8, 'C5', 4], [12, 'A4', 4]],
  [[0, 'G4', 3], [3, 'A4', 3], [6, 'F4', 2], [8, 'D4', 8]],
  [[0, 'D5', 6], [6, 'F5', 2], [8, 'D5', 4], [12, 'Bb4', 4]],
  [[0, 'C5', 3], [3, 'D5', 3], [6, 'E5', 2], [8, 'G5', 8]],
  [[0, 'A5', 6], [6, 'G5', 2], [8, 'F5', 4], [12, 'D5', 4]],
  [[0, 'F5', 3], [3, 'G5', 3], [6, 'A5', 2], [8, 'D5', 8]],
  [[0, 'Bb4', 4], [4, 'D5', 4], [8, 'F5', 4], [12, 'D5', 4]],
  [[0, 'E5', 6], [6, 'C#5', 2], [8, 'A4', 8]],
  [[0, 'C5', 4], [4, 'F5', 4], [8, 'A5', 6], [14, 'G5', 2]],
  [[0, 'G5', 6], [6, 'E5', 2], [8, 'C5', 4], [12, 'E5', 4]],
  [[0, 'F5', 4], [4, 'D5', 4], [8, 'A4', 4], [12, 'D5', 4]],
  [[0, 'D5', 3], [3, 'C5', 3], [6, 'Bb4', 2], [8, 'F4', 8]],
  [[0, 'C5', 4], [4, 'F5', 4], [8, 'A5', 6], [14, 'C6', 2]],
  [[0, 'C6', 4], [4, 'G5', 4], [8, 'E5', 4], [12, 'G5', 4]],
  [[0, 'A5', 6], [6, 'G5', 2], [8, 'E5', 4], [12, 'C#5', 4]],
  [[0, 'A4', 4], [4, 'C#5', 4], [8, 'E5', 4], [12, 'A5', 4]],
];
/** Step → velocity. The low drum and the bass share a 3-3-2 gallop. */
const DON: Record<number, number> = { 0: 1, 3: 0.7, 6: 0.8, 8: 0.9, 11: 0.7, 14: 0.6 };
const KA: Record<number, number> = { 4: 0.8, 7: 0.3, 10: 0.4, 12: 0.8, 15: 0.35 };
const FILL_DON: Record<number, number> = { 0: 1, 3: 0.7, 6: 0.8, 8: 0.55, 10: 0.65, 12: 0.75, 13: 0.8, 14: 0.9, 15: 1 };
const FILL_KA: Record<number, number> = { 4: 0.8, 9: 0.5, 11: 0.6 };
const BASS_STEPS: Record<number, number> = { 0: 0, 3: 0, 6: 1, 8: 0, 11: 0, 14: 1 };

// ---- Title theme: 84 BPM, an 8-bar loop. Slow flute over koto and strings. ----

const TITLE_BPM = 84;
const TITLE_CHORDS: Chord[] = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'];
const TITLE_LEAD: Note[][] = [
  [[0, 'D5', 8], [8, 'A4', 4], [12, 'D5', 4]],
  [[0, 'F5', 12], [12, 'D5', 4]],
  [[0, 'C5', 8], [8, 'F5', 4], [12, 'A5', 4]],
  [[0, 'G5', 12], [12, 'E5', 4]],
  [[0, 'F5', 6], [6, 'E5', 2], [8, 'D5', 8]],
  [[0, 'D5', 4], [4, 'F5', 4], [8, 'Bb5', 8]],
  [[0, 'A5', 6], [6, 'G5', 2], [8, 'D5', 4], [12, 'Bb4', 4]],
  [[0, 'A4', 4], [4, 'C#5', 4], [8, 'E5', 8]],
];

/**
 * How loud each recorded instrument plays into its bus, at velocity 1. The
 * samples are levelled on disk, so these few numbers are the whole balance.
 */
const LEVEL = {
  taiko: 0.9,
  odaiko: 0.8,
  boom: 0.9,
  ka: 0.4,
  anvil: 0.34,
  shaker: 1.4,
  bass: 1.1,
  koto: 2.0,
  harp: 2.0,
  piano: 2.0,
  tuba: 2.0,
  slap: 0.5,
  pad: 1.2,
  gong: 2.0,
};

/**
 * The instruments that carry a tune. `sustained` ones are held for the note's
 * length and released; struck ones ring for `ring` seconds. `range` is the
 * span of MIDI notes the samples cover without stretching more than a minor
 * third, and a tune is moved by octaves to stay inside it.
 */
const LEADS: Record<LeadId, { bus: 'wind' | 'mallet'; sustained: boolean; level: number; attack: number; tau: number; ring: number; range: [number, number] }> = {
  flute: { bus: 'wind', sustained: true, level: 4.1, attack: 0.018, tau: 0.045, ring: 0, range: [57, 87] },
  oboe: { bus: 'wind', sustained: true, level: 3.0, attack: 0.015, tau: 0.04, ring: 0, range: [55, 89] },
  horn: { bus: 'wind', sustained: true, level: 2.3, attack: 0.03, tau: 0.06, ring: 0, range: [40, 63] },
  ocarina: { bus: 'wind', sustained: true, level: 3.4, attack: 0.012, tau: 0.035, ring: 0, range: [66, 87] },
  glass: { bus: 'wind', sustained: true, level: 2.7, attack: 0.05, tau: 0.14, ring: 0, range: [61, 91] },
  bells: { bus: 'mallet', sustained: false, level: 2.1, attack: 0, tau: 0.35, ring: 1.3, range: [57, 79] },
  vibes: { bus: 'mallet', sustained: false, level: 2.4, attack: 0, tau: 0.4, ring: 2.4, range: [57, 91] },
  xylo: { bus: 'mallet', sustained: false, level: 2.4, attack: 0, tau: 0.2, ring: 1.2, range: [64, 99] },
  recorder: { bus: 'wind', sustained: true, level: 3.0, attack: 0.012, tau: 0.04, ring: 0, range: [69, 94] },
  sax: { bus: 'wind', sustained: true, level: 3.4, attack: 0.02, tau: 0.05, ring: 0, range: [53, 79] },
};

/** The koto's arpeggio leans on the beat: accent, off-beat, half-beat, off-beat. */
const ARP_ACCENT = [1.2, 0.8, 1, 0.8];

/** The chord tones a theme's accompaniment figure picks from, as scale degrees above the root. */
const FIGURE_TONES = [0, 4, 7, 9, 11];

/** Crescendo into a new phrase, added to a theme's drum pattern in the last bar when the level is 2 or more. */
const FILL: Record<number, number> = { 12: 0.7, 13: 0.75, 14: 0.85, 15: 0.95 };

interface Voice {
  src: AudioBufferSourceNode;
  g: GainNode;
}

/** One line of tune planned for the bar being played. */
interface Line {
  lead: LeadId;
  seat: 0 | 1 | 2;
  vel: number;
  hold: number;
  /** Doubled on koto an octave down. */
  doubled: boolean;
  /** The tune's own bad habits: see Theme.sloppy and Theme.late. */
  sloppy: number;
  late: number;
  notes: [step: number, midi: number, len: number][];
}

export class Music {
  private mix: MusicMix;
  private bank: SampleBank;
  private synth: Synth;
  private track: TrackName | 'match' | null = null;
  private step = 0;
  private nextT = 0;
  private level = 0.46;
  /** Battle and match only: each arena plays in its own key and tempo. */
  private transpose = 0;
  private battleBpm = BATTLE_BPM;
  /** Seed for the performance's small variations, so a render is repeatable. */
  private seed = 0x9e3779b9;
  /** Last-stock mode: busier drums and the tune doubled. In a match the score also sets this itself. */
  heat = false;

  // ---- The match and how it is going ----
  private themes: [Theme, Theme] | null = null;
  /** True once `score` has been called for this match; until then the intro runs to a fixed length. */
  private scored = false;
  private countdown = 0;
  /** -1 (player 2 far ahead) to +1 (player 1), smoothed. */
  private lead = 0;
  /** 0 (calm) to 1 (frantic), smoothed. */
  private intensity = 0.2;
  /** Damage each player has dealt lately; decays over a few seconds. */
  private momentum: [number, number] = [0, 0];
  private lastDamage: [number, number] = [0, 0];
  private lastStock = false;
  private scoreT = 0;
  private offstageSince = -1;
  private exposed = false;
  private charging = false;
  private ultBy: 0 | 1 | null = null;
  private fullStocks = 0;
  private winner: 0 | 1 | null = null;
  private lastCue: Partial<Record<CueName, number>> = {};

  // ---- Where the match score has got to ----
  private intro = true;
  private owner: 0 | 1 = 0;
  /** A cue can hand the next phrase to someone regardless of the running tally. */
  private nextOwner: 0 | 1 | null = null;
  private credit: [number, number] = [0, 0];
  private duel = true;
  private echo = false;
  private lvl = 1;
  private lines: Line[] = [];

  constructor(
    private ctx: BaseAudioContext,
    dest: AudioNode,
    noise: AudioBuffer,
  ) {
    this.mix = createMusicMix(ctx, dest, this.level);
    this.synth = new Synth(ctx, noise);
    this.bank = new SampleBank(ctx);
    this.bank.onReady = (inst) => {
      const ir = inst === 'hall' ? this.bank.impulse() : null;
      if (ir) this.mix.setImpulse(ir);
    };

    // A live context runs the sequencer and fetches its own samples; an offline one is driven by the test.
    if (typeof window !== 'undefined' && !('startRendering' in ctx)) {
      void this.loadSamples();
      window.setInterval(() => this.tick(), 25);
    }
  }

  /**
   * Fetches and decodes the recorded instruments. Resolves once each has either
   * loaded or failed; never rejects. Until an instrument is in, its notes are
   * played by the synthesised voice, so the music can start straight away.
   */
  loadSamples(): Promise<void> {
    return this.bank.load();
  }

  /** 'ready' | 'failed' | 'loading' per instrument. */
  sampleStatus(): Record<string, string> {
    return this.bank.status();
  }

  /**
   * Schedules `seconds` of a piece in one go. Only useful on an OfflineAudioContext (tests).
   * 'match' needs `setMatch` first; `eachStep` runs before every step so a test can feed
   * `score` and `cue` as the piece goes (pass them the time it is given).
   */
  scheduleAll(name: TrackName | 'match', seconds: number, eachStep?: (t: number, step: number) => void): void {
    if (name === 'match') {
      if (!this.themes) return;
      this.step = 0;
      for (let t = 0.05; t < seconds; this.step++) {
        eachStep?.(t, this.step);
        const sd = this.matchStepDur();
        this.matchStep(this.step, t, sd);
        t += sd;
      }
      return;
    }
    const sd = 60 / (name === 'battle' ? BATTLE_BPM : TITLE_BPM) / 4;
    for (let step = 0; step * sd < seconds; step++) {
      eachStep?.(0.05 + step * sd, step);
      if (name === 'battle') this.battleStep(step, 0.05 + step * sd, sd);
      else this.titleStep(step, 0.05 + step * sd, sd);
    }
  }

  /**
   * Switches piece. Calling it with the piece already playing does nothing unless `restart` is set.
   * Once a match has been set, 'battle' means that match's score.
   */
  play(name: TrackName, restart = false, transpose = 0, bpm = BATTLE_BPM): void {
    if (name === 'battle') {
      this.transpose = transpose;
      this.battleBpm = bpm;
    }
    const target = name === 'battle' && this.themes ? 'match' : name;
    if (this.track === target && !restart) return;
    if (target === 'match') this.resetMatch();
    else this.settle();
    this.heat = false;
    this.track = target;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.08;
  }

  /**
   * Starts the score for a match between two benders. Unknown element names fall back to fire and water,
   * so a new bender without a theme yet still gets music.
   */
  setMatch(elements: [string, string], transpose = 0, bpm = BATTLE_BPM): void {
    const pick = (el: string, fallback: ThemeId): Theme => THEMES[el as ThemeId] ?? THEMES[fallback];
    this.themes = [pick(elements[0], 'fire'), pick(elements[1], 'water')];
    this.play('battle', true, transpose, bpm);
  }

  /** Lowers the music under a pause menu. */
  duck(on: boolean): void {
    this.mix.out.gain.setTargetAtTime(on ? this.level * 0.3 : this.level, this.ctx.currentTime, 0.15);
  }

  /**
   * Tells the score how the fight stands. `at` is when the snapshot is true, in audio-context time;
   * leave it out in the game (it means now) and pass it when rendering offline.
   */
  score(state: ScoreState, at = this.ctx.currentTime): void {
    const [a, b] = state.players;
    const dt = this.scored ? Math.max(0, at - this.scoreT) : 0;
    this.scoreT = at;
    this.countdown = state.countdown ?? 0;
    if (state.over && state.winner != null) this.winner = state.winner;

    // Momentum: damage a player has just taken is credit to the other. A drop (respawn, healing) is not a hit.
    const fade = Math.exp(-dt / 5);
    const hitA = this.scored ? Math.max(0, a.damage - this.lastDamage[0]) : 0;
    const hitB = this.scored ? Math.max(0, b.damage - this.lastDamage[1]) : 0;
    this.momentum[0] = this.momentum[0] * fade + hitB;
    this.momentum[1] = this.momentum[1] * fade + hitA;
    this.lastDamage[0] = a.damage;
    this.lastDamage[1] = b.damage;

    const lead = clamp(0.5 * (a.stocks - b.stocks) + (b.damage - a.damage) / 200 + (this.momentum[0] - this.momentum[1]) / 50, -1, 1);
    // The most stocks anyone has had this match is what a full set looks like.
    const top = (this.fullStocks = Math.max(this.fullStocks, a.stocks, b.stocks, 1));
    this.lastStock = !state.over && Math.min(a.stocks, b.stocks) <= 1 && top > 1;
    const lost = clamp((2 * top - a.stocks - b.stocks) / Math.max(1, 2 * top - 2), 0, 1);
    const action = clamp((this.momentum[0] + this.momentum[1]) / 45, 0, 1);
    const charged = (a.meter ?? 0) >= 100 || (b.meter ?? 0) >= 100 ? 0.08 : 0;
    const intensity = clamp(0.22 + 0.3 * clamp((a.damage + b.damage) / 240, 0, 1) + 0.15 * lost + 0.4 * action + charged, 0, 1);

    // The first snapshot is taken as it stands; after that the score leans towards the fight rather than jumping.
    if (!this.scored) {
      this.lead = lead;
      this.intensity = intensity;
    } else {
      this.lead += (lead - this.lead) * (1 - Math.exp(-dt / 1.5));
      this.intensity += (intensity - this.intensity) * (1 - Math.exp(-dt / (intensity > this.intensity ? 1.5 : 4)));
    }
    this.scored = true;

    // Off-stage: after a moment (a hop past the ledge is not a recovery) pull the rhythm section down.
    const off = this.track === 'match' && !state.over && ((!!a.offstage && !a.dead) || (!!b.offstage && !b.dead));
    if (!off) this.offstageSince = -1;
    else if (this.offstageSince < 0) this.offstageSince = at;
    const expose = off && at - this.offstageSince >= 0.2;
    if (expose !== this.exposed) {
      this.exposed = expose;
      this.mix.rhythm.gain.setTargetAtTime(expose ? 0.3 : 1, at, expose ? 0.14 : 0.05);
    }

    // An ultimate's wind-up, taken from the snapshot in case the cues are not wired: start on the way in, hit on the way out.
    const ult = state.ultimate ?? null;
    if (ult !== this.ultBy) {
      if (ult !== null) this.cue('ultStart', ult, 0, at);
      else if (this.charging && this.ultBy !== null) this.cue('ultFire', this.ultBy, 0, at);
      this.ultBy = ult;
    }
  }

  /** Plays a stinger for something that just happened. See CueName. `at` as for `score`. */
  cue(name: CueName, player: 0 | 1 = 0, power = 0, at = this.ctx.currentTime): void {
    if (name === 'gameover') {
      this.winner = player;
      this.unhush(at);
      return;
    }
    // Stingers belong to a fight. The title screen's demo match can send them too; over the menu music they are ignored.
    if (this.track !== 'match' && this.track !== 'battle') return;
    const last = this.lastCue[name];
    // The sim can report the same thing twice in a frame; one stinger is enough.
    if (last !== undefined && at >= last && at - last < (name === 'hit' ? 0.35 : 0.12)) return;
    const themes = this.themes ?? [THEMES.fire, THEMES.water];
    const mine = themes[player];
    const mode = themes[this.owner].mode;
    const tonic = 62 + this.transpose;
    const seat = player === 0 ? 0 : 2;
    const pan = player === 0 ? -0.4 : 0.4;
    const t = at + 0.02;
    if (name !== 'hit' || power >= 26) this.lastCue[name] = at;

    switch (name) {
      case 'ko': {
        // The big drum for the fall, and the other bender's instrument rising a fifth to the octave.
        const scorer = player === 0 ? 1 : 0;
        this.taiko(t, 1.3, 0.7);
        this.gong(t, 0.35);
        const theirs = themes[scorer];
        const fold = this.fold(theirs.lead, [theirs.base + this.transpose + degree(mode, 4), theirs.base + this.transpose + degree(mode, 7)]);
        this.tone(theirs.lead, scorer === 0 ? 0 : 2, t + 0.04, fold[0], 0.1, 0.5);
        this.tone(theirs.lead, scorer === 0 ? 0 : 2, t + 0.15, fold[1], 0.5, 0.55);
        this.momentum[scorer] += 25;
        this.nextOwner = scorer;
        break;
      }
      case 'parry':
        // A rim crack and two high plucks: octave, then the fifth above it.
        this.ka(t, 0.9);
        this.pluckAt(mine.comp, t, tonic + 12, 0.62, pan);
        this.pluckAt(mine.comp, t + 0.06, tonic + 12 + degree(mode, 4), 0.62, pan);
        break;
      case 'burst':
        this.ka(t, 0.8);
        this.ka(t + 0.07, 0.9);
        this.taiko(t + 0.14, 0.8, 1.3);
        break;
      case 'shieldBreak':
        // A thud and a tritone: the one interval that sounds like something giving way.
        this.taiko(t, 0.9, 0.7);
        this.pluckAt('koto', t, tonic - 12, 0.7, pan);
        this.pluckAt('koto', t + 0.03, tonic - 6, 0.7, pan);
        break;
      case 'ultStart': {
        // Held breath: everything else drops away under a roll that speeds up into the hit.
        if (this.charging) break;
        this.charging = true;
        const hush = this.mix.hush.gain;
        hush.cancelScheduledValues(at);
        hush.setTargetAtTime(0.25, at, 0.04);
        // If the hit never comes (a cancelled ultimate), let the band back in on its own.
        hush.setTargetAtTime(1, at + 1.8, 0.25);
        for (let i = 0; i < 11; i++) this.taiko(t + 0.82 * Math.pow(i / 11, 0.75), 0.42 + i * 0.05, 1);
        break;
      }
      case 'ultFire': {
        this.unhush(at);
        this.taiko(t, 1.3, 0.7);
        this.taiko(t, 1, 1);
        this.gong(t, 0.5);
        const fold = this.fold(mine.lead, [mine.base + this.transpose, mine.base + this.transpose + 12]);
        this.tone(mine.lead, seat, t, fold[0], 0.6, 0.55);
        this.tone(mine.lead, seat, t, fold[1], 0.6, 0.5);
        this.momentum[player] += 15;
        this.nextOwner = player;
        break;
      }
      case 'respawn':
        this.pluckAt(mine.comp, t, tonic, 0.42, pan);
        this.pluckAt(mine.comp, t + 0.09, tonic + degree(mode, 4), 0.42, pan);
        break;
      case 'hit':
        if (power >= 26) this.taiko(t, Math.min(1.1, 0.6 + power / 90), 0.7);
        break;
    }
  }

  /**
   * The win fanfare: a drum roll into a swell, then the title theme takes over. After a match the swell
   * is the winner's theme, played broad; pass `winner`, or let `score` / `cue('gameover')` have said who.
   */
  victory(winner: 0 | 1 | null = this.winner): void {
    const t = this.ctx.currentTime + 0.05;
    this.settle();
    const roll = [0, 0.14, 0.26, 0.36, 0.44, 0.5, 0.55];
    roll.forEach((dt, i) => this.taiko(t + dt, 0.4 + i * 0.09, 1));
    const hit = t + 0.62;
    // The landing: odaiko and a hard stick stroke together, under the gong.
    this.taiko(hit, 1.3, 0.7);
    this.taiko(hit, 1, 1);
    this.gong(hit, 0.7);

    const theme = this.themes && this.track === 'match' ? this.themes[winner ?? (this.lead >= 0 ? 0 : 1)] : null;
    let end = hit + 3.4;
    if (theme) {
      // Their first two bars at a walking pace over their own home chord, harp or koto rolling up underneath.
      const sd = 60 / 96 / 4;
      const tr = this.transpose;
      const chord = [0, 4, 9].map((d) => 50 + tr + degree(theme.mode, d));
      this.padAt(hit, [...chord, 62 + tr + degree(theme.mode, 4)], 32 * sd, 0.7);
      this.bassAt(hit, 38 + tr, 1.8, 0.6, 950);
      [0, 4, 7, 9, 11, 14, 16].forEach((d, i) => this.pluckAt(theme.comp, hit + i * 0.085, 50 + tr + degree(theme.mode, d), 0.56 + i * 0.02, i % 2 ? 0.4 : -0.4));
      for (let bar = 0; bar < 2; bar++) {
        const notes = this.fold(theme.lead, theme.tune[bar].map(([, d]) => theme.base + tr + degree(theme.mode, d)));
        theme.tune[bar].forEach(([at, , len], i) => this.sing(theme.lead, 1, hit + 0.1 + (bar * 16 + at) * sd, notes[i], len * sd * theme.hold, theme.leadVel * 1.15, theme.sloppy ?? 0));
      }
      this.taiko(hit + 16 * sd, 0.9, 0.7);
      end = hit + 32 * sd + 1.2;
    } else {
      this.pad(hit, ['D3', 'A3', 'F#4', 'A4'], 3.2, 0.7);
      ['D4', 'F#4', 'A4', 'D5', 'F#5', 'A5', 'D6'].forEach((n, i) => this.pluck(hit + i * 0.085, n, 0.56 + i * 0.02, i % 2 ? 0.4 : -0.4));
      this.flute(hit + 0.1, 'A5', 0.32, 0.5);
      this.flute(hit + 0.45, 'D6', 1.7, 0.55);
      this.bass(hit, 'D2', 1.6, 0.6);
    }
    this.track = 'title';
    this.step = 0;
    this.nextT = end;
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!this.track || ctx.state !== 'running') return;
    // After a stall (hidden tab), jump forward rather than replaying everything that was missed.
    if (this.nextT < ctx.currentTime - 0.25) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.2) {
      const sd = this.track === 'match' ? this.matchStepDur() : 60 / (this.track === 'battle' ? this.battleBpm : TITLE_BPM) / 4;
      if (this.track === 'match') this.matchStep(this.step, this.nextT, sd);
      else if (this.track === 'battle') this.battleStep(this.step, this.nextT, sd);
      else this.titleStep(this.step, this.nextT, sd);
      this.nextT += sd;
      this.step++;
    }
  }

  // ---- The match score ----

  private resetMatch(): void {
    this.settle();
    this.scored = false;
    this.countdown = 0;
    this.lead = 0;
    this.intensity = 0.2;
    this.momentum = [0, 0];
    this.lastDamage = [0, 0];
    this.lastStock = false;
    this.offstageSince = -1;
    this.ultBy = null;
    this.fullStocks = 0;
    this.winner = null;
    this.lastCue = {};
    this.intro = true;
    this.owner = 0;
    this.nextOwner = null;
    this.credit = [0, 0];
    this.duel = true;
    this.echo = false;
    this.lvl = 1;
    this.lines = [];
  }

  /** Opens both pull-downs, so no piece starts with the band ducked by the last one. */
  private settle(): void {
    const now = this.ctx.currentTime;
    this.unhush(now);
    if (this.exposed) this.mix.rhythm.gain.setTargetAtTime(1, now, 0.05);
    this.exposed = false;
  }

  private unhush(at: number): void {
    if (!this.charging) return;
    this.charging = false;
    const hush = this.mix.hush.gain;
    hush.cancelScheduledValues(at);
    hush.setTargetAtTime(1, at, 0.03);
  }

  /** At full intensity the match runs 4% faster. Tempo only moves at a bar line, with the level. */
  private matchStepDur(): number {
    return 60 / (this.battleBpm * (this.lvl === 3 && !this.intro ? 1.04 : 1)) / 4;
  }

  private matchStep(step: number, t: number, sd: number): void {
    const themes = this.themes;
    if (!themes) return;

    if (this.intro) {
      // War drums for as long as the countdown runs (or two bars, if nobody is telling us), then in on a beat.
      const go = this.scored ? this.countdown <= 0 : step >= 32;
      if (!go || step % 4 !== 0) {
        const s = step % 16;
        if (Math.floor(step / 16) % 2 === 0) {
          if (s === 0) {
            if (step === 0) this.gong(t, 0.5);
            this.taiko(t, 1.3, 0.7);
          }
          if (s === 8) this.taiko(t, 1.1, 0.7);
        } else if (s === 0 || s === 6 || s === 8 || s === 12 || s === 14) this.taiko(t, s === 0 ? 1.2 : 0.9, 0.7);
        return;
      }
      this.intro = false;
      this.step = step = 0;
    }

    const s = step % 16;
    const bar = Math.floor(step / 16);
    const b = bar % 4;
    if (s === 0) this.planBar(bar, themes);
    const theme = themes[this.owner];
    const lvl = this.lvl;
    const calm = lvl === 0;
    const tr = this.transpose;
    // Chords on the upper degrees are voiced below the tonic, so the accompaniment stays in one register.
    const root = theme.prog[b] > 3 ? theme.prog[b] - 7 : theme.prog[b];

    // Drums.
    if (s === 0 && b === 0) {
      this.taiko(t, 1.2, 0.7);
      if (bar % 8 === 0) this.gong(t, 0.3);
    }
    const don = theme.don[s] ?? (lvl >= 2 && b === 3 ? FILL[s] : undefined);
    if (don) this.taiko(t, don * (calm ? 0.7 : 1), 1);
    const big = theme.odaiko[s];
    if (big) this.taiko(t, big, 0.7);
    const ka = theme.ka[s];
    if (ka && !calm) this.ka(t, ka);
    const anvil = theme.anvil?.[s];
    if (anvil) this.anvil(t, anvil * (calm ? 0.6 : 1));
    // Shaker: the theme's own rate, one notch down when calm and one up from level 2.
    const shake = clamp(theme.shaker + (calm ? -1 : lvl >= 2 ? 1 : 0), 0, 2);
    if (shake === 2 || (shake === 1 && s % 2 === 0)) this.shaker(t, s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.35 : 0.18);
    if (lvl === 3) {
      if (s % 2 === 1 && !ka) this.ka(t, 0.3);
      if (s === 2 || s === 10) this.taiko(t, 0.55, 1.3);
    }

    // Bass, on the chord's root, kept in the bottom octave.
    const bass = theme.bass[s];
    if (bass) {
      let m = 38 + degree(theme.mode, root);
      while (m > 42) m -= 12;
      while (m < 31) m += 12;
      const note = m + tr + (bass[0] === 1 ? 12 : bass[0] === 2 ? degree(theme.mode, root + 4) - degree(theme.mode, root) : 0);
      if (theme.tuba) this.tubaAt(t + this.rand() * 0.02, note, 0.5);
      else this.bassAt(t, note, bass[1] * sd, 0.44, 950);
    }

    // Accompaniment figure.
    const tone = theme.figure[s];
    if (tone >= 0) {
      const accent = s % 4 === 0 ? 1.2 : s % 2 === 0 ? 1 : 0.8;
      this.comp(theme, t, 50 + tr + degree(theme.mode, root + FIGURE_TONES[tone]), theme.compVel * accent * (calm ? 0.85 : 1), s % 4 < 2 ? -0.35 : 0.35);
    }
    const stab = theme.stabs?.[s];
    if (stab) {
      // The chord in close position above the figure's register; a sloppy player rolls it without meaning to.
      [7, 9, 11].forEach((d, i) => this.comp(theme, t + (theme.sloppy ? this.rand() * 0.03 : 0), 50 + tr + degree(theme.mode, root + d), stab * (calm ? 0.85 : 1), i === 1 ? 0 : i ? 0.35 : -0.35));
    }
    const gag = b === 3 ? theme.gag?.[s] : undefined;
    if (gag) this.slap(t, gag);
    if (s === 0 && (theme.pad || lvl >= 2)) {
      this.padAt(t, [0, 4, 9].map((d) => 50 + tr + degree(theme.mode, root + d)), sd * 15, lvl >= 2 ? 0.6 : 0.45);
    }

    // The tunes.
    for (const line of this.lines) {
      for (const [at, midi, len] of line.notes) {
        if (at !== s) continue;
        this.sing(line.lead, line.seat, t + line.late, midi, len * sd * line.hold, line.vel, line.sloppy);
        if (line.doubled) this.pluckAt('koto', t, midi - 12 < 47 ? midi : midi - 12, 0.5, 0);
      }
    }
  }

  /** Decides, at a bar line, who owns the phrase, how hard the band plays, and which tunes sound in this bar. */
  private planBar(bar: number, themes: [Theme, Theme]): void {
    const b = bar % 4;
    if (b === 0) {
      if (this.nextOwner !== null) {
        this.owner = this.nextOwner;
        this.nextOwner = null;
      } else {
        // Each bender earns phrases in proportion to how far ahead they are; whoever is owed most goes next.
        const share = 0.5 + 0.4 * this.lead;
        this.credit[0] += share;
        this.credit[1] += 1 - share;
        this.owner = this.credit[0] >= this.credit[1] ? 0 : 1;
      }
      this.credit[this.owner] -= 1;
      const gap = Math.abs(this.lead);
      this.duel = gap < 0.3;
      this.echo = !this.duel && gap < 0.75;
    }
    const urgent = this.heat || this.lastStock;
    const i = Math.max(this.intensity, urgent ? 0.75 : 0);
    this.lvl = i < 0.3 ? 0 : i < 0.5 ? 1 : i < 0.72 ? 2 : 3;

    const me = this.owner;
    const them = me === 0 ? 1 : 0;
    const mine = themes[me];
    const theirs = themes[them];
    const mirror = mine.id === theirs.id;
    this.lines = [];
    if (this.duel && b >= 2) {
      // The answer: the other bender's opening two bars (in a mirror match, the second half of the shared
      // tune), in the owner's mode and moved onto the owner's chord.
      const from = mirror ? b : b - 2;
      this.lines.push(this.line(theirs, them, from, mine, b, theirs.leadVel, 0, 16));
    } else {
      this.lines.push(this.line(mine, me, b, mine, b, mine.leadVel, 0, 16));
      // The echo: the first half of the other's opening bar, late and quiet, in the gap the owner's cadence leaves.
      if (this.echo && b === 3 && !mirror) this.lines.push(this.line(theirs, them, 0, mine, b, theirs.leadVel * 0.55, 8, 8));
    }
    if (this.lvl === 3) this.lines[0].doubled = true;
  }

  /**
   * One bar of `tune`'s melody as it sounds over `over`'s harmony in bar `b`: read in that mode, moved by
   * the difference between the chord it was written on and the chord it lands on, and shifted by octaves
   * into the instrument's range. `delay` moves it later in the bar; only notes starting before `until` are kept.
   */
  private line(tune: Theme, player: 0 | 1, from: number, over: Theme, b: number, vel: number, delay: number, until: number): Line {
    let move = over.prog[b] - tune.prog[from];
    if (move > 3) move -= 7;
    if (move < -3) move += 7;
    const src = tune.tune[from].filter(([at]) => at < until);
    const midis = this.fold(
      tune.lead,
      src.map(([, d]) => tune.base + this.transpose + degree(over.mode, d + move)),
    );
    return {
      lead: tune.lead,
      seat: player === 0 ? 0 : 2,
      vel,
      hold: tune.hold,
      doubled: false,
      sloppy: tune.sloppy ?? 0,
      late: tune.late ?? 0,
      notes: src.map(([at, , len], i) => [at + delay, midis[i], Math.min(len, 16 - at - delay)]),
    };
  }

  /** Moves a phrase by whole octaves until it sits inside what `lead`'s samples cover. */
  private fold(lead: LeadId, midis: number[]): number[] {
    const [lo, hi] = LEADS[lead].range;
    let shift = 0;
    const top = Math.max(...midis);
    const bottom = Math.min(...midis);
    while (top + shift > hi) shift -= 12;
    while (bottom + shift < lo) shift += 12;
    return shift ? midis.map((m) => m + shift) : midis;
  }

  // ---- The composed battle theme ----

  private battleStep(step: number, t: number, sd: number): void {
    const s = step % 16;
    const absBar = Math.floor(step / 16);

    if (absBar < BATTLE_INTRO) {
      // Intro: two bars of lone war drums, then the gallop and bass come in under the countdown.
      if (absBar === 0) {
        if (s === 0) {
          this.gong(t, 0.5);
          this.taiko(t, 1.3, 0.7);
        }
        if (s === 8) this.taiko(t, 1.1, 0.7);
      } else if (absBar === 1) {
        if (s === 0 || s === 6 || s === 8 || s === 12 || s === 14) this.taiko(t, s === 0 ? 1.2 : 0.9, 0.7);
      } else {
        const last = absBar === BATTLE_INTRO - 1;
        const don = (last ? FILL_DON : DON)[s];
        if (don) this.taiko(t, don, 1);
        const ka = (last ? FILL_KA : KA)[s];
        if (ka) this.ka(t, ka);
        if (s in BASS_STEPS) this.bass(t, 'D2', sd * 2.4, 0.44, BASS_STEPS[s]);
        if (s % 2 === 0) this.pluck(t, CHORDS.Dm.arp[ARP_ORDER[s / 2]], 0.5 * ARP_ACCENT[(s / 2) % 4], s % 4 ? 0.35 : -0.35);
      }
      return;
    }

    const loopBar = (absBar - BATTLE_INTRO) % 16;
    const pass = Math.floor((absBar - BATTLE_INTRO) / 16);
    const chord = CHORDS[BATTLE_CHORDS[loopBar]];
    const inB = loopBar >= 8;
    const fill = loopBar % 8 === 7;

    if (s === 0 && loopBar % 8 === 0) {
      this.taiko(t, 1.3, 0.7);
      if (loopBar === 0) this.gong(t, 0.35);
    }
    const don = (fill ? FILL_DON : DON)[s];
    if (don) this.taiko(t, don, 1);
    const ka = (fill ? FILL_KA : KA)[s];
    if (ka) this.ka(t, ka);
    if (inB || this.heat || s % 2 === 0) this.shaker(t, s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.35 : 0.18);
    if (this.heat) {
      if (s % 2 === 1 && !ka) this.ka(t, 0.3);
      if (s === 2 || s === 10) this.taiko(t, 0.55, 1.3);
    }

    if (s in BASS_STEPS) this.bass(t, chord.bass, sd * 2.4, 0.44, BASS_STEPS[s]);
    if (s % 2 === 0) this.pluck(t, chord.arp[ARP_ORDER[s / 2]], 0.5 * ARP_ACCENT[(s / 2) % 4], s % 4 ? 0.35 : -0.35);
    if (s === 0 && inB) this.pad(t, chord.pad, sd * 15, 0.6);

    for (const [at, pitch, len] of BATTLE_LEAD[loopBar]) {
      if (at !== s) continue;
      this.flute(t, pitch, len * sd * 0.92, 0.5);
      // Second time round the koto doubles the tune an octave down.
      if (pass % 2 === 1) this.pluck(t, pitch.replace(/\d/, (d) => String(Number(d) - 1)), 0.55, 0);
      if (this.heat) this.pluck(t, pitch, 0.5, 0.2);
    }
  }

  // ---- The title theme ----

  private titleStep(step: number, t: number, sd: number): void {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 8;
    const pass = Math.floor(step / 128);
    const chord = CHORDS[TITLE_CHORDS[bar]];

    if (s === 0) {
      if (bar === 0) this.gong(t, 0.45);
      this.taiko(t, 0.55, 0.75);
      this.pad(t, chord.pad, sd * 15.5, 0.62);
      this.bass(t, chord.bass, sd * 13, 0.26, 0, 320);
    }
    if (s === 10) this.taiko(t, 0.3, 0.75);
    if (s % 2 === 0) this.pluck(t, chord.arp[ARP_ORDER[s / 2]], 0.58 * ARP_ACCENT[(s / 2) % 4], s % 4 ? 0.4 : -0.4);
    // The flute rests for the very first pass so the theme can settle in.
    if (pass > 0 || bar >= 4) {
      for (const [at, pitch, len] of TITLE_LEAD[bar]) if (at === s) this.flute(t, pitch, len * sd * 0.94, 0.42);
    }
  }

  // ---- Playing a note ----
  //
  // One method per instrument. Each plays the recording if that instrument has
  // loaded and the synthesised voice otherwise, so the piece sounds from the
  // first step and upgrades itself, note by note, as samples arrive.
  //
  // The composed pieces name their notes ('C#5') and go through taiko / ka /
  // shaker / bass / pluck / flute / pad / gong. The match score works in MIDI
  // numbers and goes through bassAt / pluckAt / tone / padAt, which the named
  // ones are thin wrappers over.

  /** The composed battle theme and the match score are transposed per arena; the title theme is not. */
  private shift(): number {
    return this.track === 'title' || this.track === null ? 0 : this.transpose;
  }

  private midi(pitch: string): number {
    return midiOf(pitch, this.shift());
  }

  /** Uniform 0..1 from a small repeatable generator: human looseness without a different render every time. */
  private rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let x = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  /** A player never lands two notes at quite the same weight: ±`amount` around 1. */
  private loose(amount: number): number {
    return 1 + (this.rand() * 2 - 1) * amount;
  }

  /** Starts a recording at `t`. `rate` repitches it; `attack` fades it in. */
  private voice(s: Sample, dest: AudioNode, t: number, rate: number, level: number, attack = 0): Voice {
    const src = this.ctx.createBufferSource();
    src.buffer = s.buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    if (attack > 0) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + attack);
    } else g.gain.value = level;
    src.connect(g);
    g.connect(dest);
    src.start(t, s.start);
    return { src, g };
  }

  /** Lets go of a held note at `at`, fading with time constant `tau`. */
  private release(v: Voice, at: number, tau: number): void {
    v.g.gain.setTargetAtTime(0, at, tau);
    v.src.stop(at + tau * 7 + 0.02);
  }

  /** Semitone distance → playback rate. */
  private rateTo(midi: number, s: Sample): number {
    return Math.pow(2, (midi - s.midi) / 12);
  }

  /** Low drum. `pitch` below 1 is the big odaiko, above 1 a smaller drum. */
  private taiko(t: number, vel: number, pitch: number): void {
    const bank = this.bank;
    const bus = this.mix.taiko;
    const v = Math.min(1.4, vel);
    if (pitch < 0.9) {
      // Odaiko: a mallet on the big drum, with a concert bass drum underneath for the floor-shaking part.
      const layer = v >= 0.8 ? 1 : 0;
      const boom = bank.hit('taiko', 'boom', layer);
      const mallet = bank.hit('taiko', 'mallet', layer);
      if (boom && mallet) {
        const w = Math.pow(v, 1.2);
        this.voice(boom, bus.in, t, 1, LEVEL.boom * w);
        this.voice(mallet, bus.in, t, 0.84 * this.loose(0.008), LEVEL.odaiko * w);
        return;
      }
    } else {
      const stick = bank.hit('taiko', 'stick', v < 0.62 ? 0 : v < 0.86 ? 1 : 2);
      if (stick) {
        const at = pitch > 1.1 ? t + this.rand() * 0.004 : t;
        this.voice(stick, bus.in, at, (pitch > 1.1 ? 1.2 : 1) * this.loose(0.01), LEVEL.taiko * Math.pow(v, 1.2) * this.loose(0.05));
        return;
      }
    }
    this.synth.taiko(bus.synth, t, vel, pitch);
  }

  /** Stick on the drum's rim. */
  private ka(t: number, vel: number): void {
    const s = this.bank.hit('ka');
    if (!s) return this.synth.ka(this.mix.ka.synth, t, vel);
    // Ghost strokes sit a hair behind the beat and a touch lower.
    const ghost = vel < 0.5;
    this.voice(s, this.mix.ka.in, t + (ghost ? this.rand() * 0.005 : 0), (ghost ? 0.96 : 1) * this.loose(0.012), LEVEL.ka * Math.pow(vel, 1.1) * this.loose(0.06));
  }

  /** Hammer on an anvil. Shares the rim's place in the mix. */
  private anvil(t: number, vel: number): void {
    const s = this.bank.hit('anvil', '', vel >= 0.7 ? 1 : 0);
    if (!s) return this.synth.ka(this.mix.ka.synth, t, vel);
    this.voice(s, this.mix.ka.in, t, this.loose(0.006), LEVEL.anvil * Math.pow(vel, 1.1) * this.loose(0.05));
  }

  private shaker(t: number, vel: number): void {
    const s = this.bank.hit('shaker');
    if (!s) return this.synth.shaker(this.mix.shaker.synth, t, vel);
    this.voice(s, this.mix.shaker.in, t + this.rand() * 0.005, this.loose(0.02), LEVEL.shaker * vel * this.loose(0.1));
  }

  private bass(t: number, pitch: string, dur: number, vel: number, octave = 0, cutoff = 950): void {
    this.bassAt(t, this.midi(pitch) + (octave ? 12 : 0), dur, vel, cutoff);
  }

  private bassAt(t: number, midi: number, dur: number, vel: number, cutoff: number): void {
    const s = this.bank.pitched('bass', midi);
    if (!s) return this.synth.bass(this.mix.bass.synth, t, hzOf(midi), dur, vel, cutoff);
    // Short notes are stopped with the hand, as a player would for a gallop. Long ones ring until the
    // next, and a plucked string fades where the synth bass held, so they are dug in harder to carry the bar.
    const long = dur >= 1;
    const v = this.voice(s, this.mix.bass.in, t, this.rateTo(midi, s), LEVEL.bass * vel * (long ? 1.6 : 1) * this.loose(0.05));
    if (long) this.release(v, t + dur, 0.12);
    else this.release(v, t + dur * 0.92, 0.035);
  }

  /** Koto. `pan` picks one of three seats: left, centre, right. */
  private pluck(t: number, pitch: string, vel: number, pan: number): void {
    this.pluckAt('koto', t, this.midi(pitch), vel, pan);
  }

  private pluckAt(inst: 'koto' | 'harp' | 'piano', t: number, midi: number, vel: number, pan: number): void {
    // The piano is bright enough already; it sits with the mallets rather than under the plucked strings' treble lift.
    const seat: Bus = (inst === 'piano' ? this.mix.mallet : this.mix.koto)[pan < -0.1 ? 0 : pan > 0.1 ? 2 : 1];
    // The koto has two recorded dynamics: the harder pluck is brighter, not just louder.
    const s = inst === 'koto' ? this.bank.pitched('koto', midi, vel >= 0.5 ? 'f' : 'mf') : this.bank.pitched(inst, midi);
    if (!s) return this.synth.pluck(seat.synth, t, midi, hzOf(midi), vel);
    this.voice(s, seat.in, t + this.rand() * 0.006, this.rateTo(midi, s), LEVEL[inst] * vel * this.loose(0.07));
  }

  /**
   * A note of a theme's accompaniment. A sloppy theme's instrument is out of tune with itself: every note
   * is two, a few cents either side of where it should be, which is what a bar-room piano sounds like.
   */
  private comp(theme: Theme, t: number, midi: number, vel: number, pan: number): void {
    if (!theme.sloppy) return this.pluckAt(theme.comp, t, midi, vel, pan);
    const off = 0.14 * theme.sloppy;
    this.pluckAt(theme.comp, t, midi - off, vel * 0.75, pan);
    this.pluckAt(theme.comp, t, midi + off * 1.4, vel * 0.75, pan);
  }

  /** Staccato tuba, for a bass line that goes oom. Kept inside the octave and a half the samples cover. */
  private tubaAt(t: number, midi: number, vel: number): void {
    while (midi < 31) midi += 12;
    while (midi > 56) midi -= 12;
    const s = this.bank.pitched('tuba', midi);
    if (!s) return this.synth.bass(this.mix.bass.synth, t, hzOf(midi), 0.3, vel, 700);
    this.voice(s, this.mix.bass.in, t, this.rateTo(midi, s), LEVEL.tuba * vel * this.loose(0.06));
  }

  /** Vibraslap. Shares the rim's place in the mix. */
  private slap(t: number, vel: number): void {
    const s = this.bank.hit('slap');
    if (!s) return this.synth.ka(this.mix.ka.synth, t, vel * 0.6);
    this.voice(s, this.mix.ka.in, t, this.loose(0.03), LEVEL.slap * vel);
  }

  /**
   * A note of tune as its bender would play it. For most that is just the note. A sloppy one drifts off
   * the beat and off pitch, and now and then starts a semitone out and slides over to the right note late.
   */
  private sing(lead: LeadId, seat: 0 | 1 | 2, t: number, midi: number, dur: number, vel: number, sloppy: number): void {
    if (!sloppy) return this.tone(lead, seat, t, midi, dur, vel);
    const at = t + this.rand() * 0.03 * sloppy;
    const drift = (): number => (this.rand() * 2 - 1) * 0.3 * sloppy;
    if (dur > 0.15 && this.rand() < 0.3 * sloppy) {
      const wrong = midi + (this.rand() < 0.5 ? -1 : 1);
      this.tone(lead, seat, at, wrong + drift(), dur * 0.4, vel);
      this.tone(lead, seat, at + dur * 0.4, midi + drift(), dur * 0.6, vel * 0.95);
    } else this.tone(lead, seat, at, midi + drift(), dur, vel);
  }

  /** The title and battle themes' lead. */
  private flute(t: number, pitch: string, dur: number, vel: number): void {
    this.tone('flute', 1, t, this.midi(pitch), dur, vel);
  }

  /**
   * A note of tune on any lead instrument, from one of three seats. Blown and bowed leads carry their own
   * breath and vibrato in the recording and are only shaped at the start and end; struck ones are left to ring.
   */
  private tone(lead: LeadId, seat: 0 | 1 | 2, t: number, midi: number, dur: number, vel: number): void {
    const spec = LEADS[lead];
    const seats: Seats = this.mix[spec.bus];
    const s = this.bank.pitched(lead as Instrument, midi);
    if (!s) {
      if (spec.sustained) this.synth.flute(seats[seat].synth, t, hzOf(midi), dur, vel);
      else this.synth.pluck(seats[seat].synth, t, midi, hzOf(midi), vel * 1.4);
      return;
    }
    const v = this.voice(s, seats[seat].in, t, this.rateTo(midi, s), spec.level * vel * (spec.sustained ? 1 : this.loose(0.06)), spec.attack);
    this.release(v, t + (spec.sustained ? dur : Math.max(dur, spec.ring)), spec.tau);
  }

  /** String sections: cellos take the low and middle voices, violins the top. */
  private pad(t: number, pitches: string[], dur: number, vel: number): void {
    this.padAt(
      t,
      pitches.map((p) => this.midi(p)),
      dur,
      vel,
    );
  }

  private padAt(t: number, midis: number[], dur: number, vel: number): void {
    const bank = this.bank;
    if (!bank.ready('strings')) return this.synth.pad(this.mix.pad.synth, t, midis.map(hzOf), dur, vel);
    for (const midi of midis) {
      const s = bank.pitched('strings', midi, midi >= 58 ? 'violin' : 'cello');
      if (!s) continue;
      const v = this.voice(s, this.mix.pad.in, t, this.rateTo(midi, s), LEVEL.pad * vel, Math.min(0.3, dur * 0.2));
      this.release(v, t + dur, 0.14);
    }
  }

  private gong(t: number, vel: number): void {
    const s = this.bank.hit('gong');
    if (!s) return this.synth.gong(this.mix.gong.synth, t, vel);
    this.voice(s, this.mix.gong.in, t, 1, LEVEL.gong * vel);
  }
}
