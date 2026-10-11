/** A platform's path: an ellipse around its home, `dx` wide and `dy` tall. One axis at 0 is a straight slide. */
export interface Motion {
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

/** `x` is the centre, `y` the top surface. Solid platforms block from every side. */
export interface Platform {
  x: number;
  y: number;
  w: number;
  thick: number;
  solid: boolean;
  move?: Motion;
  /** Gives way under anyone who stands on it too long, then comes back. */
  crumble?: boolean;
  // ---- Live state, owned by the Game that cloned this stage. ----
  /** Home position the motion is measured from. */
  bx: number;
  by: number;
  /** Velocity this step, so riders are carried along. */
  vx: number;
  vy: number;
  /** Seconds someone has been standing on a crumbling platform. */
  shake: number;
  /** Seconds until a collapsed platform returns; it does not exist while this is above 0. */
  gone: number;
}

export type StageId = 'temple' | 'glacier' | 'crater' | 'carousel' | 'rift' | 'foundry';
/** What the arena itself throws at the fighters. */
export type Hazard = 'none' | 'icicle' | 'geyser' | 'storm' | 'vent';

/** Collision layout and rules of one arena. How it looks lives in scene/themes.ts under the same id. */
export interface StageDef {
  id: StageId;
  name: string;
  blurb: string;
  /** The one solid block. Always also the first entry of `platforms`. */
  main: Platform;
  platforms: Platform[];
  /** Crossing any of these costs a stock. The top only counts while launched. */
  blast: { left: number; right: number; top: number; bottom: number };
  spawnX: [number, number];
  respawn: { x: [number, number]; y: number };
  /** 1 is normal grip; near 0 is ice. */
  friction: number;
  /** Multiplier on how hard fighters fall. */
  gravity: number;
  hazard: Hazard;
  /** The main floor is a conveyor that reverses every few seconds. */
  belt: boolean;
  /** Flying off one side brings you back in on the other: only the top and bottom kill. */
  wrap: boolean;
}

const soft = (x: number, y: number, w: number, move?: Motion, crumble = false): Platform => ({
  x,
  y,
  w,
  thick: 0.32,
  solid: false,
  move,
  crumble,
  bx: x,
  by: y,
  vx: 0,
  vy: 0,
  shake: 0,
  gone: 0,
});
const path = (dx: number, dy: number, period: number, phase = 0): Motion => ({ dx, dy, period, phase });
const BLAST = { left: -24, right: 24, top: 22, bottom: -12 };

function make(id: StageId, name: string, blurb: string, mainW: number, softs: Platform[], rules: Partial<Pick<StageDef, 'friction' | 'gravity' | 'hazard' | 'belt' | 'wrap'>> = {}): StageDef {
  const main: Platform = { ...soft(0, 0, mainW), thick: 2.6, solid: true };
  return {
    id,
    name,
    blurb,
    main,
    platforms: [main, ...softs],
    blast: BLAST,
    spawnX: [-Math.min(5, mainW / 2 - 2), Math.min(5, mainW / 2 - 2)],
    respawn: { x: [-3, 3], y: 9.5 },
    friction: 1,
    gravity: 1,
    hazard: 'none',
    belt: false,
    wrap: false,
    ...rules,
  };
}

const HALF = Math.PI / 2;

export const STAGES: Record<StageId, StageDef> = {
  temple: make('temple', 'Sunset Temple', 'Three platforms that never sit still.', 22, [
    soft(-6.4, 2.9, 4.6, path(0, 0.9, 6)),
    soft(6.4, 2.9, 4.6, path(0, 0.9, 6, Math.PI)),
    soft(0, 5.7, 5, path(4.2, 0, 9)),
  ]),
  glacier: make(
    'glacier',
    'Aurora Glacier',
    'Sheet ice underfoot, sliding shelves, and icicles coming down.',
    19,
    [soft(-5.3, 3.0, 4.4, path(2.4, 0, 7)), soft(5.3, 3.0, 4.4, path(2.4, 0, 7, Math.PI))],
    { friction: 0.14, hazard: 'icicle' },
  ),
  crater: make(
    'crater',
    'Ember Crater',
    'A small island. Lava erupts through the gaps on either side.',
    16,
    [soft(0, 3.1, 5.6), soft(-12, 0.9, 3.2, path(0, 1.3, 5)), soft(12, 0.9, 3.2, path(0, 1.3, 5, Math.PI))],
    { hazard: 'geyser' },
  ),
  carousel: make(
    'carousel',
    'Storm Carousel',
    'Four platforms wheel around a tiny floor while the sky takes shots at you.',
    13,
    [0, 1, 2, 3].map((i) => soft(0, 4.3, 3.6, path(7.2, 3.3, 11, i * HALF))),
    { hazard: 'storm' },
  ),
  rift: make(
    'rift',
    'Hollow Rift',
    'Low gravity, and the sides wrap around. Only up and down are fatal.',
    18,
    [soft(-6, 3.2, 4, path(2.5, 1.4, 8)), soft(6, 3.2, 4, path(2.5, 1.4, 8, Math.PI)), soft(0, 7.4, 4.4, path(5, 0, 12, HALF))],
    { gravity: 0.6, wrap: true },
  ),
  foundry: make(
    'foundry',
    'The Foundry',
    'The floor is a conveyor, the side platforms crumble, and the vents are live.',
    20,
    [soft(-6.2, 3.0, 4, undefined, true), soft(6.2, 3.0, 4, undefined, true), soft(0, 4.4, 3.6, path(0, 2, 6))],
    { belt: true, hazard: 'vent' },
  ),
};

export const STAGE_IDS: StageId[] = ['temple', 'glacier', 'crater', 'carousel', 'rift', 'foundry'];

/** A private copy for one match: platforms move and crumble, so each Game needs its own. */
export function cloneStage(def: StageDef): StageDef {
  const platforms = def.platforms.map((p) => ({ ...p }));
  return { ...def, platforms, main: platforms[0] };
}

/** Moves every platform to where it should be at time `t`, recording its velocity for whoever is riding it. */
export function movePlatforms(stage: StageDef, t: number, dt: number): void {
  for (const p of stage.platforms) {
    const m = p.move;
    if (!m) continue;
    const a = (t / m.period) * Math.PI * 2 + m.phase;
    const nx = p.bx + m.dx * Math.cos(a);
    const ny = p.by + m.dy * Math.sin(a);
    p.vx = (nx - p.x) / dt;
    p.vy = (ny - p.y) / dt;
    p.x = nx;
    p.y = ny;
  }
}

/** Highest standing platform under the point (x, y), allowing a little slack above the feet. */
export function groundBelow(stage: StageDef, x: number, y: number): Platform | null {
  let best: Platform | null = null;
  for (const p of stage.platforms) {
    if (p.gone > 0 || Math.abs(x - p.x) > p.w / 2) continue;
    if (p.y > y + 0.3) continue;
    if (!best || p.y > best.y) best = p;
  }
  return best;
}
