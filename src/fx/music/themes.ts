/**
 * One theme per bender (ten of them). A theme is a small piece of writing, not a recording:
 * a mode, a four-bar chord cycle, a four-bar tune, the instrument that plays
 * it, and the accompaniment that gives it its gait.
 *
 * Tunes and chords are written in SCALE DEGREES, not note names: 0 is the
 * tonic, 4 the fifth, 7 the octave, in whatever mode is in force. That is what
 * lets the score weave two themes together. When one bender's tune is played
 * over the other's harmony it is bent into that mode and moved onto the chord
 * of the moment, so it stays recognisable by contour and rhythm but belongs to
 * what is underneath it. Every match shares one tonic (D, moved by the arena).
 *
 * Tune notes are [step, degree, lengthInSteps], 16 steps to the bar.
 */

export type ThemeId = 'fire' | 'water' | 'earth' | 'air' | 'lightning' | 'metal' | 'shadow' | 'void' | 'tyler' | 'cash';

/** Instruments that can carry a tune. */
export type LeadId = 'flute' | 'oboe' | 'horn' | 'ocarina' | 'glass' | 'bells' | 'vibes' | 'xylo' | 'recorder' | 'sax';

export type TuneNote = [step: number, degree: number, len: number];

/** Step → velocity. */
export type Hits = Record<number, number>;

export interface Theme {
  id: ThemeId;
  /** The bender, for documentation. */
  bender: string;
  /** Semitones above the tonic for scale degrees 0-6. */
  mode: number[];
  /** Chord root, as a scale degree, for each of the four bars. Chords are triads stacked in the mode. */
  prog: number[];
  lead: LeadId;
  /** MIDI note of degree 0 for the lead, before the arena's transposition. */
  base: number;
  /** How loud the lead plays, 0-1. */
  leadVel: number;
  /** Fraction of a note's written length that is held. Near 1 is legato; small is clipped. */
  hold: number;
  tune: TuneNote[][];
  /**
   * How badly the tune is played, 0-1. Notes drift off pitch and off the beat, and some land a
   * semitone out before finding where they were going. It travels with the tune: a sloppy
   * bender is sloppy in someone else's phrase too.
   */
  sloppy?: number;
  /** Seconds the tune sits behind the beat. A little of this is what swagger sounds like. */
  late?: number;
  /** The plucked or struck instrument underneath. */
  comp: 'koto' | 'harp' | 'piano';
  /**
   * Its figure: for each of the 16 steps, which chord tone to pluck, or -1 for
   * a rest. Tones are 0 root, 1 fifth, 2 octave, 3 tenth, 4 twelfth.
   */
  figure: number[];
  compVel: number;
  /** Whole chords on the accompaniment instrument, as well as or instead of the figure: step → velocity. */
  stabs?: Hits;
  /** Stick strokes on the main drum. */
  don: Hits;
  /** Rim strokes. */
  ka: Hits;
  /** Anvil strokes (metal only). */
  anvil?: Hits;
  /** Strokes on the big drum. */
  odaiko: Hits;
  /** Vibraslap, in the last bar of each phrase only (Tyler only). */
  gag?: Hits;
  /** Bass: step → [which note (0 the root, 1 the root an octave up, 2 the fifth), length in steps]. */
  bass: Record<number, [number, number]>;
  /** True if the bass line is a tuba rather than a plucked double bass. */
  tuba?: boolean;
  /** Shaker at rest: 0 none, 1 eighths, 2 sixteenths. The score adds more as a match heats up. */
  shaker: 0 | 1 | 2;
  /** True if the string pad plays from the start rather than joining when things heat up. */
  pad: boolean;
}

const UP_DOWN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];

