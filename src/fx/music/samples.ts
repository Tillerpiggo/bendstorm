/**
 * The recorded instruments behind the score: which files exist, how they are
 * fetched and decoded, and how a note finds its sample.
 *
 * Files live in `public/audio/` (sources and licences in its CREDITS.md). They
 * are trimmed and levelled offline, so a sample plays from its first frame at
 * unity gain; the only per-file data needed here is the pitch each melodic
 * sample actually sounds at, which was measured rather than trusted from the
 * file name (several zither strings are a quarter-tone off their label).
 *
 * Loading can fail or be slow, and the music must not care: every lookup
 * returns null until its whole instrument has decoded, and the caller plays
 * its synthesised voice instead.
 */

export type Instrument =
  | 'koto' | 'flute' | 'strings' | 'bass' | 'taiko' | 'ka' | 'shaker' | 'gong' | 'hall'
  | 'oboe' | 'horn' | 'ocarina' | 'glass' | 'bells' | 'vibes' | 'harp' | 'xylo' | 'anvil'
  | 'recorder' | 'sax' | 'piano' | 'tuba' | 'slap';

/** Instruments whose manifest rows carry a dynamic layer rather than a pitch. */
const UNPITCHED: ReadonlySet<Instrument> = new Set<Instrument>(['taiko', 'ka', 'shaker', 'gong', 'hall', 'anvil', 'slap']);

/** One playable recording. */
export interface Sample {
  buf: AudioBuffer;
  /** Seconds of decoder padding to skip so the attack lands on time. */
  start: number;
  /** Sounding pitch as a fractional MIDI note (0 for unpitched samples). */
  midi: number;
}

/** [file without extension, sounding MIDI pitch or dynamic layer, variant]. */
type Row = [file: string, a?: number, b?: string];

/**
 * Melodic rows carry the measured pitch; percussion rows carry a dynamic layer
 * (0 = softest). Rows that share a pitch or a layer are round-robin takes.
 */
