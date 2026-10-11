export type ElementId = 'fire' | 'water' | 'earth' | 'air' | 'lightning' | 'metal' | 'shadow' | 'void' | 'tyler' | 'cash';

/** Held state of one player's seven buttons. */
export interface Pad {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  atk: boolean;
  spc: boolean;
  grd: boolean;
  taunt: boolean;
}

/** One sim step of input: held state plus "pressed this step" edges. */
export interface InputFrame extends Pad {
  upP: boolean;
  downP: boolean;
  atkP: boolean;
  spcP: boolean;
  grdP: boolean;
  tauntP: boolean;
}

export const emptyPad = (): Pad => ({
  left: false,
  right: false,
  up: false,
  down: false,
  atk: false,
  spc: false,
  grd: false,
  taunt: false,
});

export const NO_INPUT: Readonly<InputFrame> = Object.freeze({
  ...emptyPad(),
  upP: false,
  downP: false,
  atkP: false,
  spcP: false,
  grdP: false,
  tauntP: false,
});

export type EventType =
  | 'jump'
  | 'airjump'
  | 'land'
  | 'bounce'
  | 'dash'
  | 'shoot'
  | 'swing'
  | 'special'
  | 'recover'
  | 'diveLand'
  | 'hit'
  | 'shieldUp'
  | 'shield'
  | 'shieldBreak'
  | 'parry'
  | 'strike'
  | 'walljump'
  | 'ledge'
  | 'climb'
  | 'burst'
  | 'empty'
  | 'whip'
  | 'heal'
  | 'gust'
  | 'mine'
  | 'mineBoom'
  | 'wall'
  | 'wallBreak'
  | 'updraft'
  | 'tremor'
  | 'taunt'
  | 'tauntDone'
  | 'note'
  | 'fry'
  | 'pianoSpin'
  | 'pianoCrash'
  | 'gremlin'
  | 'gremlinBite'
  | 'gremlinDie'
  | 'splat'
  | 'crumble'
  | 'restore'
  | 'belt'
  | 'slip'
  | 'midas'
  | 'shatter'
  | 'lambo'
  | 'dance'
  | 'safeDrop'
  | 'safeHit'
  | 'zap'
  | 'blinkOut'
  | 'blinkIn'
  | 'stormWarn'
  | 'stormHit'
  | 'cable'
  | 'armor'
  | 'armorHit'
  | 'swap'
  | 'cloneBoom'
  | 'sink'
  | 'rise'
  | 'curse'
  | 'portal'
  | 'warp'
  | 'flip'
  | 'well'
  | 'wellBoom'
  | 'clash'
  | 'fizzle'
  | 'pillarWarn'
  | 'pillarErupt'
  | 'ko'
  | 'respawn'
  | 'ultStart'
  | 'ultFire'
  | 'ultEnd'
  | 'count'
  | 'gameover';

/**
 * Something the presentation layer (particles, audio, camera) may react to.
 * The sim never reads these back. `id` is the fighter the event is about,
 * `power` and `dir` mean whatever the event type needs (see emit sites).
 */
export interface GameEvent {
  type: EventType;
  x: number;
  y: number;
  id: number;
  el: ElementId;
  power: number;
  dir: number;
  /** Hit events: damage dealt, and how many hits into the attacker's current combo this is. */
  amt: number;
  combo: number;
}
