/**
 * The mixing desk. Voices plug into a per-instrument bus; each bus has its own
 * EQ and (for drums and bass) saturation and compression, then everything
 * meets on a music sum with one shared reverb send, a glue compressor and the
 * fader that `Music.duck()` rides.
 *
 *   voice ─▶ bus.in ─▶ EQ ─▶ [saturate ─▶ compress] ─▶ level ─┬─▶ [rhythm] ─▶ sum ─▶ glue ─▶ hush ─▶ fader ─▶ master
 *                                                             └─▶ send ─▶ pre-delay ─▶ hall ─▶ high-cut ─▶ sum
 *
 * `rhythm` (drums, shaker, bass) and `hush` (everything) are two gains the
 * match score pulls down for a moment: see music.ts.
 *
 * Every node here is built once. A note costs a buffer source and a gain.
 *
 * `createMasterChain` is the output stage the music shares with the sound
 * effects; it lives here so tests can render through the same chain offline.
 */

/** Where an instrument's voices connect. Recorded and synthesised voices sit at different levels, so each has its own input. */
export interface Bus {
  in: AudioNode;
  /** Input for the synthesised fallback voice, trimmed to sit where the recording does. */
  synth: AudioNode;
}

/** Three places to sit across the stereo field: left, centre, right. In a match, player 1's lead sits left and player 2's right. */
export type Seats = [Bus, Bus, Bus];

export interface MusicMix {
  taiko: Bus;
  ka: Bus;
  shaker: Bus;
  bass: Bus;
  /** Plucked strings (koto, harp). Left, centre, right. */
  koto: Seats;
  /** Sustained leads (flute, oboe, ocarina, horn, bowed glass). Left, centre, right. */
  wind: Seats;
  /** Struck leads (xylophone, vibraphone, bells). Left, centre, right. */
  mallet: Seats;
  pad: Bus;
  gong: Bus;
  /** Drums, shaker and bass pass through this on the way to the sum; the score pulls it down to expose the melody. */
  rhythm: GainNode;
  /** The whole band passes through this before the fader; the score closes it for a held breath. */
  hush: GainNode;
  /** The music fader. */
  out: GainNode;
  /** Swaps the generated reverb tail for a recorded hall. */
  setImpulse(ir: AudioBuffer): void;
}

type FilterType = 'highpass' | 'lowpass' | 'peaking' | 'lowshelf' | 'highshelf';

function filter(ctx: BaseAudioContext, type: FilterType, freq: number, gainDb = 0, q = 0.707): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.gain.value = gainDb;
  f.Q.value = q;
  return f;
}

function gain(ctx: BaseAudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

/** Connects nodes in series and returns the last one. */
function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]);
  return nodes[nodes.length - 1];
}

function compressor(ctx: BaseAudioContext, threshold: number, ratio: number, knee: number, attack: number, release: number): DynamicsCompressorNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = threshold;
  c.ratio.value = ratio;
  c.knee.value = knee;
  c.attack.value = attack;
  c.release.value = release;
  return c;
}

/**
 * Tape-style soft saturation: tanh(drive·x) / drive. Quiet signal passes at
 * unity; peaks round over instead of poking out, which adds the low-order
 * harmonics that let a drum or bass read on small speakers.
 */
function saturator(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const n = 2049;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / drive;
  }
  const ws = ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '4x';
  return ws;
}

function bus(ctx: BaseAudioContext, synthTrim: number): { bus: Bus; node: GainNode } {
  const node = gain(ctx, 1);
  const synth = gain(ctx, synthTrim);
  synth.connect(node);
  return { bus: { in: node, synth }, node };
}

/** Small deterministic generator so the generated reverb is the same every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Stand-in hall, used until the recorded impulse response has loaded (and for
 * good if it never does): a few early reflections, then diffuse noise whose
 * highs die away faster than its lows, different in each ear.
 */
function generatedImpulse(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 1.7);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const rand = lcg(0x51ed + ch * 7919);
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      // The low-pass closes as the tail decays: bright onset, dark end.
      const k = 0.62 * Math.exp(-t * 1.9) + 0.06;
      lp += (rand() * 2 - 1 - lp) * k;
      // -60 dB at about 1.3 s, with a short build so the tail blooms rather than slaps.
      d[i] = lp * Math.exp(-t * 5.3) * Math.min(1, t / 0.012);
    }
    for (let r = 0; r < 7; r++) {
      const at = Math.floor(sr * (0.007 + rand() * 0.06));
      d[at] += (rand() > 0.5 ? 1 : -1) * (0.5 - r * 0.05);
    }
    const fade = Math.floor(sr * 0.2);
    for (let i = len - fade; i < len; i++) d[i] *= (len - i) / fade;
  }
  return ir;
}

/**
 * A measured impulse response starts with the direct sound (which a send
 * reverb must not repeat) and ends in the recording's noise floor. Keep the
 * part in between.
 */