const MANIFEST: Record<Instrument, Row[]> = {
  // Đàn tranh, two dynamics per string. `b` is the dynamic: 'f' for accents, 'mf' for everything under them.
  koto: [
    ['koto/B2_f', 47.0, 'f'], ['koto/B2_mf', 47.02, 'mf'], ['koto/Cs3_f', 49.23, 'f'], ['koto/Cs3_mf', 49.16, 'mf'],
    ['koto/Ds3_f', 51.28, 'f'], ['koto/Ds3_mf', 51.11, 'mf'], ['koto/Fs3_f', 54.12, 'f'], ['koto/Fs3_mf', 53.97, 'mf'],
    ['koto/Gs3_f', 56.22, 'f'], ['koto/Gs3_mf', 56.07, 'mf'], ['koto/B3_f', 59.14, 'f'], ['koto/B3_mf', 58.97, 'mf'],
    ['koto/Cs4_f', 61.55, 'f'], ['koto/Cs4_mf', 61.39, 'mf'], ['koto/Ds4_f', 63.1, 'f'], ['koto/Ds4_mf', 63.07, 'mf'],
    ['koto/Fs4_f', 65.94, 'f'], ['koto/Fs4_mf', 65.89, 'mf'], ['koto/Gs4_f', 67.94, 'f'], ['koto/Gs4_mf', 67.99, 'mf'],
    ['koto/B4_f', 71.01, 'f'], ['koto/B4_mf', 71.05, 'mf'], ['koto/Cs5_f', 72.99, 'f'], ['koto/Cs5_mf', 72.94, 'mf'],
    ['koto/Ds5_f', 75.02, 'f'], ['koto/Ds5_mf', 75.05, 'mf'], ['koto/Fs5_f', 77.94, 'f'], ['koto/Fs5_mf', 78.03, 'mf'],
    ['koto/Gs5_f', 79.95, 'f'], ['koto/Gs5_mf', 80.03, 'mf'], ['koto/B5_f', 82.9, 'f'], ['koto/B5_mf', 82.97, 'mf'],
  ],
  // Concert flute, sustained with vibrato.
  flute: [
    ['flute/C4', 59.99], ['flute/E4', 64.0], ['flute/A4', 68.99], ['flute/C5', 72.02],
    ['flute/E5', 76.01], ['flute/A5', 81.02], ['flute/C6', 83.96],
  ],
  // String sections for the pad: cellos underneath, violins on top.
  strings: [
    ['strings/cello_G2', 42.99, 'cello'], ['strings/cello_B2', 47.0, 'cello'], ['strings/cello_D3', 50.01, 'cello'],
    ['strings/cello_F3', 53.0, 'cello'], ['strings/cello_A3', 56.99, 'cello'], ['strings/cello_C4', 60.01, 'cello'],
    ['strings/violin_B3', 59.0, 'violin'], ['strings/violin_D4', 62.01, 'violin'], ['strings/violin_Fs4', 66.0, 'violin'],
    ['strings/violin_A4', 69.0, 'violin'], ['strings/violin_C5', 72.0, 'violin'],
  ],
  // Plucked double bass.
  bass: [
    ['bass/E1_1', 27.97], ['bass/E1_2', 27.98], ['bass/G1_1', 30.99], ['bass/G1_2', 30.98],
    ['bass/As1_1', 34.06], ['bass/As1_2', 34.05], ['bass/C2_1', 35.98], ['bass/C2_2', 35.99],
    ['bass/E2_1', 39.98], ['bass/E2_2', 40.0], ['bass/Gs2_1', 44.13], ['bass/Gs2_2', 44.07],
    ['bass/A2_1', 45.2], ['bass/Cs3_1', 48.98], ['bass/E3_1', 52.01], ['bass/Gs3_1', 55.88],
  ],
  // One big drum: stick hits in three dynamics, mallet hits, and a concert bass drum for the odaiko's body.
  taiko: [
    ['taiko/stick_0_1', 0, 'stick'], ['taiko/stick_0_2', 0, 'stick'], ['taiko/stick_1_1', 1, 'stick'], ['taiko/stick_1_2', 1, 'stick'],
    ['taiko/stick_2_1', 2, 'stick'], ['taiko/stick_2_2', 2, 'stick'], ['taiko/stick_2_3', 2, 'stick'],
    ['taiko/mallet_0_1', 0, 'mallet'], ['taiko/mallet_1_1', 1, 'mallet'],
    ['taiko/boom_0_1', 0, 'boom'], ['taiko/boom_0_2', 0, 'boom'], ['taiko/boom_1_1', 1, 'boom'], ['taiko/boom_1_2', 1, 'boom'],
  ],
  ka: [['perc/ka_1'], ['perc/ka_2'], ['perc/ka_3']],
  shaker: [['perc/shaker_1'], ['perc/shaker_2'], ['perc/shaker_3'], ['perc/shaker_4'], ['perc/shaker_5'], ['perc/shaker_6']],
  gong: [['perc/gong']],
  // Oboe with vibrato: the fire theme.
  oboe: [
    ['oboe/As3', 58.06], ['oboe/D4', 62.01], ['oboe/F4', 65.0], ['oboe/As4', 70.0], ['oboe/D5', 74.03], ['oboe/F5', 77.02], ['oboe/As5', 82.04],
    ['oboe/D6', 85.92],
  ],
  // French horn: the earth theme.
  horn: [
    ['horn/G2', 43.04], ['horn/As2', 46.01], ['horn/D3', 49.96], ['horn/F3', 52.98], ['horn/A3', 57.0], ['horn/C4', 59.97],
  ],
  // Ocarina with vibrato: the air theme.
  ocarina: [
    ['ocarina/A4', 68.95], ['ocarina/C5', 72.04], ['ocarina/Ds5', 75.04], ['ocarina/Fs5', 78.08], ['ocarina/A5', 81.14], ['ocarina/C6', 84.17],
  ],
  // Bowed vibraphone, which sings like a rubbed glass: the shadow theme.
  glass: [
    ['glass/E4', 63.99], ['glass/G4', 66.99], ['glass/D5', 73.99], ['glass/A5', 81.0], ['glass/E6', 87.99],
  ],
  // Tubular bells: the metal theme. Their pitch is the nominal strike note; bells do not measure cleanly.
  bells: [
    ['bells/C4', 60], ['bells/D4', 62], ['bells/E4', 64], ['bells/Fs4', 66], ['bells/Gs4', 68], ['bells/As4', 70], ['bells/C5', 72],
    ['bells/D5', 74], ['bells/E5', 76],
  ],
  // Vibraphone, hard mallets: the void theme.
  vibes: [
    ['vibes/C4', 59.99], ['vibes/E4', 64.0], ['vibes/G4', 67.0], ['vibes/B4', 71.0], ['vibes/D5', 74.0], ['vibes/F5', 76.99], ['vibes/A5', 81.0],
    ['vibes/C6', 84.0], ['vibes/E6', 88.0],
  ],
  // Concert harp: the flowing accompaniment under water and void.
  harp: [
    ['harp/F2', 40.9], ['harp/A2', 44.94], ['harp/C3', 47.98], ['harp/E3', 51.95], ['harp/G3', 54.9], ['harp/B3', 58.86], ['harp/D4', 61.87],
    ['harp/F4', 64.99], ['harp/A4', 68.9], ['harp/C5', 71.89], ['harp/E5', 75.88], ['harp/G5', 78.96],
  ],
  // Xylophone: the lightning theme.
  xylo: [
    ['xylo/G4', 67.13], ['xylo/C5', 72.12], ['xylo/G5', 79.14], ['xylo/C6', 84.15], ['xylo/G6', 91.16], ['xylo/C7', 96.17],
  ],
  // Hammer on an anvil, two dynamics: the backbeat of the metal theme.
  anvil: [
    ['perc/anvil_0_1', 0], ['perc/anvil_0_2', 0], ['perc/anvil_0_3', 0], ['perc/anvil_1_1', 1], ['perc/anvil_1_2', 1], ['perc/anvil_1_3', 1],
  ],
  // Soprano recorder, the school kind: the Tyler theme.
  recorder: [
    ['recorder/C5', 72.05], ['recorder/E5', 76.08], ['recorder/Gs5', 80.02], ['recorder/C6', 84.0], ['recorder/E6', 88.06], ['recorder/G6', 91.04],
  ],
  // Tenor saxophone, no vibrato: the Kash theme.
  sax: [
    ['sax/Gs3', 56.0], ['sax/C4', 60.0], ['sax/E4', 64.0], ['sax/Gs4', 68.0], ['sax/C5', 72.0], ['sax/E5', 76.0],
  ],
  // Grand piano, dampers down. Oom-pah chords for Tyler (played twice, out of tune with itself) and sparse ones for Kash.
  piano: [
    ['piano/E2', 39.96], ['piano/Gs2', 43.89], ['piano/C3', 47.98], ['piano/E3', 51.97], ['piano/Gs3', 55.97], ['piano/C4', 60.0],
    ['piano/E4', 63.98], ['piano/Gs4', 67.97], ['piano/C5', 71.94], ['piano/E5', 75.98], ['piano/Gs5', 79.99],
  ],
  // Tuba, staccato, two takes a note: the oom of the oom-pah. Pitches are nominal; the notes are too short to measure.
  tuba: [
    ['tuba/As1_1', 34], ['tuba/As1_2', 34], ['tuba/Ds2_1', 39], ['tuba/Ds2_2', 39], ['tuba/F2_1', 41], ['tuba/F2_2', 41], ['tuba/As2_1', 46],
    ['tuba/As2_2', 46], ['tuba/D3_1', 50], ['tuba/D3_2', 50], ['tuba/F3_1', 53], ['tuba/F3_2', 53],
  ],
  // Vibraslap: the rattle at the end of a bad joke.
  slap: [
    ['perc/vibraslap_1', 0], ['perc/vibraslap_2', 0],
  ],
  // A concert hall's impulse response, for the reverb.
  hall: [['hall_ir']],
};