export const THEMES: Record<ThemeId, Theme> = {
  // Ember. Phrygian dominant: a major tonic with a flat second leaning on it, the scale of a snake charmer
  // or a war horn. An oboe that will not stop repeating itself over the galloping drums.
  fire: {
    id: 'fire',
    bender: 'Ember',
    mode: [0, 1, 4, 5, 7, 8, 10],
    prog: [0, 1, 0, 6],
    lead: 'oboe',
    base: 62,
    leadVel: 0.5,
    hold: 0.9,
    tune: [
      [[0, 4, 3], [3, 4, 1], [4, 5, 2], [6, 4, 2], [8, 7, 4], [12, 5, 2], [14, 4, 2]],
      [[0, 5, 3], [3, 5, 1], [4, 7, 2], [6, 8, 2], [8, 7, 6], [14, 5, 2]],
      [[0, 4, 2], [2, 5, 2], [4, 7, 2], [6, 8, 2], [8, 9, 4], [12, 8, 2], [14, 7, 2]],
      [[0, 7, 6], [6, 6, 2], [8, 4, 8]],
    ],
    comp: 'koto',
    figure: [0, -1, 2, -1, 3, -1, 2, -1, 4, -1, 3, -1, 2, -1, 3, -1],
    compVel: 0.5,
    don: { 0: 1, 3: 0.7, 6: 0.8, 8: 0.9, 11: 0.7, 14: 0.6 },
    ka: { 4: 0.8, 7: 0.3, 10: 0.4, 12: 0.8, 15: 0.35 },
    odaiko: {},
    bass: { 0: [0, 2.4], 3: [0, 2.4], 6: [1, 2], 8: [0, 2.4], 11: [0, 2.4], 14: [1, 2] },
    shaker: 1,
    pad: false,
  },

  // Tide. Dorian: minor with a raised sixth, wistful rather than dark. A flute in long arcs that rise and
  // fall back, over a harp rolling up and down every bar like water coming in.
  water: {
    id: 'water',
    bender: 'Tide',
    mode: [0, 2, 3, 5, 7, 9, 10],
    prog: [0, 3, 6, 0],
    lead: 'flute',
    base: 74,
    leadVel: 0.36,
    hold: 0.97,
    tune: [
      [[0, 0, 6], [6, 2, 2], [8, 4, 6], [14, 3, 2]],
      [[0, 5, 6], [6, 4, 2], [8, 3, 8]],
      [[0, 4, 4], [4, 6, 4], [8, 8, 6], [14, 7, 2]],
      [[0, 7, 4], [4, 4, 4], [8, 2, 2], [10, 1, 2], [12, 0, 4]],
    ],
    comp: 'harp',
    figure: UP_DOWN,
    compVel: 0.4,
    don: { 0: 0.8, 8: 0.6, 11: 0.5 },
    ka: { 4: 0.4, 12: 0.5 },
    odaiko: {},
    bass: { 0: [0, 7], 8: [0, 5], 14: [1, 2] },
    shaker: 1,
    pad: true,
  },

  // Terra. Natural minor, half the pace of everyone else. A French horn in whole-bar tones, the big drum on
  // the downbeat and a long gap before anything answers it.
  earth: {
    id: 'earth',
    bender: 'Terra',
    mode: [0, 2, 3, 5, 7, 8, 10],
    prog: [0, 5, 6, 0],
    lead: 'horn',
    base: 50,
    leadVel: 0.56,
    hold: 0.97,
    tune: [
      [[0, 0, 8], [8, 2, 4], [12, 4, 4]],
      [[0, 5, 8], [8, 4, 8]],
      [[0, 6, 6], [6, 4, 2], [8, 3, 4], [12, 1, 4]],
      [[0, 2, 4], [4, 1, 4], [8, 0, 8]],
    ],
    comp: 'koto',
    figure: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1],
    compVel: 0.55,
    don: { 8: 0.9, 14: 0.55 },
    ka: { 12: 0.5 },
    odaiko: { 0: 1.1, 10: 0.5 },
    bass: { 0: [0, 7], 8: [0, 6] },
    shaker: 0,
    pad: true,
  },

  // Gale. Mixolydian: major with the edge taken off its seventh, a folk-dance scale. An ocarina that never
  // lands, all leaps and off-beats, with almost no drum under it.
  air: {
    id: 'air',
    bender: 'Gale',
    mode: [0, 2, 4, 5, 7, 9, 10],
    prog: [0, 6, 3, 0],
    lead: 'ocarina',
    base: 74,
    leadVel: 0.42,
    hold: 0.7,
    tune: [
      [[0, 0, 2], [2, 2, 2], [4, 4, 2], [6, 7, 2], [10, 4, 2], [12, 5, 1], [13, 4, 1], [14, 2, 2]],
      [[0, 3, 2], [2, 6, 2], [4, 7, 2], [6, 6, 2], [10, 3, 2], [12, 4, 1], [13, 3, 1], [14, 1, 2]],
      [[0, 5, 2], [2, 3, 2], [4, 5, 2], [6, 7, 4], [10, 5, 2], [12, 7, 2], [14, 5, 2]],
      [[0, 4, 3], [3, 2, 3], [6, 4, 2], [8, 7, 8]],
    ],
    comp: 'koto',
    figure: [-1, -1, 2, 3, -1, -1, 4, 3, -1, -1, 2, 3, -1, -1, 4, -1],
    compVel: 0.42,
    don: { 0: 0.6 },
    ka: { 2: 0.3, 6: 0.5, 10: 0.3, 14: 0.5 },
    odaiko: {},
    bass: { 0: [0, 2], 6: [1, 1.5], 8: [0, 2], 14: [1, 1.5] },
    shaker: 2,
    pad: false,
  },

  // Volt. Lydian dominant, the "acoustic" scale: a raised fourth and a flat seventh, bright and unstable at
  // once. A xylophone in bursts of sixteenths that jump an octave with no notes in between.
  lightning: {
    id: 'lightning',
    bender: 'Volt',
    mode: [0, 2, 4, 6, 7, 9, 10],
    prog: [0, 1, 4, 0],
    lead: 'xylo',
    base: 74,
    leadVel: 0.5,
    hold: 1,
    tune: [
      [[0, 0, 1], [1, 0, 1], [2, 7, 1], [4, 4, 1], [5, 4, 1], [6, 3, 1], [8, 0, 1], [9, 7, 1], [11, 7, 1], [12, 4, 2], [14, 3, 1], [15, 4, 1]],
      [[0, 1, 1], [1, 1, 1], [2, 8, 1], [4, 5, 1], [5, 5, 1], [6, 3, 1], [8, 1, 1], [9, 8, 1], [11, 8, 1], [12, 5, 2], [14, 3, 1], [15, 5, 1]],
      [[0, 4, 1], [1, 6, 1], [2, 8, 1], [3, 11, 1], [6, 11, 1], [7, 8, 1], [8, 6, 1], [10, 4, 1], [12, 6, 1], [13, 8, 1], [14, 11, 1]],
      [[0, 7, 1], [1, 7, 1], [3, 7, 1], [4, 9, 1], [6, 7, 1], [8, 4, 1], [9, 3, 1], [10, 4, 1], [12, 0, 4]],
    ],
    comp: 'koto',
    figure: [0, -1, -1, 2, -1, 3, -1, -1, 2, -1, 4, -1, -1, 3, -1, 2],
    compVel: 0.52,
    don: { 0: 1, 3: 0.6, 7: 0.7, 10: 0.8, 13: 0.6 },
    ka: { 2: 0.4, 5: 0.5, 8: 0.7, 11: 0.4, 14: 0.6, 15: 0.5 },
    odaiko: {},
    bass: { 0: [0, 2], 3: [1, 1.5], 7: [0, 2], 10: [0, 2], 13: [1, 1.5] },
    shaker: 2,
    pad: false,
  },

  // Flux. Phrygian: minor with a flat second, cold and heavy. Tubular bells toll a tune that goes out and
  // comes back the way it went, over a machine: four on the floor, an anvil on two and four, a bass that
  // never leaves its note.
  metal: {
    id: 'metal',
    bender: 'Flux',
    mode: [0, 1, 3, 5, 7, 8, 10],
    prog: [0, 1, 6, 0],
    lead: 'bells',
    base: 62,
    leadVel: 0.5,
    hold: 1,
    tune: [
      [[0, 0, 4], [4, 4, 4], [8, 7, 4], [12, 4, 4]],
      [[0, 1, 4], [4, 5, 4], [8, 8, 4], [12, 5, 4]],
      [[0, 6, 4], [4, 8, 4], [8, 10, 4], [12, 8, 4]],
      [[0, 7, 4], [4, 4, 4], [8, 2, 4], [12, 0, 4]],
    ],
    comp: 'koto',
    figure: [0, -1, 0, 1, -1, 0, 1, -1, 0, -1, 0, 1, -1, 0, 1, 2],
    compVel: 0.5,
    don: { 0: 1, 4: 0.7, 8: 0.9, 12: 0.7 },
    ka: { 2: 0.25, 6: 0.25, 10: 0.25, 15: 0.3 },
    anvil: { 4: 0.9, 12: 0.9, 14: 0.45 },
    odaiko: {},
    bass: { 0: [0, 1.6], 2: [0, 1.6], 4: [0, 1.6], 6: [0, 1.6], 8: [0, 1.6], 10: [0, 1.6], 12: [0, 1.6], 14: [0, 1.6] },
    shaker: 0,
    pad: false,
  },

  // Umbra. Harmonic minor, with its leading note a half-step under the tonic and a tritone never far away.
  // A bowed vibraphone, which sounds like a wet finger on a glass, in slow notes that swell out of nothing.
  // The third bar is the first bar upside down. A heartbeat for drums.
  shadow: {
    id: 'shadow',
    bender: 'Umbra',
    mode: [0, 2, 3, 5, 7, 8, 11],
    prog: [0, 5, 3, 4],
    lead: 'glass',
    base: 74,
    leadVel: 0.5,
    hold: 1,
    tune: [
      [[0, 4, 6], [6, 5, 2], [8, 4, 4], [12, 6, 4]],
      [[0, 7, 8], [8, 5, 4], [12, 3, 4]],
      [[0, 3, 6], [6, 2, 2], [8, 3, 4], [12, 1, 4]],
      [[0, 8, 4], [4, 6, 4], [8, 4, 8]],
    ],
    comp: 'koto',
    figure: [0, -1, -1, -1, -1, -1, 3, -1, -1, 2, -1, -1, -1, -1, 3, -1],
    compVel: 0.4,
    don: { 9: 0.5 },
    ka: { 6: 0.3, 14: 0.4 },
    odaiko: { 0: 0.7, 3: 0.45 },
    bass: { 0: [0, 14] },
    shaker: 0,
    pad: true,
  },

  // Rift. Lydian augmented: a major scale with its fourth and fifth both pushed up, so the home chord is
  // augmented and nothing resolves. A vibraphone left ringing, a few notes a bar, each an octave away from
  // where the last one pointed. The harp underneath is in three against the bar's four.
  void: {
    id: 'void',
    bender: 'Rift',
    mode: [0, 2, 4, 6, 8, 9, 11],
    prog: [0, 1, 0, 6],
    lead: 'vibes',
    base: 74,
    leadVel: 0.55,
    hold: 1,
    tune: [
      [[0, 0, 3], [3, 7, 5], [10, 4, 6]],
      [[2, 1, 3], [5, 8, 3], [8, 5, 8]],
      [[0, 9, 2], [2, 2, 6], [10, 6, 6]],
      [[0, 6, 4], [6, 3, 4], [12, 7, 4]],
    ],
    comp: 'harp',
    figure: [0, -1, -1, 2, -1, -1, 3, -1, -1, 4, -1, -1, 3, -1, -1, 2],
    compVel: 0.42,
    don: {},
    ka: { 10: 0.3 },
    odaiko: { 0: 0.8 },
    bass: { 0: [0, 10], 11: [0, 4] },
    shaker: 0,
    pad: true,
  },

  // Tyler. Plain major, the scale of every nursery rhyme, and a school recorder that cannot play it: the
  // opening is the playground taunt (so-so-mi-la-so-mi), a beat is always a sixteenth late somewhere, and
  // the playing itself drifts out of tune and lands on wrong notes. Underneath, a circus: tuba on one and
  // three, a piano that is out of tune with itself on two and four, and a vibraslap where the punchline goes.
  tyler: {
    id: 'tyler',
    bender: 'Tyler',
    mode: [0, 2, 4, 5, 7, 9, 11],
    prog: [0, 3, 4, 0],
    lead: 'recorder',
    base: 74,
    leadVel: 0.42,
    hold: 0.8,
    sloppy: 0.6,
    tune: [
      [[0, 4, 2], [2, 4, 2], [4, 2, 2], [6, 5, 3], [9, 4, 2], [12, 2, 4]],
      [[0, 3, 2], [2, 3, 2], [4, 5, 2], [6, 7, 2], [8, 5, 3], [12, 3, 3]],
      [[0, 4, 1], [1, 4, 1], [2, 6, 2], [4, 8, 2], [6, 6, 2], [8, 4, 2], [11, 6, 1], [12, 8, 3]],
      [[0, 7, 2], [2, 4, 2], [4, 2, 2], [6, 1, 2], [8, 0, 5], [14, 0, 2]],
    ],
    comp: 'piano',
    figure: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1],
    compVel: 0.45,
    stabs: { 4: 0.6, 12: 0.6, 14: 0.35 },
    don: { 0: 0.9, 7: 0.4, 8: 0.8 },
    ka: { 4: 0.7, 12: 0.7, 13: 0.35 },
    odaiko: {},
    gag: { 12: 0.7 },
    bass: { 0: [0, 3], 8: [2, 3] },
    tuba: true,
    shaker: 0,
    pad: false,
  },

  // Kash. Dorian with a raised fourth: a minor scale with the blue note built in. A tenor saxophone that
  // says three things a bar and waits, a hair behind the beat on purpose. Half the pace of the tempo it is
  // given: the big drum on one, the crack on three, sixteenth hats, a bass note that lasts most of the bar,
  // and a grand piano that only plays when it has something to say. The last chord of the four is major
  // and a step above home, which is where the smirk is.
  cash: {
    id: 'cash',
    bender: 'Kash',
    mode: [0, 2, 3, 6, 7, 9, 10],
    prog: [0, 0, 2, 1],
    lead: 'sax',
    base: 62,
    leadVel: 0.5,
    hold: 0.85,
    late: 0.035,
    tune: [
      [[0, 7, 2], [3, 6, 1], [4, 4, 6]],
      [[2, 4, 1], [3, 3, 1], [4, 2, 2], [7, 0, 5]],
      [[0, 6, 3], [3, 4, 1], [4, 2, 4], [10, 4, 2], [12, 6, 4]],
      [[0, 5, 2], [3, 3, 3], [8, 1, 6], [14, 3, 2]],
    ],
    comp: 'piano',
    figure: [-1, -1, -1, -1, -1, -1, 4, -1, -1, -1, -1, -1, -1, -1, 3, -1],
    compVel: 0.4,
    stabs: { 3: 0.55, 11: 0.5 },
    don: {},
    ka: { 8: 0.9, 15: 0.3 },
    odaiko: { 0: 1.1, 10: 0.85 },
    bass: { 0: [0, 9], 10: [0, 4], 14: [1, 2] },
    shaker: 2,
    pad: false,
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** Semitones above the tonic of scale degree `deg` (any integer; 7 is the octave) in `mode`. */
export function degree(mode: number[], deg: number): number {
  const oct = Math.floor(deg / 7);
  return mode[deg - oct * 7] + 12 * oct;
}