function trimImpulse(ctx: BaseAudioContext, src: AudioBuffer): AudioBuffer {
  const sr = src.sampleRate;
  const chans = Math.min(2, src.numberOfChannels);
  let peak = 0;
  for (let ch = 0; ch < chans; ch++) {
    const d = src.getChannelData(ch);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  let direct = 0;
  const first = src.getChannelData(0);
  for (let i = 0; i < first.length; i++) {
    if (Math.abs(first[i]) > peak * 0.5) {
      direct = i;
      break;
    }
  }
  const start = direct + Math.floor(sr * 0.004);
  const len = Math.max(1, Math.min(src.length - start, Math.floor(sr * 1.1)));
  const out = ctx.createBuffer(2, len, sr);
  const fadeIn = Math.floor(sr * 0.003);
  const fadeOut = Math.floor(sr * 0.4);
  for (let ch = 0; ch < 2; ch++) {
    const from = src.getChannelData(Math.min(ch, chans - 1));
    const to = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      let g = 1;
      if (i < fadeIn) g = i / fadeIn;
      if (i > len - fadeOut) g = (len - i) / fadeOut;
      to[i] = from[start + i] * g;
    }
  }
  return out;
}

/**
 * How late the drum and bass buses come out, in seconds: 6 ms of compressor
 * look-ahead plus about 4 ms for the saturator's 4x oversampling filters
 * (measured in Chromium at 44.1 and 48 kHz).
 */
const DYNAMICS_LATENCY = 0.01;