const INSTRUMENTS = Object.keys(MANIFEST) as Instrument[];

/** Vite serves `public/` from the app's base path; outside Vite (tests, plain bundles) that is the site root. */
function url(file: string): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return `${base}audio/${file}.mp3`;
}

/** Raw file bytes, shared by every audio context. A failed download caches as null. */
const bytes = new Map<string, Promise<ArrayBuffer | null>>();

function download(file: string): Promise<ArrayBuffer | null> {
  let p = bytes.get(file);
  if (!p) {
    p = fetch(url(file))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
    bytes.set(file, p);
  }
  return p;
}

/**
 * Starts downloading every sample. Needs no audio context, so it can run at
 * page load, before the click that unlocks audio; decoding then only has to
 * wait for that click. Safe to call repeatedly and outside a browser.
 */
export function prefetchSamples(): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  for (const inst of INSTRUMENTS) for (const [file] of MANIFEST[inst]) void download(file);
}

function decode(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer | null> {
  return new Promise((resolve) => {
    try {
      // decodeAudioData detaches its input, so each context decodes its own copy.
      const p = ctx.decodeAudioData(data.slice(0), resolve, () => resolve(null));
      if (p) p.catch(() => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

/** MP3 decoders differ in how much encoder padding they leave at the front; find where the sound really starts. */
function leadIn(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const limit = Math.min(d.length, Math.floor(buf.sampleRate * 0.08));
  for (let i = 0; i < limit; i++) {
    if (Math.abs(d[i]) > 0.004) return Math.max(0, i / buf.sampleRate - 0.0015);
  }
  return 0;
}

interface Slot {
  sample: Sample;
  layer: number;
  kind: string;
}

export class SampleBank {
  private slots = new Map<Instrument, Slot[]>();
  private failed = new Set<Instrument>();
  private loading: Promise<void> | null = null;
  private robin = new Map<string, number>();
  /** Called as each instrument finishes decoding. */
  onReady: ((inst: Instrument) => void) | null = null;

  constructor(private ctx: BaseAudioContext) {}

  /** Fetches and decodes everything. Resolves when every instrument has either loaded or failed; never rejects. */
  load(): Promise<void> {
    if (!this.loading) {
      this.loading = typeof fetch === 'undefined' ? Promise.resolve() : Promise.all(INSTRUMENTS.map((i) => this.loadInstrument(i))).then(() => undefined);
    }
    return this.loading;
  }

  private async loadInstrument(inst: Instrument): Promise<void> {
    const rows = MANIFEST[inst];
    const bufs = await Promise.all(
      rows.map(async ([file]) => {
        const data = await download(file);
        return data ? decode(this.ctx, data) : null;
      }),
    );
    // An instrument with a hole in it would stretch its neighbours over the gap; all or nothing.
    if (bufs.some((b) => !b)) {
      this.failed.add(inst);
      return;
    }
    this.slots.set(
      inst,
      rows.map(([, a, b], i) => {
        const buf = bufs[i] as AudioBuffer;
        const pitched = !UNPITCHED.has(inst);
        return { sample: { buf, start: leadIn(buf), midi: pitched ? (a ?? 0) : 0 }, layer: pitched ? 0 : (a ?? 0), kind: b ?? '' };
      }),
    );
    this.onReady?.(inst);
  }

  ready(inst: Instrument): boolean {
    return this.slots.has(inst);
  }

  /** 'ready', 'failed' or 'loading' per instrument, for diagnostics. */
  status(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const i of INSTRUMENTS) out[i] = this.slots.has(i) ? 'ready' : this.failed.has(i) ? 'failed' : 'loading';
    return out;
  }

  private next(key: string, n: number): number {
    const i = ((this.robin.get(key) ?? -1) + 1) % n;
    this.robin.set(key, i);
    return i;
  }

  /**
   * The recording nearest to `midi`, optionally limited to one `kind`
   * (koto dynamic, string section). Takes that share the pitch alternate.
   */
  pitched(inst: Instrument, midi: number, kind?: string): Sample | null {
    const slots = this.slots.get(inst);
    if (!slots) return null;
    let best = Infinity;
    for (const s of slots) {
      if (kind && s.kind !== kind) continue;
      const d = Math.abs(s.sample.midi - midi);
      if (d < best) best = d;
    }
    if (best === Infinity) return null;
    const takes = slots.filter((s) => (!kind || s.kind === kind) && Math.abs(s.sample.midi - midi) < best + 0.3);
    return takes[takes.length > 1 ? this.next(`${inst}/${kind ?? ''}/${Math.round(takes[0].sample.midi)}`, takes.length) : 0].sample;
  }

  /** A percussion hit: the next round-robin take of `kind` at dynamic `layer` (clamped to the layers that exist). */
  hit(inst: Instrument, kind = '', layer = 0): Sample | null {
    const slots = this.slots.get(inst);
    if (!slots) return null;
    const ofKind = slots.filter((s) => s.kind === kind);
    if (!ofKind.length) return null;
    const top = ofKind.reduce((m, s) => Math.max(m, s.layer), 0);
    const want = Math.max(0, Math.min(top, layer));
    const takes = ofKind.filter((s) => s.layer === want);
    return takes[this.next(`${inst}/${kind}/${want}`, takes.length)].sample;
  }

  /** The hall impulse response, once loaded. */
  impulse(): AudioBuffer | null {
    return this.slots.get('hall')?.[0].sample.buf ?? null;
  }
}