export function createMusicMix(ctx: BaseAudioContext, dest: AudioNode, level: number): MusicMix {
  const out = gain(ctx, level);
  out.connect(dest);

  // Glue: a slow, gentle squeeze over the whole band so it moves as one.
  const glue = compressor(ctx, -15, 2, 12, 0.03, 0.25);
  const sum = gain(ctx, 1);
  const hush = gain(ctx, 1);
  chain(sum, glue, hush, out);
  const rhythm = gain(ctx, 1);
  rhythm.connect(sum);

  // ---- Reverb: one hall for everybody, on a send. ----
  const send = gain(ctx, 1);
  const preDelay = ctx.createDelay(0.1);
  preDelay.delayTime.value = 0.024;
  // Keep lows out of the hall (they only blur) and shave the fizz off what comes back.
  const hallIn = chain(send, preDelay, filter(ctx, 'highpass', 260)) as BiquadFilterNode;
  const hallOut = filter(ctx, 'lowpass', 6200, 0, 0.6);
  chain(hallOut, filter(ctx, 'peaking', 450, -2, 0.8), gain(ctx, 1.3), sum);

  let live: { conv: ConvolverNode; level: GainNode } | null = null;
  const useImpulse = (ir: AudioBuffer): void => {
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const fresh = { conv, level: gain(ctx, live ? 0 : 1) };
    chain(hallIn, conv, fresh.level, hallOut);
    const old = live;
    live = fresh;
    if (!old) return;
    // Cross-fade so a swap mid-phrase does not cut the tail that is ringing.
    const now = ctx.currentTime;
    const realtime = typeof window !== 'undefined' && !('startRendering' in ctx);
    if (realtime) {
      fresh.level.gain.setTargetAtTime(1, now, 0.12);
      old.level.gain.setTargetAtTime(0, now, 0.12);
      window.setTimeout(() => {
        hallIn.disconnect(old.conv);
        old.level.disconnect();
      }, 1500);
    } else {
      fresh.level.gain.value = 1;
      hallIn.disconnect(old.conv);
      old.level.disconnect();
    }
  };
  useImpulse(generatedImpulse(ctx));

  /**
   * Finishes a bus: sets its level into the sum and how much of it reaches the hall.
   * Saturation and compression take time, so a bus with them (`dynamics`) comes out late;
   * the buses without are delayed to match, or the drums would drag behind the koto.
   */
  const place = (tail: AudioNode, busLevel: number, wet: number, dynamics = false, into: AudioNode = sum): void => {
    const lv = gain(ctx, busLevel);
    if (dynamics) tail.connect(lv);
    else {
      const align = ctx.createDelay(0.05);
      align.delayTime.value = DYNAMICS_LATENCY;
      chain(tail, align, lv);
    }
    lv.connect(into);
    if (wet > 0) chain(lv, gain(ctx, wet), send);
  };

  // ---- Drums: taiko and rim share a bus so the compressor glues them. ----
  const taiko = bus(ctx, 0.42);
  const ka = bus(ctx, 0.6);
  const drums = gain(ctx, 1);
  chain(
    taiko.node,
    filter(ctx, 'highpass', 34),
    filter(ctx, 'lowshelf', 95, 2),
    filter(ctx, 'peaking', 330, -4, 1.1), // boxiness
    filter(ctx, 'peaking', 3600, 3, 0.9), // stick on skin
    drums,
  );
  const kaPan = ctx.createStereoPanner();
  kaPan.pan.value = -0.14;
  chain(ka.node, filter(ctx, 'highpass', 600), filter(ctx, 'peaking', 2600, 2, 1), kaPan, drums);
  // Slow attack lets the stick through; the body behind it is what gets held.
  place(chain(drums, saturator(ctx, 1.5), compressor(ctx, -17, 4, 6, 0.014, 0.13)), 0.86, 0.17, true, rhythm);

  const shaker = bus(ctx, 2.5);
  const shakerPan = ctx.createStereoPanner();
  shakerPan.pan.value = 0.3;
  place(chain(shaker.node, filter(ctx, 'highpass', 3800), filter(ctx, 'highshelf', 9000, 2), shakerPan), 0.5, 0.08, false, rhythm);

  // ---- Bass: dead centre, dry, evened out, with enough grit to be heard on a laptop. ----
  const bass = bus(ctx, 0.32);
  place(
    chain(
      bass.node,
      filter(ctx, 'highpass', 32),
      filter(ctx, 'peaking', 240, -3, 1),
      filter(ctx, 'peaking', 850, 3, 0.9), // finger on string
      filter(ctx, 'lowpass', 4200),
      saturator(ctx, 2.4),
      compressor(ctx, -21, 4, 8, 0.02, 0.16),
    ),
    0.6,
    0.03,
    true,
    rhythm,
  );

  /** Three pan positions feeding one EQ chain. */
  const seats = (width: number, synthTrim: number, eq: AudioNode[], busLevel: number, wet: number): Seats => {
    const head = gain(ctx, 1);
    place(chain(head, ...eq), busLevel, wet);
    return [-width, 0, width].map((pan) => {
      const b = bus(ctx, synthTrim);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      chain(b.node, p, head);
      return b.bus;
    }) as Seats;
  };

  // ---- Plucked strings: koto and harp. ----
  const koto = seats(
    0.36,
    0.9,
    [filter(ctx, 'highpass', 125), filter(ctx, 'peaking', 320, -2.5, 1), filter(ctx, 'peaking', 3200, 4, 0.8), filter(ctx, 'highshelf', 6000, 6)],
    0.8,
    0.26,
  );

  // ---- Sustained leads: the tune. Thinned below, a little presence and air above, the wettest thing in the hall. ----
  const wind = seats(
    0.3,
    0.75,
    [filter(ctx, 'highpass', 170), filter(ctx, 'peaking', 380, -2, 1), filter(ctx, 'peaking', 2800, 1.5, 0.8), filter(ctx, 'highshelf', 8000, 4.5)],
    0.9,
    0.36,
  );

  // ---- Struck leads: mallets and bells. Already bright; just cleared out underneath. ----
  const mallet = seats(0.3, 0.9, [filter(ctx, 'highpass', 190), filter(ctx, 'peaking', 420, -2, 1), filter(ctx, 'highshelf', 7000, 2)], 0.8, 0.3);

  // ---- String pad: wide, soft-edged, tucked behind everything. ----
  const pad = bus(ctx, 0.85);
  place(chain(pad.node, filter(ctx, 'highpass', 150), filter(ctx, 'peaking', 300, -3, 0.9), filter(ctx, 'lowpass', 7000, 0, 0.5)), 0.6, 0.45);

  const gong = bus(ctx, 0.9);
  place(chain(gong.node, filter(ctx, 'highpass', 48), filter(ctx, 'peaking', 300, -2, 0.8)), 0.55, 0.5);

  return {
    taiko: taiko.bus,
    ka: ka.bus,
    shaker: shaker.bus,
    bass: bass.bus,
    koto,
    wind,
    mallet,
    pad: pad.bus,
    gong: gong.bus,
    rhythm,
    hush,
    out,
    setImpulse: (ir) => useImpulse(trimImpulse(ctx, ir)),
  };
}

/**
 * The game's output stage: music and sound effects both arrive here.
 * Returns the node to connect to.
 *
 *   in ─▶ compressor ─▶ limiter ─▶ ceiling ─▶ dest
 *
 * The compressor is the one the effects were balanced against, so a big hit
 * still pushes the music down for a moment. The limiter catches what gets
 * past it, and the ceiling is a soft clipper whose output cannot exceed
 * CEILING whatever goes in, so the output never reaches full scale.
 */
const CEILING = 0.94;
export function createMasterChain(ctx: BaseAudioContext, dest: AudioNode): AudioNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 5;
  const limiter = compressor(ctx, -2.5, 20, 0, 0.001, 0.08);

  // Transparent below KNEE, then bends smoothly towards CEILING. The curve covers inputs of ±2.
  const KNEE = 0.72;
  const n = 4097;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const a = Math.abs(x);
    curve[i] = Math.sign(x) * (a <= KNEE ? a : KNEE + (CEILING - KNEE) * Math.tanh((a - KNEE) / (CEILING - KNEE)));
  }
  const clip = ctx.createWaveShaper();
  clip.curve = curve;
  // No oversampling: its filters ring past the ceiling, and this stage is idle unless something has gone wrong upstream.
  clip.oversample = 'none';

  chain(comp, limiter, gain(ctx, 0.5), clip, dest);
  return comp;
}
