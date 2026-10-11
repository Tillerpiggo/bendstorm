/**
 * The fight simulation. Pure TypeScript: no DOM, no three.js, no wall clock.
 * It advances in fixed steps of DT from two InputFrames, so the same code runs
 * in the browser, in bot-vs-bot attract mode and in the node tests.
 *
 * The presentation layer reads fighter/projectile fields directly every frame
 * and drains `Game.events` for one-shot reactions (particles, sound, shake).
 */
import { ELEMENTS, type ElementDef } from './elements';
import { STAGES, cloneStage, groundBelow, movePlatforms, type Platform, type StageDef, type StageId } from './stage';
import { NO_INPUT, type ElementId, type EventType, type GameEvent, type InputFrame } from './types';

export const DT = 1 / 120;
/** Fighter hurtbox: feet at (x, y), half-width HW, height HEIGHT. */
export const HW = 0.42;
export const HEIGHT = 1.75;
export const MAX_SHIELD = 50;
export const START_STOCKS = 3;
export const STUN_TIME = 2.2;
export const PILLAR_DELAY = 0.38;
export const PILLAR_LIFE = 1.5;
export const INTRO_TIME = 3.4;

/** Every ultimate opens with this long a wind-up, during which the rest of the world is frozen. */
export const ULT_CHARGE = 0.85;
/** Fire: how long the beam is out, and its half-height. */
export const ULT_BEAM = 1.1;
export const ULT_END = 0.3;
export const ULT_HALF_HEIGHT = 0.95;
/** Water: radius of the tsunami's hit circle. */
export const TSUNAMI_R = 3.3;
/** Air: how long the tempest spins, and how close you must be to get cut by it. */
export const TEMPEST_TIME = 1.3;
export const TEMPEST_R = 4.6;
/** Earth: pillars in the quake line. */
export const QUAKE_PILLARS = 9;

/** A fighter hanging from the lip has their feet this far below it. */
export const LEDGE_HANG = 1.6;
export const CLIMB_TIME = 0.26;
export const WALL_HEIGHT = 2.7;
export const WALL_LIFE = 4.5;
export const MINE_LIFE = 7;
export const UPDRAFT_LIFE = 3.2;
export const UPDRAFT_HALF = 1.2;
export const FLAME_RANGE = 4.8;
export const WHIP_RANGE = 7.5;
export const GUST_RANGE = 6.5;
/** Lightning: reach of the hitscan arc, and the telegraph before a sky strike lands. */
export const ZAP_RANGE = 6.5;
export const STORM_DELAY = 0.7;
/** Metal: how long Iron Skin lasts, and the wind-up of Magnet Crush. */
export const ARMOR_TIME = 2.6;
export const CRUSH_TIME = 0.95;
/** Shadow: how long Nightmare scrambles the opponent's controls. */
export const CONFUSE_TIME = 5;
/** Void: portal and singularity lifetimes, and how long a flipped fighter falls upward. */
export const PORTAL_LIFE = 6;
export const PORTAL_R = 0.95;
export const WELL_LIFE = 1.8;
export const HORIZON_LIFE = 1.7;
export const FLIP_TIME = 1.5;
/** Tyler: radius of the Deep Fry cloud, the piano's wind-up spin, and how long the storm lasts. */
export const FRY_R = 3;
export const PIANO_SPIN = 0.42;
export const STORM_TIME = 2.2;
export const GREMLIN_LIFE = 9;
/** Kash: how long a Midas statue lasts, how long Loose Change lies there, and how long they dance. */
export const GOLD_TIME = 1.4;
export const CASH_LIFE = 5.5;
export const DANCE_TIME = 2;
/** A taunt holds you still this long. Finish it and it pays out in Spirit. */
export const TAUNT_TIME = 1.25;

const BUF = 0.13;
const GRAVITY = 44;
const MAX_FALL = 22;
const FAST_FALL = 34;
const DASH_TIME = 0.17;
const DASH_SPEED = 27;
const DASH_CD = 0.6;
/** A shield raised this recently parries instead of blocking. */
const PARRY_WINDOW = 0.14;
/** Up + Attack is a rising strike only this soon after pressing Up; held longer, it aims the shot upward. */
const RISE_WINDOW = 0.28;
const AIM_UP = (34 * Math.PI) / 180;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const approach = (v: number, target: number, d: number) =>
  v < target ? Math.min(v + d, target) : Math.max(v - d, target);
const sign = (v: number) => (v < 0 ? -1 : 1);

export interface HitSpec {
  dmg: number;
  /** Knockback speed = (base + growth * victimDamage / 100) / victimWeight. */
  base: number;
  growth: number;
  /** Launch angle in degrees above horizontal, mirrored by the hit direction. */
  angle: number;
  shieldDmg?: number;
  /** Multi-hit ticks set the victim's velocity outright instead of launching. */
  fixed?: { vx: number; vy: number; stun: number };
  /** Ultimates cannot be parried and build no meter. */
  ult?: boolean;
  /** Which move this is, for staling: landing the same move over and over weakens it. */
  id?: string;
  /** One pellet of a spread: counts for little toward the victim breaking free. */
  light?: boolean;
  /** Chip damage: it stings and nudges, but does not interrupt what the victim is doing. */
  soft?: boolean;
}

const RISE: HitSpec = { dmg: 9, base: 14, growth: 19, angle: 82, id: 'rise' };
const SWEEP: HitSpec = { dmg: 8, base: 12, growth: 24, angle: 38, id: 'sweep' };
const DIVE: HitSpec = { dmg: 10, base: 13, growth: 21, angle: 62, id: 'dive' };
const DIVE_SPIKE: HitSpec = { dmg: 10, base: 12, growth: 14, angle: -72, id: 'dive' };
const SHOCK: HitSpec = { dmg: 6, base: 12, growth: 9, angle: 60, id: 'shock' };
const RECOVER: HitSpec = { dmg: 6, base: 11, growth: 9, angle: 72, id: 'recover' };
const FIRE_DASH: HitSpec = { dmg: 13, base: 15, growth: 25, angle: 32, id: 'special' };
const WAVE: HitSpec = { dmg: 11, base: 15, growth: 31, angle: 44, id: 'special' };
const PILLAR: HitSpec = { dmg: 14, base: 17, growth: 22, angle: 84, id: 'special' };
const CYCLONE_END: HitSpec = { dmg: 6, base: 15, growth: 23, angle: 80, id: 'special' };
const FLAME_END: HitSpec = { dmg: 4, base: 12, growth: 14, angle: 35, id: 'side' };
const MINE: HitSpec = { dmg: 12, base: 14, growth: 22, angle: 72, id: 'down' };
const WALL_RISE: HitSpec = { dmg: 6, base: 11, growth: 8, angle: 62, id: 'side' };
const TREMOR: HitSpec = { dmg: 9, base: 13, growth: 17, angle: 76, id: 'down' };
const BLINK: HitSpec = { dmg: 9, base: 13, growth: 20, angle: 50, id: 'special' };
const STORM: HitSpec = { dmg: 13, base: 16, growth: 22, angle: 80, id: 'down' };
const STORM_ULT: HitSpec = { dmg: 8, base: 12, growth: 15, angle: 78, ult: true };
const SLAM: HitSpec = { dmg: 11, base: 15, growth: 22, angle: 45, id: 'special' };
const SHARD: HitSpec = { dmg: 3.2, base: 6, growth: 5, angle: 30, id: 'side', light: true };
const CRUSH: HitSpec = { dmg: 34, base: 20, growth: 25, angle: 50, shieldDmg: 60, ult: true };
const CLONE: HitSpec = { dmg: 10, base: 13, growth: 18, angle: 60, id: 'side' };
const ERUPT: HitSpec = { dmg: 9, base: 14, growth: 18, angle: 85, id: 'down' };
const WELL: HitSpec = { dmg: 12, base: 14, growth: 20, angle: 70, id: 'down' };
const HORIZON: HitSpec = { dmg: 12, base: 20, growth: 27, angle: 75, ult: true };
const PIANO: HitSpec = { dmg: 24, base: 22, growth: 34, angle: 40, shieldDmg: 60, id: 'side' };
/** For things that are spawned as projectiles but do their damage some other way. */
const NO_HIT: HitSpec = { dmg: 0, base: 0, growth: 0, angle: 0 };
/** What the arenas themselves hit with. */
const ICICLE: HitSpec = { dmg: 9, base: 12, growth: 14, angle: 70 };
const SKY_BOLT: HitSpec = { dmg: 11, base: 14, growth: 18, angle: 80 };
const GEYSER: HitSpec = { dmg: 12, base: 16, growth: 20, angle: 86 };
const MIDAS: HitSpec = { dmg: 8, base: 0, growth: 0, angle: 0, shieldDmg: 20, id: 'special', fixed: { vx: 0, vy: -4, stun: GOLD_TIME } };
const LAMBO: HitSpec = { dmg: 14, base: 16, growth: 24, angle: 38, id: 'side' };
const VAULT: HitSpec = { dmg: 20, base: 24, growth: 32, angle: 70, shieldDmg: 60, ult: true };

/** Cooldowns of the directional specials. All three specials share one cooldown clock. */
const SPECIAL_CD: Record<ElementId, { side: number; down: number }> = {
  fire: { side: 2.6, down: 3.2 },
  water: { side: 2.4, down: 5 },
  earth: { side: 4, down: 3 },
  air: { side: 2.2, down: 4 },
  lightning: { side: 5, down: 3.5 },
  metal: { side: 2.6, down: 7 },
  shadow: { side: 3, down: 4 },
  void: { side: 4, down: 5 },
  tyler: { side: 5, down: 6 },
  cash: { side: 4, down: 4.5 },
};

/** How long each element's neutral special keeps the fighter busy. */
const SPECIAL_DUR: Record<ElementId, number> = { fire: 0.62, water: 0.52, earth: 0.52, air: 0.52, lightning: 0.56, metal: 0.62, shadow: 0.48, void: 0.48, tyler: 0.5, cash: 0.5 };
const BEAM_FINAL: HitSpec = { dmg: 9, base: 18, growth: 24, angle: 30, ult: true };
const TSUNAMI: HitSpec = { dmg: 30, base: 19, growth: 25, angle: 40, shieldDmg: 60, ult: true };
const QUAKE: HitSpec = { dmg: 32, base: 19, growth: 24, angle: 84, shieldDmg: 60, ult: true };
const TEMPEST_FINAL: HitSpec = { dmg: 10, base: 19, growth: 26, angle: 86, ult: true };

export type FighterState = 'free' | 'move' | 'hitstun' | 'shield' | 'stunned' | 'dash' | 'dead' | 'ult' | 'ledge' | 'climb' | 'taunt' | 'dance';
export type MoveKind = 'bolt' | 'rise' | 'sweep' | 'dive' | 'special' | 'spcSide' | 'spcDown' | 'recover';

export interface Move {
  kind: MoveKind;
  t: number;
  dur: number;
  /** The move's one-shot effect (projectile spawn, launch) has happened. */
  fired: boolean;
  /** The melee hitbox already connected; it never hits twice. */
  hit: boolean;
  /** Dive only: touched down and is in landing lag. */
  landed: boolean;
  /** Movement control while the move runs, 0-1. */
  ctl: number;
  /** Bolt only: 1 when the shot is angled upward. */
  aim: number;
  /** Multi-hit moves: damage ticks dealt so far. */
  ticks: number;
}

export type ProjKind = 'bolt' | 'wave' | 'cyclone' | 'tsunami' | 'tremor' | 'orb' | 'clone' | 'fry' | 'piano' | 'poop';

/** How a bolt flies: straight, a disc going out, a disc coming home, a wall-passing seeker, or one that knocks toward its owner. */
export const enum Mode {
  Plain,
  DiscOut,
  DiscBack,
  Ghost,
  Reverse,
  /** Kash's every-fourth shot: a gold bar, slower and far heavier than the bills. */
  Gold,
}

export interface Projectile {
  uid: number;
  owner: number;
  kind: ProjKind;
  el: ElementId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  age: number;
  life: number;
  gravity: number;
  homing: number;
  hits: number;
  hitCd: number;
  dead: boolean;
  spec: HitSpec;
  priority: number;
  mode: Mode;
  /** Seconds before it can pass through a portal again. */
  warp: number;
}

export interface Pillar {
  uid: number;
  owner: number;
  el: ElementId;
  x: number;
  y: number;
  t: number;
  /** Seconds of ground-glow telegraph before it erupts. */
  delay: number;
  spec: HitSpec;
  /** Pillars sharing a non-zero group (one quake) hit a victim only once between them. */
  group: number;
  erupted: boolean;
  hit: boolean;
}

/** Fire's trap: sits on the ground and erupts when the opponent comes near. */
export interface Mine {
  uid: number;
  owner: number;
  x: number;
  y: number;
  t: number;
  /** Kash's Loose Change rather than an Ember Mine: no blast, the victim slips and is floored. */
  cash: boolean;
}

/** Earth's cover: stops the opponent and their shots until it crumbles. */
export interface Wall {
  uid: number;
  owner: number;
  x: number;
  y: number;
  t: number;
  hp: number;
  hit: boolean;
}

/** Tyler's Gremlin: a small creature that chases the opponent and nips at them until someone swats it. */
export interface Gremlin {
  uid: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: number;
  hp: number;
  t: number;
  biteCd: number;
}

/** Lightning's Storm Call: a column of sky that is about to be struck. */
export interface Strike {
  uid: number;
  /** -1 when the arena itself is responsible. */
  owner: number;
  /** 0 lightning and 1 icicle come down from the sky; 2 is a geyser coming up from below. */
  kind: number;
  x: number;
  t: number;
  delay: number;
  spec: HitSpec;
  done: boolean;
}

/** Void's Portal: step (or shoot) into either end and come out of the other. */
export interface Portal {
  uid: number;
  owner: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
}

/** Void's Singularity (and, `big`, its ultimate): pulls the opponent and their shots in, then bursts. */
export interface Well {
  uid: number;
  owner: number;
  x: number;
  y: number;
  t: number;
  big: boolean;
  ticks: number;
  done: boolean;
}

/** Air's column of rising wind. Lifts any airborne fighter inside it, friend or foe. */
export interface Updraft {
  uid: number;
  owner: number;
  x: number;
  y: number;
  t: number;
}

function circleHits(cx: number, cy: number, r: number, f: Fighter): boolean {
  const nx = clamp(cx, f.x - HW, f.x + HW);
  const ny = clamp(cy, f.y, f.y + HEIGHT);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export class Fighter {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  facing: 1 | -1 = 1;
  ground: Platform | null = null;
  state: FighterState = 'free';
  stateT = 0;
  move: Move | null = null;

  damage = 0;
  stocks = START_STOCKS;
  meter = 0;

  airJumps = 0;
  airDash = true;
  recoveryUsed = false;
  riseHop = true;
  wallJumped = false;
  /** Sent flying by a real hit. Only launched fighters die off the top. */
  launched = false;
  hitstun = 0;
  invuln = 0;
  spcCd = 0;
  dashCd = 0;
  dashDir = 1;
  shieldHp = MAX_SHIELD;
  shieldDelay = 0;
  shieldCd = 0;
  respawnT = 0;
  dropT = 0;
  coyote = 0;
  ultTicks = 0;
  ultFinal = false;
  /** Touching the stage's side wall this recently; `wallDir` points away from it. */
  wallT = 0;
  wallDir = 1;
  /** Sideways drift imposed from outside (the tempest's pull) for one step, in units/s. */
  push = 0;
  /** Consecutive hits landed without a 1.3s gap. */
  combo = 0;
  comboT = 0;
  bestCombo = 0;
  /** Shots left in the current burst (fractional while reloading). */
  ammo: number;
  ammoT = 9;
  /** The last few moves that landed, oldest first. Repeats hit weaker. */
  stale: string[] = [];
  /** Rises with every hit taken in quick succession; at the limit the fighter bursts free. */
  pressure = 0;
  burstCd = 0;
  /** What the special cooldown started from, so the HUD can draw it as a fraction. */
  spcMax = 1;
  /** Which lip is being held (-1 left, 1 right) while in the ledge/climb states. */
  ledgeSide = 0;
  ledgeGrabs = 0;
  regrabT = 0;
  climbThen: 'none' | 'attack' | 'roll' = 'none';
  /** Iron Skin: hits still hurt (less) but cannot move or stun this fighter. */
  armorT = 0;
  /** Nightmare: left and right are swapped, and it burns. */
  confuseT = 0;
  private curseT = 0;
  /** Gravity Flip: falling upward. */
  gravFlipT = 0;
  portalCd = 0;
  /** 0 the signature flourish, 1 point and laugh (direction held), 2 lie down (down held). */
  tauntKind = 0;
  /** A finished taunt pays Spirit, but only this often. */
  tauntCd = 0;
  private tauntBuf = 0;
  /** Inside a Deep Fry cloud: this fighter only updates in stuttering bursts. */
  lagT = 0;
  lagN = 0;
  /** Shots fired so far: which note of the tune comes next (Tyler), or when the gold bar is due (Kash). */
  notes = 0;
  /** Midas Touch: a gold statue for this much longer. */
  goldT = 0;
  /** How long the current stun lasts (a broken shield and a Midas statue differ). */
  stunFor = STUN_TIME;

  private jumpBuf = 0;
  private atkBuf = 0;
  private spcBuf = 0;
  private grdBuf = 0;
  private dropBuf = 0;
  /** Attack and Special were both down on a fresh press of either: an ultimate request. */
  private ultBuf = 0;
  /** Seconds since Up was last pressed. */
  private upT = 9;
  inp: InputFrame = NO_INPUT;

  /** Per-step movement modifiers, set by the state logic and consumed by physics. */
  private gravScale = 1;
  private ctl = 0;
  private lockVx = false;

  /** Presentation helpers (never read by game logic). */
  flashT = 0;
  landT = 1;
  landPow = 0;
  runPhase = 0;
  dealt = 0;
  kos = 0;
  falls = 0;

  constructor(
    readonly id: 0 | 1,
    readonly el: ElementDef,
  ) {
    this.airJumps = el.airJumps;
    this.ammo = el.ammo;
  }

  /** Damage multiplier for a move that has landed `n` times among the last few hits. */
  staleFactor(id: string): number {
    let n = 0;
    for (const k of this.stale) if (k === id) n++;
    return Math.max(0.5, 1 - 0.1 * n);
  }

  /** -1, 0 or 1 from the held left/right keys. */
  dir(): number {
    return (this.inp.right ? 1 : 0) - (this.inp.left ? 1 : 0);
  }

  /** Records this step's input. Presses are buffered so they survive hitstop and recovery frames. */
  latch(i: InputFrame): void {
    this.inp = i;
    if (i.upP) {
      this.jumpBuf = BUF;
      this.upT = 0;
    }
    if (i.atkP) this.atkBuf = BUF;
    if (i.spcP) this.spcBuf = BUF;
    if (i.grdP) this.grdBuf = BUF;
    if (i.downP) this.dropBuf = 0.08;
    if (i.tauntP) this.tauntBuf = BUF;
    // Held far longer than a normal press, so the ultimate still comes out if the
    // second key lands while the first key's move is finishing.
    if ((i.atkP || i.spcP) && i.atk && i.spc) this.ultBuf = 0.45;
  }

  clearBuffers(): void {
    this.jumpBuf = this.atkBuf = this.spcBuf = this.grdBuf = this.dropBuf = this.ultBuf = this.tauntBuf = 0;
  }

  setState(s: FighterState): void {
    this.state = s;
    this.stateT = 0;
    if (s !== 'move') this.move = null;
  }

  /** Shadow's Sink: under the floor, untouchable, until it erupts. */
  sunk(): boolean {
    const m = this.move;
    return this.state === 'move' && !!m && m.kind === 'spcDown' && this.el.id === 'shadow' && m.t >= 0.1 && m.t < 0.8;
  }

  /** Seconds into the active part of the ultimate (after the wind-up), or -1 when not in one. */
  ultT(): number {
    if (this.state !== 'ult') return -1;
    const t = this.stateT - ULT_CHARGE;
    return t >= 0 ? t : -1;
  }

  update(dt: number, g: Game): void {
    const foe = g.fighters[1 - this.id];
    this.stateT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.spcCd = Math.max(0, this.spcCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.shieldCd = Math.max(0, this.shieldCd - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.wallT = Math.max(0, this.wallT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.regrabT = Math.max(0, this.regrabT - dt);
    this.burstCd = Math.max(0, this.burstCd - dt);
    this.pressure = Math.max(0, this.pressure - dt);
    this.armorT = Math.max(0, this.armorT - dt);
    this.gravFlipT = Math.max(0, this.gravFlipT - dt);
    this.portalCd = Math.max(0, this.portalCd - dt);
    this.tauntCd = Math.max(0, this.tauntCd - dt);
    if (this.goldT > 0) {
      this.goldT -= dt;
      if (this.goldT <= 0 || this.state !== 'hitstun') {
        this.goldT = 0;
        g.emit('shatter', this.x, this.y + 0.9, this.id, 'cash');
      }
    }
    this.tauntBuf -= dt;
    if (this.confuseT > 0 && this.state !== 'dead') {
      this.confuseT -= dt;
      this.curseT -= dt;
      if (this.curseT <= 0) {
        this.curseT = 0.5;
        this.damage = Math.min(999, this.damage + 2.5);
        foe.dealt += 2.5;
        g.emit('curse', this.x, this.y + 1.2, this.id, 'shadow', 0, 0, 2.5);
      }
    }
    // Shots come back one at a time once you have stopped firing for a moment.
    this.ammoT += dt;
    if (this.ammoT > 0.45) this.ammo = Math.min(this.el.ammo, this.ammo + dt / this.el.reload);
    this.jumpBuf -= dt;
    this.atkBuf -= dt;
    this.spcBuf -= dt;
    this.grdBuf -= dt;
    this.dropBuf -= dt;
    this.ultBuf -= dt;
    this.upT += dt;
    this.landT += dt;
    if (this.state !== 'shield') {
      this.shieldDelay -= dt;
      if (this.shieldDelay <= 0) this.shieldHp = Math.min(MAX_SHIELD, this.shieldHp + 10 * dt);
    }
    this.gravScale = 1;
    this.ctl = 0;
    this.lockVx = false;

    switch (this.state) {
      case 'dead':
        this.push = 0;
        this.respawnT -= dt;
        if (this.respawnT <= 0 && this.stocks > 0) g.respawn(this);
        return;
      case 'ult':
        this.push = 0;
        this.updateUlt(g, foe);
        return;
      case 'ledge':
        this.push = 0;
        this.updateLedge(g);
        return;
      case 'climb':
        this.push = 0;
        this.updateClimb(g);
        return;
      case 'hitstun':
        this.hitstun -= dt;
        if (this.hitstun <= 0) this.setState('free');
        break;
      case 'stunned':
        if (this.stateT >= this.stunFor) this.setState('free');
        break;
      case 'dance':
        // Bust Down: no say in the matter until it is over.
        if (this.stateT >= DANCE_TIME + 0.2) this.setState('free');
        break;
      case 'taunt':
        if (!this.ground) this.setState('free');
        else if (this.stateT >= TAUNT_TIME) {
          // Got away with it. Disrespect is worth more over an empty stage.
          if (this.tauntCd <= 0) {
            this.tauntCd = 6;
            this.meter = Math.min(100, this.meter + (foe.state === 'dead' ? 20 : 12));
            g.emit('tauntDone', this.x, this.y + 1, this.id, this.el.id);
          }
          this.setState('free');
        } else if (this.stateT > 0.45 && (this.jumpBuf > 0 || this.atkBuf > 0 || this.spcBuf > 0 || this.grdBuf > 0)) {
          // Any button bails out early, with nothing to show for it.
          this.setState('free');
        }
        break;
      case 'dash':
        if (this.stateT >= DASH_TIME) {
          this.vx = this.dashDir * this.el.runSpeed;
          this.setState('free');
        } else {
          this.vx = this.dashDir * DASH_SPEED;
          this.vy = 0;
          this.gravScale = 0;
          this.lockVx = true;
        }
        break;
      case 'shield': {
        this.shieldHp -= 13 * dt;
        this.shieldDelay = 0.9;
        const dir = this.dir();
        if (this.shieldHp <= 0) g.breakShield(this);
        else if (!this.ground) this.setState('free');
        else if (dir !== 0 && this.dashCd <= 0) this.startDash(dir, g);
        else if (this.jumpBuf > 0 || (!this.inp.grd && this.stateT > 0.12)) {
          this.shieldCd = 0.3;
          this.setState('free');
        }
        break;
      }
      case 'move':
        this.updateMove(dt, g, foe);
        break;
      case 'free':
        break;
    }
    if (this.state === 'free') {
      this.ctl = 1;
      this.act(g);
    }
    this.physics(dt, g);
  }

  /** Free state: turn buffered presses into actions, highest priority first. */
  private act(g: Game): void {
    const inp = this.inp;
    const dir = this.dir();
    if (dir !== 0) this.facing = dir as 1 | -1;

    if (this.meter >= 100 && this.ultBuf > 0) {
      this.startUlt(g);
      return;
    }

    if (this.tauntBuf > 0 && this.ground) {
      this.tauntBuf = 0;
      this.dropBuf = 0;
      this.tauntKind = inp.down ? 2 : dir !== 0 ? 1 : 0;
      this.setState('taunt');
      g.emit('taunt', this.x, this.y + 1, this.id, this.el.id, this.tauntKind, this.facing, g.fighters[1 - this.id].state === 'dead' ? 1 : 0);
      return;
    }

    if (this.jumpBuf > 0) {
      if (this.ground || this.coyote > 0) {
        this.jumpBuf = 0;
        this.coyote = 0;
        this.ground = null;
        this.vy = this.el.jumpVel;
        g.emit('jump', this.x, this.y, this.id, this.el.id);
      } else if (this.wallT > 0 && !this.wallJumped) {
        // Kick off the side of the stage.
        this.jumpBuf = 0;
        this.wallJumped = true;
        this.wallT = 0;
        this.vy = this.el.jumpVel * 0.95;
        this.vx = this.wallDir * this.el.runSpeed * 1.1;
        this.facing = this.wallDir as 1 | -1;
        this.launched = false;
        g.emit('walljump', this.x, this.y + 0.6, this.id, this.el.id, 0, this.wallDir);
      } else if (this.airJumps > 0) {
        this.jumpBuf = 0;
        this.airJumps--;
        this.vy = this.el.jumpVel * 0.92;
        this.launched = false;
        if (dir !== 0) this.vx = approach(this.vx, dir * this.el.runSpeed, this.el.runSpeed * 0.7);
        g.emit('airjump', this.x, this.y, this.id, this.el.id);
      }
    }

    if (this.dropBuf > 0 && this.ground && !this.ground.solid && !inp.atk) {
      this.dropBuf = 0;
      this.ground = null;
      this.dropT = 0.25;
    }

    if (this.grdBuf > 0) {
      if (dir !== 0 || !this.ground) {
        if (this.dashCd <= 0 && (this.ground || this.airDash)) {
          this.grdBuf = 0;
          this.startDash(dir || this.facing, g);
          return;
        }
      } else if (this.shieldHp > 6 && this.shieldCd <= 0) {
        this.grdBuf = 0;
        this.setState('shield');
        g.emit('shieldUp', this.x, this.y + 0.9, this.id, this.el.id);
        return;
      }
    }

    if (this.spcBuf > 0) {
      if (inp.up && !this.recoveryUsed) {
        this.spcBuf = 0;
        this.recoveryUsed = true;
        this.startMove('recover', 0.42, 0.7);
        return;
      }
      if (this.spcCd <= 0) {
        // Down, then a held direction, then neutral: three different specials on one cooldown.
        this.spcBuf = 0;
        const el = this.el.id;
        if (inp.down) {
          this.spcCd = this.spcMax = SPECIAL_CD[el].down;
          const dur = el === 'water' ? 1.0 : el === 'earth' ? (this.ground ? 0.6 : 1.0) : el === 'shadow' ? 1.05 : 0.45;
          if (el === 'tyler' && g.gremlins.some((m) => m.owner === this.id)) {
            // One gremlin at a time: the button does nothing while yours is still out there.
            this.spcCd = 0;
            return;
          }
          this.startMove('spcDown', dur, 0);
        } else if (dir !== 0) {
          this.spcCd = this.spcMax = SPECIAL_CD[el].side;
          this.startMove('spcSide', el === 'fire' ? 0.95 : el === 'air' ? 0.42 : el === 'tyler' ? 0.95 : 0.5, 0);
          if (el === 'tyler') g.emit('pianoSpin', this.x, this.y + 1, this.id, el, 0, this.facing);
        } else {
          this.spcCd = this.spcMax = this.el.specialCd;
          this.startMove('special', SPECIAL_DUR[el], 0);
        }
        g.emit('special', this.x, this.y + 1, this.id, this.el.id, 0, this.facing);
        return;
      }
    }

    if (this.atkBuf > 0) {
      if (inp.up && this.upT < RISE_WINDOW) {
        this.atkBuf = 0;
        this.startMove('rise', 0.4, 0.5);
        if (!this.ground && this.riseHop) {
          this.riseHop = false;
          if (this.vy < 7) this.vy = 7;
        }
        g.emit('swing', this.x, this.y + 1.8, this.id, this.el.id, 1, this.facing);
      } else if (inp.down) {
        this.atkBuf = 0;
        if (this.ground) this.startMove('sweep', 0.46, 0);
        else this.startMove('dive', 1.0, 0.25);
        g.emit('swing', this.x, this.y + 0.5, this.id, this.el.id, 2, this.facing);
      } else {
        this.atkBuf = 0;
        const b = this.el.bolt;
        this.startMove('bolt', b.startup + b.recovery, 0.6);
        // Up held past the rising-strike window angles the shot upward instead.
        this.move!.aim = inp.up ? 1 : 0;
      }
    }
  }

  private startMove(kind: MoveKind, dur: number, ctl: number): void {
    const dir = this.dir();
    if (dir !== 0) this.facing = dir as 1 | -1;
    this.setState('move');
    this.move = { kind, t: 0, dur, fired: false, hit: false, landed: false, ctl, aim: 0, ticks: 0 };
    this.ctl = ctl;
  }

  private startDash(dir: number, g: Game): void {
    this.setState('dash');
    this.dashDir = dir;
    this.facing = dir as 1 | -1;
    this.dashCd = DASH_CD;
    if (!this.ground) this.airDash = false;
    this.invuln = Math.max(this.invuln, 0.16);
    this.vx = dir * DASH_SPEED;
    this.vy = 0;
    this.gravScale = 0;
    this.lockVx = true;
    g.emit('dash', this.x, this.y + 0.9, this.id, this.el.id, 0, dir);
  }

  private startUlt(g: Game): void {
    const dir = this.dir();
    if (dir !== 0) this.facing = dir as 1 | -1;
    this.setState('ult');
    this.meter = 0;
    this.atkBuf = this.spcBuf = this.ultBuf = 0;
    this.vx = 0;
    this.vy = 0;
    this.ground = null;
    this.ultTicks = 0;
    this.ultFinal = false;
    this.invuln = ULT_CHARGE + 0.1;
    g.fighters[1 - this.id].clearBuffers();
    g.emit('ultStart', this.x, this.y + 1, this.id, this.el.id, 0, this.facing);
  }

  /**
   * The ultimate: hover and charge (the rest of the world is frozen), then the
   * element's own finisher. The caster cannot be hit until it ends.
   *   fire  - a full-screen beam down their lane
   *   water - a tsunami that rolls the length of the stage
   *   earth - a line of pillars erupting away from them, on every platform
   *   air   - a tempest that drags the opponent in, shreds them and throws them up
   */
  private updateUlt(g: Game, foe: Fighter): void {
    this.invuln = Math.max(this.invuln, 0.05);
    const t = this.stateT - ULT_CHARGE;
    if (t < 0) {
      this.y += 1.1 * DT;
      return;
    }
    const first = this.ultTicks === 0;
    if (first) {
      this.ultTicks = 1;
      g.emit('ultFire', this.x, this.y + 1.1, this.id, this.el.id, 0, this.facing);
    }
    let done = false;
    switch (this.el.id) {
      case 'fire': {
        const inBeam =
          (foe.x - this.x) * this.facing > 0.2 &&
          Math.abs(foe.y + HEIGHT / 2 - (this.y + 1.1)) < ULT_HALF_HEIGHT + HEIGHT / 2;
        if (t < ULT_BEAM - 0.05) {
          // One damage tick every 0.1s while the beam is out.
          if (t >= (this.ultTicks - 1) * 0.1) {
            this.ultTicks++;
            if (inBeam) {
              const tick: HitSpec = { dmg: 2.5, base: 0, growth: 0, angle: 0, shieldDmg: 10, ult: true, fixed: { vx: this.facing * 5, vy: 2, stun: 0.22 } };
              g.hit(this.id, foe, tick, this.facing, foe.x, foe.y + 0.9, this.el.id);
            }
          }
        } else if (!this.ultFinal) {
          this.ultFinal = true;
          if (inBeam) g.hit(this.id, foe, BEAM_FINAL, this.facing, foe.x, foe.y + 0.9, this.el.id);
        }
        done = t >= ULT_BEAM + ULT_END;
        break;
      }
      case 'water':
        if (first) {
          g.spawnProjectile(this, 'tsunami', this.x - this.facing * 2, this.y + 2.2, this.facing * 22, 0, TSUNAMI_R, 2.6, TSUNAMI);
        }
        done = t >= 0.6;
        break;
      case 'earth':
        while (this.ultTicks <= QUAKE_PILLARS && t >= (this.ultTicks - 1) * 0.09) {
          g.spawnQuake(this, this.x + this.facing * (1.6 + (this.ultTicks - 1) * 2.2));
          this.ultTicks++;
        }
        done = t >= 1.15;
        break;
      case 'air': {
        const cx = this.x;
        const cy = this.y + 1.2;
        const dx = cx - foe.x;
        const dy = cy - (foe.y + 0.9);
        const dist = Math.hypot(dx, dy);
        const exposed = foe.state !== 'dead' && foe.state !== 'ult' && foe.invuln <= 0;
        if (t < TEMPEST_TIME) {
          if (exposed && dist < 15) {
            // The wind drags them toward the eye; running away only slows it.
            foe.push = sign(dx) * (foe.ground ? 8.5 : 13) * Math.min(1, Math.abs(dx) / 0.6);
            if (!foe.ground && foe.state !== 'hitstun') foe.vy += clamp(dy, -1, 1) * 30 * DT;
          }
          if (t >= (this.ultTicks - 1) * 0.12) {
            this.ultTicks++;
            if (dist < TEMPEST_R) {
              const tick: HitSpec = { dmg: 2.2, base: 0, growth: 0, angle: 0, shieldDmg: 9, ult: true, fixed: { vx: clamp(dx * 4, -7, 7), vy: clamp(dy * 4 + 2, -4, 8), stun: 0.2 } };
              g.hit(this.id, foe, tick, sign(-dx), foe.x, foe.y + 0.9, this.el.id);
            }
          }
        } else if (!this.ultFinal) {
          this.ultFinal = true;
          if (dist < TEMPEST_R + 0.6) g.hit(this.id, foe, TEMPEST_FINAL, Math.abs(dx) < 0.2 ? this.facing : sign(-dx), foe.x, foe.y + 0.9, this.el.id);
        }
        done = t >= TEMPEST_TIME + 0.3;
        break;
      }
      case 'lightning':
        // Thunderstorm: strike after strike, each aimed at where they are about to be.
        while (this.ultTicks <= 7 && t >= (this.ultTicks - 1) * 0.2) {
          g.spawnStrike(this.id, foe.x + foe.vx * 0.25, 0.38, STORM_ULT);
          this.ultTicks++;
        }
        done = t >= 1.7;
        break;
      case 'metal': {
        // Magnet Crush: haul them to a point in front, then slam the plates shut on it.
        const px = this.x + this.facing * 3.2;
        const py = this.y + 1.3;
        const dx = px - foe.x;
        const dy = py - (foe.y + 0.9);
        const exposed = foe.state !== 'dead' && foe.state !== 'ult' && foe.invuln <= 0;
        if (t < CRUSH_TIME) {
          if (exposed) {
            foe.push = sign(dx) * (foe.ground ? 11 : 16) * Math.min(1, Math.abs(dx) / 0.5);
            if (foe.ground && dy > 0.6 && Math.abs(dx) < 4) {
              foe.ground = null;
              foe.vy = 6;
            }
            if (!foe.ground && foe.state !== 'hitstun') foe.vy += clamp(dy, -1, 1) * 60 * DT;
          }
        } else if (!this.ultFinal) {
          this.ultFinal = true;
          if (Math.hypot(dx, dy) < 3) g.hit(this.id, foe, CRUSH, this.facing, foe.x, foe.y + 0.9, this.el.id);
        }
        done = t >= CRUSH_TIME + 0.4;
        break;
      }
      case 'shadow':
        // Nightmare: no hit at all. Their controls are reversed and the curse eats at them.
        if (first && foe.state !== 'dead') {
          foe.confuseT = CONFUSE_TIME;
          foe.clearBuffers();
        }
        done = t >= 0.45;
        break;
      case 'void':
        if (first) g.spawnWell(this, this.x + this.facing * 4.5, this.y + 2.2, true);
        done = t >= HORIZON_LIFE + 0.25;
        break;
      case 'cash':
        // Bust Down: the opponent drops everything and dances while it rains money, and then the vault lands.
        if (first && foe.state !== 'dead' && foe.state !== 'ult') {
          foe.setState('dance');
          foe.vx = 0;
          foe.goldT = 0;
          foe.gravFlipT = 0;
          foe.clearBuffers();
          g.emit('dance', foe.x, foe.y + 1, foe.id, this.el.id);
        }
        if (t < DANCE_TIME - 0.3) {
          if (t >= (this.ultTicks - 1) * 0.2) {
            this.ultTicks++;
            const bill: HitSpec = { dmg: 1.8, base: 0, growth: 0, angle: 0, soft: true, ult: true };
            if (foe.state === 'dance') g.hit(this.id, foe, bill, this.facing, foe.x, foe.y + 1.6, this.el.id);
            if (t >= DANCE_TIME - 0.75 && this.ultTicks < 90) {
              this.ultTicks = 90;
              g.emit('safeDrop', foe.x, foe.y, this.id, this.el.id);
            }
          }
        } else if (!this.ultFinal && t >= DANCE_TIME - 0.15) {
          this.ultFinal = true;
          g.emit('safeHit', foe.x, foe.y, this.id, this.el.id);
          if (foe.state === 'dance') g.hit(this.id, foe, VAULT, sign(foe.x - this.x), foe.x, foe.y + 1.2, this.el.id);
        }
        done = t >= DANCE_TIME + 0.35;
        break;
      case 'tyler':
        // Shitstorm: it comes down at a slant over wherever they are, driving them down and off to the side.
        if (t < STORM_TIME) {
          while (t >= (this.ultTicks - 1) * 0.1) {
            this.ultTicks++;
            const away = foe.state === 'dead' ? this.facing : sign(foe.x - this.x);
            const tx = (foe.state === 'dead' ? this.x + this.facing * 6 : foe.x) + (g.rand() - 0.5) * 9;
            const top = Math.min(g.stage.blast.top - 1, foe.y + 12);
            const p = g.spawnProjectile(this, 'poop', tx - away * 3.6, top, away * 7, -22, 0.55, 1.6, NO_HIT);
            p.priority = 0;
          }
        }
        done = t >= STORM_TIME + 0.3;
        break;
    }
    if (done) {
      this.setState('free');
      this.invuln = 0.25;
      this.airJumps = Math.max(this.airJumps, 1);
      this.recoveryUsed = false;
      g.emit('ultEnd', this.x, this.y + 1, this.id, this.el.id);
    }
  }

  private updateMove(dt: number, g: Game, foe: Fighter): void {
    const m = this.move!;
    m.t += dt;
    const t = m.t;
    this.ctl = m.ctl;

    // Attack + Special pressed a frame apart would otherwise start a normal move first.
    if (t < 0.1 && this.meter >= 100 && this.ultBuf > 0) {
      if (m.kind === 'special' && !m.fired) this.spcCd = 0;
      this.startUlt(g);
      return;
    }

    const toFoe = sign(foe.x - this.x);
    switch (m.kind) {
      case 'bolt':
        if (!m.fired && t >= this.el.bolt.startup) {
          m.fired = true;
          // Point blank, the shot lands as a strike instead: more damage, more launch, no projectile.
          const b = this.el.bolt;
          const strike: HitSpec = { dmg: b.dmg + 3, base: b.base + 5, growth: b.growth + 5, angle: 38 };
          const cx = this.x + this.facing * 0.85;
          strike.id = 'strike';
          if (m.aim === 0 && g.melee(this, foe, cx, this.y + 1.05, 0.8, strike, this.facing)) {
            g.emit('strike', cx, this.y + 1.05, this.id, this.el.id, 0, this.facing);
          } else if (this.ammo >= 1) {
            // Shots come in bursts: each one spends a charge, and charges only return when you stop.
            this.ammo -= 1;
            this.ammoT = 0;
            g.spawnBolt(this, m.aim);
          } else {
            g.emit('empty', cx, this.y + 1.05 + (m.aim ? 0.3 : 0), this.id, this.el.id, 0, this.facing);
          }
        }
        break;
      case 'rise':
        if (t >= 0.07 && t <= 0.25 && !m.hit) {
          m.hit = g.melee(this, foe, this.x + this.facing * 0.45, this.y + 2.1, 1.25, RISE, toFoe);
        }
        break;
      case 'sweep':
        if (t >= 0.12 && t <= 0.28 && !m.hit) {
          m.hit =
            g.melee(this, foe, this.x - 1.35, this.y + 0.55, 1.15, SWEEP, toFoe) ||
            g.melee(this, foe, this.x + 1.35, this.y + 0.55, 1.15, SWEEP, toFoe);
        }
        break;
      case 'dive':
        if (m.landed) {
          this.ctl = 0;
        } else if (t < 0.13) {
          this.vx *= Math.pow(0.02, dt);
          this.vy = 1.5;
          this.gravScale = 0;
        } else {
          this.vy = -36;
          this.gravScale = 0;
          if (!m.hit) {
            m.hit = g.melee(this, foe, this.x, this.y + 0.35, 0.95, foe.ground ? DIVE : DIVE_SPIKE, toFoe);
          }
        }
        break;
      case 'recover':
        if (this.el.id === 'metal' && this.tether(m, g)) break;
        if (!m.fired && t >= 0.05) {
          m.fired = true;
          this.vy = this.el.recoverVel;
          this.vx = this.dir() * 7 + this.vx * 0.3;
          this.ground = null;
          this.launched = false;
          g.emit('recover', this.x, this.y, this.id, this.el.id);
        }
        if (m.fired && t < 0.33 && !m.hit) {
          m.hit = g.melee(this, foe, this.x, this.y + 1.0, 1.15, RECOVER, toFoe);
        }
        break;
      case 'special':
        this.updateSpecial(m, g, foe);
        break;
      case 'spcSide':
        this.updateSide(m, g, foe);
        break;
      case 'spcDown':
        this.updateDown(m, g, foe);
        break;
    }
    if (this.state === 'move' && m.t >= m.dur) this.setState('free');
  }

  /**
   * Metal's recovery: in the air with a free lip in reach, fire a cable at it and reel in to a
   * ledge hang. Returns false when there is nothing to grapple, so the ordinary leap is used.
   */
  private tether(m: Move, g: Game): boolean {
    const main = g.stage.main;
    if (m.aim === 0) {
      if (m.t < 0.05) return true;
      m.aim = 9;
      if (!this.ground) {
        let best = 14;
        for (const side of [-1, 1]) {
          const o = g.fighters[1 - this.id];
          if ((o.state === 'ledge' || o.state === 'climb') && o.ledgeSide === side) continue;
          const lip = main.x + (side * main.w) / 2;
          const d = Math.hypot(lip - this.x, main.y - (this.y + 1.5));
          // Only from outside or below: standing above the stage there is nothing to reel in to.
          if (d < best && ((this.x - lip) * side > -0.5 || this.y < main.y - 0.5)) {
            best = d;
            m.aim = side;
          }
        }
        if (m.aim !== 9) {
          m.fired = true;
          const lip = main.x + (m.aim * main.w) / 2;
          this.facing = (lip > this.x ? 1 : -1) as 1 | -1;
          g.emit('cable', this.x, this.y + 1.5, this.id, this.el.id, best, this.facing, Math.atan2(main.y - (this.y + 1.5), Math.abs(lip - this.x)));
        }
      }
    }
    if (m.aim === 9) return false;
    const side = m.aim;
    const tx = main.x + (side * main.w) / 2 + side * (HW + 0.06);
    const ty = main.y - LEDGE_HANG;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.75) {
      this.grabLedge(side, g);
      return true;
    }
    if (m.t > 0.9) {
      // Snagged on something on the way: give up and fall.
      m.aim = 9;
      m.fired = true;
      return true;
    }
    this.vx = (dx / d) * 36;
    this.vy = (dy / d) * 36;
    this.gravScale = 0;
    this.lockVx = true;
    m.dur = m.t + 0.1;
    return true;
  }

  private grabLedge(side: number, g: Game): void {
    const main = g.stage.main;
    const lip = main.x + (side * main.w) / 2;
    this.setState('ledge');
    this.ledgeSide = side;
    this.x = lip + side * (HW + 0.06);
    this.y = main.y - LEDGE_HANG;
    this.vx = this.vy = 0;
    this.facing = -side as 1 | -1;
    this.airJumps = this.el.airJumps;
    this.airDash = true;
    this.recoveryUsed = false;
    this.wallJumped = false;
    this.launched = false;
    this.gravFlipT = 0;
    // Only the first grab since touching the ground is safe; no stalling on the ledge.
    if (this.ledgeGrabs === 0) this.invuln = Math.max(this.invuln, 0.7);
    this.ledgeGrabs++;
    g.emit('ledge', lip, main.y, this.id, this.el.id, 0, side);
  }

  /** Direction + Special. */
  private updateSide(m: Move, g: Game, foe: Fighter): void {
    const t = m.t;
    const ahead = (foe.x - this.x) * this.facing;
    const dy = foe.y + HEIGHT / 2 - (this.y + 1.05);
    switch (this.el.id) {
      case 'fire': {
        // Flame Stream: a held jet. Ticks while they stand in it, then a parting pop.
        if (!this.ground) this.gravScale = 0.25;
        const inCone = ahead > 0.2 && ahead < FLAME_RANGE && Math.abs(dy) < 1.0 + ahead * 0.14;
        if (t >= 0.12 && t < 0.72) {
          const n = Math.floor((t - 0.12) / 0.1);
          if (n >= m.ticks) {
            m.ticks = n + 1;
            if (inCone) {
              const tick: HitSpec = { dmg: 2.2, base: 0, growth: 0, angle: 0, shieldDmg: 6, fixed: { vx: this.facing * 1.2, vy: 1.2, stun: 0.18 } };
              g.hit(this.id, foe, tick, this.facing, foe.x, foe.y + 0.9, this.el.id);
            }
          }
        } else if (t >= 0.72 && !m.fired) {
          m.fired = true;
          if (inCone) g.hit(this.id, foe, FLAME_END, this.facing, foe.x, foe.y + 0.9, this.el.id);
        }
        break;
      }
      case 'water':
        // Water Whip: reaches out and drags them in for a follow-up.
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          let reach = WHIP_RANGE;
          if (ahead > 0.5 && ahead < WHIP_RANGE && Math.abs(dy) < 1.7) {
            const pull: HitSpec = { dmg: 5, base: 0, growth: 0, angle: 0, shieldDmg: 8, id: 'side', fixed: { vx: -this.facing * Math.min(24, 6 + ahead * 3.4), vy: 5.5, stun: 0.45 } };
            if (g.hit(this.id, foe, pull, -this.facing, foe.x, foe.y + 0.9, this.el.id)) reach = ahead;
          }
          g.emit('whip', this.x + this.facing * 0.6, this.y + 1.1, this.id, this.el.id, reach, this.facing);
        }
        break;
      case 'earth':
        if (!m.fired && t >= 0.2) {
          m.fired = true;
          g.spawnWall(this);
        }
        break;
      case 'air':
        // Gale Force: almost no damage, enormous shove, and it turns their shots around.
        if (!m.fired && t >= 0.12) {
          m.fired = true;
          if (ahead > 0 && ahead < GUST_RANGE && Math.abs(dy) < 2.3) {
            const shove: HitSpec = { dmg: 1.5, base: 0, growth: 0, angle: 0, shieldDmg: 14, id: 'side', fixed: { vx: this.facing * (25 - ahead * 1.6), vy: 6.5, stun: 0.32 } };
            g.hit(this.id, foe, shove, this.facing, foe.x, foe.y + 0.9, this.el.id);
          }
          g.gust(this);
          g.emit('gust', this.x + this.facing * 0.6, this.y + 1.05, this.id, this.el.id, GUST_RANGE, this.facing);
        }
        break;
      case 'lightning':
        // Ball Lightning: a slow orb that keeps zapping whoever is near it.
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          for (const p of g.projectiles) if (p.kind === 'orb' && p.owner === this.id) p.dead = true;
          g.spawnProjectile(this, 'orb', this.x + this.facing * 1.1, this.y + 1.3, this.facing * 4.5, 0, 1.5, 3.2, STORM);
        }
        break;
      case 'metal':
        // Shrapnel: five shards in a fan. Devastating up close, nothing at range.
        if (!m.fired && t >= 0.14) {
          m.fired = true;
          for (const deg of [-18, -9, 0, 9, 18]) {
            const a = (deg * Math.PI) / 180;
            const p = g.spawnProjectile(this, 'bolt', this.x + this.facing * 0.7, this.y + 1.05, this.facing * 27 * Math.cos(a), 27 * Math.sin(a), 0.26, 0.28, SHARD);
            p.priority = 0;
          }
        }
        break;
      case 'shadow':
        // Decoy: a copy sprints ahead and bursts on whoever it reaches.
        if (!m.fired && t >= 0.14) {
          m.fired = true;
          for (const p of g.projectiles) if (p.kind === 'clone' && p.owner === this.id) p.dead = true;
          g.spawnProjectile(this, 'clone', this.x + this.facing * 0.8, this.y + 0.9, this.facing * 10.5, 0, 0.8, 1.3, CLONE);
        }
        break;
      case 'cash':
        // Joyride: a gold supercar. Nothing short of an ultimate stops it, and it stops for nobody.
        if (t >= 0.18 && t < 0.86) {
          if (!m.fired) {
            m.fired = true;
            g.emit('lambo', this.x, this.y + 0.6, this.id, this.el.id, 0, this.facing);
          }
          this.vx = this.facing * 24;
          this.lockVx = true;
          this.armorT = Math.max(this.armorT, 0.05);
          if (!m.hit) m.hit = g.melee(this, foe, this.x + this.facing * 0.9, this.y + 0.8, 1.35, LAMBO, this.facing);
        } else if (t >= 0.86 && !m.landed) {
          m.landed = true;
          this.vx = this.facing * 6;
        }
        break;
      case 'tyler':
        // Piano Toss: a full spin to wind up, then a grand piano on a short, heavy arc.
        if (!m.fired && t >= PIANO_SPIN) {
          m.fired = true;
          const p = g.spawnProjectile(this, 'piano', this.x + this.facing * 0.9, this.y + 1.7, this.facing * 10, 7, 1.15, 1.6, PIANO);
          p.gravity = 34;
        }
        break;
      case 'void':
        // Gravity Flip: for a moment, down is up for them.
        if (!m.fired && t >= 0.14) {
          m.fired = true;
          if (ahead > 0 && ahead < 6.5 && Math.abs(dy) < 2.3) {
            const lift: HitSpec = { dmg: 3, base: 0, growth: 0, angle: 0, shieldDmg: 8, id: 'side', fixed: { vx: 0, vy: 6, stun: 0.25 } };
            if (g.hit(this.id, foe, lift, this.facing, foe.x, foe.y + 0.9, this.el.id) === 1) foe.gravFlipT = FLIP_TIME;
          }
          g.emit('flip', this.x + this.facing * 0.6, this.y + 1.05, this.id, this.el.id, 6.5, this.facing);
        }
        break;
    }
  }

  /** Down + Special. */
  private updateDown(m: Move, g: Game, foe: Fighter): void {
    const t = m.t;
    switch (this.el.id) {
      case 'lightning':
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          g.spawnStrike(this.id, foe.state === 'dead' ? this.x + this.facing * 5 : foe.x, STORM_DELAY, STORM);
        }
        break;
      case 'metal':
        if (!m.fired && t >= 0.1) {
          m.fired = true;
          this.armorT = ARMOR_TIME;
          g.emit('armor', this.x, this.y + 1, this.id, this.el.id);
        }
        break;
      case 'shadow':
        // Sink: only from solid footing. Melt into the floor, move fast and untouchable, then erupt.
        if (!this.ground && t < 0.8) {
          if (!m.landed) {
            this.spcCd = 0.3;
            this.setState('free');
          }
          break;
        }
        if (t >= 0.1 && t < 0.8) {
          if (!m.landed) {
            m.landed = true;
            g.emit('sink', this.x, this.y, this.id, this.el.id);
          }
          this.invuln = Math.max(this.invuln, 0.06);
          this.ctl = 1.5;
        } else if (t >= 0.8 && !m.fired) {
          m.fired = true;
          g.emit('rise', this.x, this.y, this.id, this.el.id);
          m.hit = g.melee(this, foe, this.x, this.y + 1.0, 1.5, ERUPT, sign(foe.x - this.x));
        }
        break;
      case 'void':
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          g.spawnWell(this, this.x + this.facing * 3.2, this.y + 1.4, false);
        }
        break;
      case 'tyler':
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          g.spawnGremlin(this);
        }
        break;
      case 'cash':
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          g.spawnMine(this, true);
        }
        break;
      case 'fire':
        if (!m.fired && t >= 0.18) {
          m.fired = true;
          g.spawnMine(this);
        }
        break;
      case 'water':
        // Healing Tide: standing still, damage washes off. Any hit interrupts it.
        if (t >= 0.25 && t < 0.9) {
          if (!m.fired) {
            m.fired = true;
            g.emit('heal', this.x, this.y + 1, this.id, this.el.id);
          }
          this.damage = Math.max(0, this.damage - 20 * DT);
        }
        break;
      case 'earth':
        // Seismic Stomp: on the ground it fires at once; in the air it plunges and fires on landing.
        if (m.fired) break;
        if (this.ground) {
          if (t >= 0.2) {
            m.fired = true;
            g.spawnTremors(this);
          }
        } else if (t >= 0.1) {
          this.vy = -32;
          this.gravScale = 0;
        }
        break;
      case 'air':
        if (!m.fired && t >= 0.14) {
          m.fired = true;
          g.spawnUpdraft(this);
        }
        break;
    }
  }

  /** Hanging from the lip: jump away, climb, climb into an attack or roll, or let go. */
  private updateLedge(g: Game): void {
    const side = this.ledgeSide;
    const dir = this.dir();
    this.vx = this.vy = 0;
    if (this.jumpBuf > 0) {
      this.jumpBuf = 0;
      this.setState('free');
      this.regrabT = 0.6;
      this.vy = this.el.jumpVel;
      this.vx = -side * 3.5;
      g.emit('jump', this.x, this.y + 1, this.id, this.el.id);
    } else if (this.atkBuf > 0) {
      this.startClimb('attack', g);
    } else if (this.grdBuf > 0) {
      this.startClimb('roll', g);
    } else if (this.stateT > 0.12 && dir === -side) {
      this.startClimb('none', g);
    } else if ((this.stateT > 0.12 && (dir === side || this.inp.down)) || this.stateT > 3) {
      this.setState('free');
      this.regrabT = 0.6;
      this.vy = -3;
    }
  }

  private startClimb(then: 'none' | 'attack' | 'roll', g: Game): void {
    this.atkBuf = this.grdBuf = 0;
    this.climbThen = then;
    this.setState('climb');
    g.emit('climb', this.x, this.y + LEDGE_HANG, this.id, this.el.id);
  }

  private updateClimb(g: Game): void {
    const main = g.stage.main;
    const side = this.ledgeSide;
    const lip = main.x + (side * main.w) / 2;
    const u = Math.min(1, this.stateT / CLIMB_TIME);
    const hx = lip + side * (HW + 0.06);
    const hy = main.y - LEDGE_HANG;
    const tx = lip - side * 0.75;
    // Pull up first, then swing in over the lip.
    this.y = hy + (main.y - hy) * Math.min(1, u * 1.7);
    this.x = hx + (tx - hx) * Math.max(0, (u - 0.35) / 0.65);
    this.invuln = Math.max(this.invuln, 0.06);
    if (u < 1) return;
    this.x = tx;
    this.vx = this.vy = 0;
    this.facing = -side as 1 | -1;
    this.setState('free');
    this.land(main, g);
    if (this.climbThen === 'attack') {
      this.startMove('sweep', 0.46, 0);
      this.move!.t = 0.1;
      g.emit('swing', this.x, this.y + 0.5, this.id, this.el.id, 2, this.facing);
    } else if (this.climbThen === 'roll') {
      this.dashCd = 0;
      this.startDash(-side, g);
    }
  }

  private updateSpecial(m: Move, g: Game, foe: Fighter): void {
    const t = m.t;
    switch (this.el.id) {
      case 'fire':
        // Dragon Dash: a gravity-free lunge that hits once on the way through.
        if (t >= 0.13 && t < 0.4) {
          this.vx = this.facing * 27;
          this.vy = 0;
          this.gravScale = 0;
          this.lockVx = true;
          if (!m.hit) {
            m.hit = g.melee(this, foe, this.x + this.facing * 0.7, this.y + 0.9, 1.15, FIRE_DASH, this.facing);
          }
        } else if (t >= 0.4 && !m.fired) {
          m.fired = true;
          this.vx = this.facing * 8;
        }
        break;
      case 'water':
        if (!m.fired && t >= 0.2) {
          m.fired = true;
          g.spawnProjectile(this, 'wave', this.x + this.facing, this.y + 1.2, this.facing * 13, 0, 1.5, 1.3, WAVE);
        }
        break;
      case 'earth':
        if (!m.fired && t >= 0.18) {
          m.fired = true;
          g.spawnPillar(this, foe);
        }
        break;
      case 'air':
        if (!m.fired && t >= 0.16) {
          m.fired = true;
          g.spawnProjectile(this, 'cyclone', this.x + this.facing * 1.2, this.y + 1.5, this.facing * 6, 0, 1.45, 1.9, CYCLONE_END);
        }
        break;
      case 'lightning':
        // Blink Strike: gone, then behind them with the swing already coming.
        if (!m.fired && t >= 0.12) {
          m.fired = true;
          g.blink(this, foe);
        }
        if (m.fired && t >= 0.2 && t < 0.36 && !m.hit) {
          m.hit = g.melee(this, foe, this.x + this.facing * 0.7, this.y + 1, 1.15, BLINK, this.facing);
        }
        break;
      case 'metal': {
        // Magnet Zip: a cable to the opponent, then reel in at speed and slam.
        const ahead = (foe.x - this.x) * this.facing;
        const rise = foe.y - this.y;
        if (!m.fired && t >= 0.14) {
          m.fired = true;
          const caught = foe.state !== 'dead' && foe.state !== 'ult' && ahead > 0.8 && ahead < 9.5 && Math.abs(rise) < 2;
          m.aim = caught ? 1 : 0;
          g.emit('cable', this.x + this.facing * 0.6, this.y + 1.1, this.id, this.el.id, caught ? ahead : 9.5, this.facing);
        }
        if (m.aim === 1 && t < 0.5) {
          this.vx = this.facing * 34;
          this.vy = clamp(rise * 8, -12, 12);
          this.gravScale = 0;
          this.lockVx = true;
          if (rise > 0.3) this.ground = null;
          if (!m.hit) m.hit = g.melee(this, foe, this.x + this.facing * 0.7, this.y + 0.9, 1.15, SLAM, this.facing);
          if (m.hit || ahead < 0.3) {
            m.aim = 2;
            this.vx = this.facing * 4;
          }
        }
        break;
      }
      case 'shadow':
        if (!m.fired && t >= 0.15) {
          m.fired = true;
          g.swap(this, foe);
        }
        break;
      case 'void':
        if (!m.fired && t >= 0.15) {
          m.fired = true;
          g.spawnPortal(this);
        }
        break;
      case 'cash':
        // Midas Touch: a short reach, and whoever it finds is solid gold for a while.
        if (t >= 0.16 && t < 0.3 && !m.hit) {
          const before = foe.state;
          m.hit = g.melee(this, foe, this.x + this.facing * 0.9, this.y + 1, 1.2, MIDAS, this.facing);
          // Only a clean touch gilds them: a shield or a parry keeps its owner flesh and blood.
          if (m.hit && foe.state === 'hitstun' && before !== 'shield') {
            foe.goldT = GOLD_TIME;
            foe.vx = 0;
            g.emit('midas', foe.x, foe.y + 0.9, foe.id, this.el.id);
          }
        }
        break;
      case 'tyler':
        // Deep Fry: a slow cloud. Anyone inside it, Tyler included, lags.
        if (!m.fired && t >= 0.18) {
          m.fired = true;
          for (const p of g.projectiles) if (p.kind === 'fry' && p.owner === this.id) p.dead = true;
          const p = g.spawnProjectile(this, 'fry', this.x + this.facing * 1.5, this.y + 1.4, this.facing * 3.5, 0, FRY_R, 5.5, NO_HIT);
          p.priority = 0;
          g.emit('fry', p.x, p.y, this.id, this.el.id);
        }
        break;
    }
  }

  private physics(dt: number, g: Game): void {
    if (this.state === 'ult' || this.state === 'dead') return;
    const st = this.state;
    const dir = this.dir();
    const main = g.stage.main;

    if (!this.lockVx) {
      if (this.ground) {
        // Iron Skin is heavy: armoured fighters walk, they do not run.
        const run = this.el.runSpeed * (this.armorT > 0 ? 0.75 : 1);
        // On ice there is little grip either way: slow to get going, slower to stop.
        const grip = g.stage.friction;
        if (this.ctl > 0 && dir !== 0) this.vx = approach(this.vx, dir * run * this.ctl, 100 * (0.3 + 0.7 * grip) * dt);
        else this.vx = approach(this.vx, 0, (st === 'hitstun' ? 28 : 80) * grip * dt);
      } else if (st === 'hitstun') {
        this.vx *= Math.exp(-1.2 * dt);
      } else if (this.ctl > 0 && dir !== 0) {
        this.vx = approach(this.vx, dir * this.el.runSpeed, 46 * this.ctl * dt);
      } else {
        this.vx = approach(this.vx, 0, 8 * dt);
      }
    }

    // A platform that has just collapsed is no longer under anyone.
    if (this.ground && this.ground.gone > 0) this.ground = null;
    const pull = GRAVITY * g.stage.gravity;
    if (!this.ground && this.gravScale > 0 && this.gravFlipT > 0) {
      // Flipped: falling upward, a little slower than things fall down.
      this.vy = Math.min(13, this.vy + pull * 0.55 * dt);
      this.launched = false;
    } else if (!this.ground && this.gravScale > 0) {
      this.vy -= pull * dt;
      const fast = this.ctl > 0 && this.inp.down && this.vy < 2;
      if (fast) this.vy -= 55 * dt;
      if (st !== 'hitstun') {
        const maxFall = (fast ? FAST_FALL : MAX_FALL) * (0.5 + 0.5 * g.stage.gravity);
        if (this.vy < -maxFall) this.vy = -maxFall;
      }
    }

    if (this.launched && st !== 'hitstun' && this.vy <= 0) this.launched = false;
    if (this.ground) this.runPhase += Math.abs(this.vx) * dt;

    const left = main.x - main.w / 2;
    const right = main.x + main.w / 2;
    const top = main.y;
    const bottom = main.y - main.thick;
    const prevX = this.x;
    const prevY = this.y;

    // An updraft carries any airborne fighter inside it upward.
    if (!this.ground && this.gravScale > 0) {
      for (const u of g.updrafts) {
        if (Math.abs(this.x - u.x) < UPDRAFT_HALF && this.y > u.y - 0.5 && this.y < u.y + 10) {
          this.vy = approach(this.vy, 13, 150 * dt);
          this.launched = false;
        }
      }
    }

    // Horizontal move, then push out of the main block's sides.
    // Whatever they are standing on carries them: a moving platform, or the foundry's conveyor.
    const carry = this.ground ? this.ground.vx + (g.stage.belt && this.ground === main ? g.beltDir * 3.6 : 0) : 0;
    this.x += (this.vx + this.push + carry) * dt;
    this.push = 0;

    // The opponent's stone wall is solid to this fighter: go over it or break it.
    for (const w of g.walls) {
      if (w.owner === this.id) continue;
      const gap = HW + 0.3;
      if (this.y < w.y + WALL_HEIGHT && this.y + HEIGHT > w.y && Math.abs(this.x - w.x) < gap) {
        const from = prevX < w.x ? -1 : 1;
        this.x = w.x + from * gap;
        // Charging into it does real damage to the wall.
        if (Math.abs(this.vx) > 16) g.damageWall(w, 14);
        this.vx = st === 'hitstun' ? -this.vx * 0.5 : 0;
      }
    }
    if (this.y < top - 0.02 && this.y + HEIGHT > bottom + 0.02 && this.x + HW > left && this.x - HW < right) {
      const side = prevX < main.x ? -1 : 1;
      this.x = side < 0 ? left - HW : right + HW;
      if (st === 'hitstun') {
        this.vx = -this.vx * 0.55;
      } else {
        this.vx = 0;
        const agile = st === 'free' || (st === 'move' && this.move!.kind === 'recover');
        this.wallT = 0.14;
        this.wallDir = side;
        // Slide down the wall rather than plummeting past it.
        if (agile && dir === -side && this.vy < -7) this.vy = -7;
      }
    }

    // Catch the lip: close to a top corner of the stage, not rocketing past it, and not steering away.
    const canGrab = !this.ground && this.regrabT <= 0 && this.vy < 9 && !this.inp.down && (st === 'free' || (st === 'move' && this.move!.kind === 'recover'));
    if (canGrab && this.y > top - LEDGE_HANG - 0.55 && this.y < top - 0.4) {
      for (const side of [-1, 1]) {
        const lip = main.x + (side * main.w) / 2;
        const out = (this.x - lip) * side;
        if (out < -0.05 || out > 1.05 || dir === side) continue;
        // One fighter per ledge: an occupied lip cannot be grabbed.
        const o = g.fighters[1 - this.id];
        if ((o.state === 'ledge' || o.state === 'climb') && o.ledgeSide === side) continue;
        this.grabLedge(side, g);
        return;
      }
    }

    // Vertical move: stay glued to the ground, or fall and look for a landing.
    if (this.ground) {
      const p = this.ground;
      if (Math.abs(this.x - p.x) > p.w / 2 + HW * 0.6) {
        this.ground = null;
        this.coyote = 0.09;
      } else {
        this.y = p.y;
        this.vy = 0;
      }
    }
    if (!this.ground) {
      this.y += this.vy * dt;
      if (this.vy <= 0) {
        for (const p of g.stage.platforms) {
          if (p.gone > 0 || (!p.solid && this.dropT > 0)) continue;
          // Compare against where the platform was a step ago, so one rising to meet a fall still catches it.
          if (prevY >= p.y - p.vy * dt - 1e-4 && this.y <= p.y && Math.abs(this.x - p.x) <= p.w / 2 + HW * 0.6) {
            this.land(p, g);
            break;
          }
        }
      } else if (this.x + HW > left && this.x - HW < right && prevY + HEIGHT <= bottom + 1e-4 && this.y + HEIGHT > bottom) {
        // Bonk the head on the underside of the stage.
        this.y = bottom - HEIGHT;
        this.vy = 0;
      }
    }
  }

  private land(p: Platform, g: Game): void {
    const impact = -this.vy;
    this.y = p.y;
    if (this.state === 'hitstun' && impact > 16) {
      // Slammed into the floor while tumbling: bounce instead of landing.
      this.vy = impact * 0.42;
      this.vx *= 0.8;
      g.emit('bounce', this.x, this.y, this.id, this.el.id, impact);
      return;
    }
    this.ground = p;
    this.vy = 0;
    this.airJumps = this.el.airJumps;
    this.airDash = true;
    this.recoveryUsed = false;
    this.riseHop = true;
    this.wallJumped = false;
    this.launched = false;
    this.ledgeGrabs = 0;
    this.landT = 0;
    this.landPow = impact;
    g.emit('land', this.x, this.y, this.id, this.el.id, impact);
    const m = this.move;
    if (this.state === 'move' && m && m.kind === 'dive' && !m.landed) {
      m.landed = true;
      m.t = 0;
      m.dur = 0.3;
      g.diveShock(this);
    }
    if (this.state === 'move' && m && m.kind === 'spcDown' && this.el.id === 'earth' && !m.fired) {
      // An airborne Seismic Stomp goes off the instant it touches down.
      m.fired = true;
      m.landed = true;
      m.t = 0;
      m.dur = 0.35;
      g.spawnTremors(this);
    }
  }
}

export interface GameOpts {
  elements: [ElementId, ElementId];
  stage?: StageId;
  seed?: number;
  stocks?: number;
  /** Play the 3-2-1 countdown before inputs are accepted. */
  intro?: boolean;
  /** Freeze the arena: no moving platforms, hazards, conveyor or collapses. For tests of everything else. */
  still?: boolean;
}

export class Game {
  readonly fighters: [Fighter, Fighter];
  readonly stage: StageDef;
  projectiles: Projectile[] = [];
  pillars: Pillar[] = [];
  mines: Mine[] = [];
  walls: Wall[] = [];
  updrafts: Updraft[] = [];
  strikes: Strike[] = [];
  portals: Portal[] = [];
  wells: Well[] = [];
  gremlins: Gremlin[] = [];
  events: GameEvent[] = [];
  time = 0;
  /** Seconds of freeze-frame left after a hit. Gameplay does not advance while it runs. */
  hitstop = 0;
  introT: number;
  /** Game time at which the countdown ended, for the "BEND!" banner. */
  goT = -1;
  winner = -1;
  overT = 0;
  readonly startStocks: number;
  /** Which way the foundry's conveyor is running. */
  beltDir = 1;
  private beltT = 6.5;
  private hazardT = 4;
  private still: boolean;
  /** Stands in as the attacker when the arena itself lands a hit, so nobody is credited for it. */
  private nobody: Fighter;
  private uid = 1;
  private seed: number;

  constructor(opts: GameOpts) {
    this.seed = (opts.seed ?? 1) >>> 0 || 1;
    this.stage = cloneStage(STAGES[opts.stage ?? 'temple']);
    this.still = !!opts.still;
    this.nobody = new Fighter(0, ELEMENTS.fire);
    this.nobody.x = 1e6;
    this.startStocks = opts.stocks ?? START_STOCKS;
    const mk = (id: 0 | 1) => {
      const f = new Fighter(id, ELEMENTS[opts.elements[id]]);
      f.x = this.stage.spawnX[id];
      f.y = this.stage.main.y;
      f.ground = this.stage.main;
      f.facing = id === 0 ? 1 : -1;
      f.stocks = this.startStocks;
      return f;
    };
    this.fighters = [mk(0), mk(1)];
    this.introT = opts.intro ? INTRO_TIME : 0;
    if (!opts.intro) this.goT = -10;
  }

  /** Deterministic 0-1 random (mulberry32), so a seed replays identically. */
  rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  emit(type: EventType, x: number, y: number, id = 0, el: ElementId = 'fire', power = 0, dir = 0, amt = 0, combo = 0): void {
    if (this.events.length < 256) this.events.push({ type, x, y, id, el, power, dir, amt, combo });
  }

  /** The fighter winding up an ultimate, if any. Everything else is frozen while they do. */
  ultCaster(): Fighter | null {
    for (const f of this.fighters) if (f.state === 'ult' && f.stateT < ULT_CHARGE) return f;
    return null;
  }

  step(i0: InputFrame, i1: InputFrame): void {
    const dt = DT;
    const live = this.introT <= 0;
    // Nightmare swaps a fighter's left and right before they ever reach the sim.
    const read = (f: Fighter, i: InputFrame): InputFrame => (!live ? NO_INPUT : f.confuseT > 0 ? { ...i, left: i.right, right: i.left } : i);
    this.fighters[0].latch(read(this.fighters[0], i0));
    this.fighters[1].latch(read(this.fighters[1], i1));

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    const caster = this.ultCaster();
    if (caster) {
      caster.update(dt, this);
      return;
    }

    this.time += dt;
    if (this.introT > 0) {
      const before = Math.ceil(this.introT);
      this.introT -= dt;
      const after = Math.max(0, Math.ceil(this.introT));
      if (after < before && after <= 3) this.emit('count', 0, 0, 0, 'fire', after);
      if (this.introT <= 0) this.goT = this.time;
    }

    if (!this.still) this.updateStage(dt);

    for (const f of this.fighters) {
      if (f.lagT > 0 && f.state !== 'dead' && f.state !== 'ult') {
        // Deep-fried: frozen for seven steps, then all eight happen at once. Rubber-banding.
        f.lagT -= dt;
        if (++f.lagN % 8 === 0) for (let i = 0; i < 8; i++) f.update(dt, this);
      } else f.update(dt, this);
    }
    this.updateProjectiles(dt);
    this.updatePillars(dt);
    this.updateFields(dt);
    this.updateGremlins(dt);

    const b = this.stage.blast;
    for (const f of this.fighters) {
      if (f.state === 'dead' || f.state === 'ult') continue;
      if (this.stage.wrap && (f.x < b.left || f.x > b.right)) {
        // The rift has no sides: out one edge, in the other, still travelling.
        this.emit('warp', f.x, f.y + 0.9, f.id, 'void');
        f.x += (f.x < b.left ? 1 : -1) * (b.right - b.left - 1.5);
        this.emit('warp', f.x, f.y + 0.9, f.id, 'void');
      }
      const out = f.x < b.left || f.x > b.right || f.y < b.bottom || (f.y > b.top && (f.launched || f.state === 'hitstun'));
      if (out) this.ko(f);
    }
    if (this.winner >= 0) this.overT += dt;
  }

  /** Ember Mine: one per fighter, planted on the ground under them. */
  spawnMine(f: Fighter, cash = false): void {
    const x = f.x + f.facing * 0.4;
    const p = groundBelow(this.stage, x, f.y + 0.3) ?? groundBelow(this.stage, f.x, f.y + 0.3);
    if (!p) {
      // Nothing below to plant it on: give the cooldown back.
      f.spcCd = 0.4;
      return;
    }
    this.mines = this.mines.filter((m) => m.owner !== f.id);
    this.mines.push({ uid: this.uid++, owner: f.id, x: clamp(x, p.x - p.w / 2 + 0.3, p.x + p.w / 2 - 0.3), y: p.y, t: 0, cash });
    this.emit('mine', x, p.y, f.id, f.el.id);
  }

  /** Stone Wall: one per fighter, raised a step ahead. Launches whoever is standing there. */
  spawnWall(f: Fighter): void {
    const x = f.x + f.facing * 1.7;
    const p = groundBelow(this.stage, x, f.y + 0.3);
    const y = p ? p.y : f.y;
    this.walls = this.walls.filter((w) => w.owner !== f.id);
    this.walls.push({ uid: this.uid++, owner: f.id, x, y, t: 0, hp: 26, hit: false });
    this.emit('wall', x, y, f.id, f.el.id);
  }

  damageWall(w: Wall, dmg: number): void {
    if (w.hp <= 0) return;
    w.hp -= dmg;
    if (w.hp <= 0) this.emit('wallBreak', w.x, w.y + WALL_HEIGHT / 2, w.owner, 'earth');
  }

  /** Updraft: one per fighter, rooted where they stand (or just below them in the air). */
  spawnUpdraft(f: Fighter): void {
    const p = groundBelow(this.stage, f.x, f.y + 0.3);
    const y = p && f.y - p.y < 3 ? p.y : f.y - 1;
    this.updrafts = this.updrafts.filter((u) => u.owner !== f.id);
    this.updrafts.push({ uid: this.uid++, owner: f.id, x: f.x, y, t: 0 });
    this.emit('updraft', f.x, y, f.id, f.el.id);
  }

  /** Seismic Stomp: a tremor races along the ground each way from the fighter. */
  spawnTremors(f: Fighter): void {
    const y = f.y + 0.4;
    for (const d of [-1, 1]) {
      const p = this.spawnProjectile(f, 'tremor', f.x + d * 0.8, y, d * 15, 0, 0.8, 0.8, TREMOR);
      p.priority = 0;
    }
    this.emit('tremor', f.x, f.y, f.id, f.el.id);
  }

  /** Gale Force turns every enemy shot in front of the caster around. */
  gust(f: Fighter): void {
    for (const p of this.projectiles) {
      if (p.dead || p.owner === f.id || p.kind !== 'bolt') continue;
      const ahead = (p.x - f.x) * f.facing;
      if (ahead < 0 || ahead > GUST_RANGE || Math.abs(p.y - (f.y + 1.05)) > 2.3) continue;
      p.owner = f.id;
      p.vx = f.facing * Math.abs(p.vx) * 1.2;
      p.vy = 0;
      p.age = 0;
    }
  }

  private updateFields(dt: number): void {
    for (const m of this.mines) {
      m.t += dt;
      const foe = this.fighters[1 - m.owner];
      // Half a second to arm, so it cannot be dropped straight onto someone.
      if (m.t <= 0.5) continue;
      if (m.cash) {
        // Loose Change only catches someone actually walking over it, and it floors rather than launches.
        if (!foe.ground || Math.abs(foe.x - m.x) > 0.9 || Math.abs(foe.y - m.y) > 0.1) continue;
        const d = Math.abs(foe.vx) > 1 ? sign(foe.vx) : sign(foe.x - m.x);
        const slip: HitSpec = { dmg: 3, base: 0, growth: 0, angle: 0, shieldDmg: 20, id: 'down', fixed: { vx: d * 9, vy: 5.5, stun: 1 } };
        if (this.hit(m.owner, foe, slip, d, m.x, m.y + 0.3, 'cash')) {
          m.t = MINE_LIFE + 1;
          this.emit('slip', m.x, m.y, m.owner, 'cash');
        }
      } else if (circleHits(m.x, m.y + 0.35, 1.25, foe) && this.hit(m.owner, foe, MINE, sign(foe.x - m.x), m.x, m.y + 0.5, 'fire')) {
        m.t = MINE_LIFE + 1;
        this.emit('mineBoom', m.x, m.y, m.owner, 'fire');
      }
    }
    this.mines = this.mines.filter((m) => m.t < (m.cash ? CASH_LIFE : MINE_LIFE));

    for (const w of this.walls) {
      w.t += dt;
      const foe = this.fighters[1 - w.owner];
      if (!w.hit && w.t < 0.2) {
        const touching = circleHits(w.x, w.y + 0.7, 0.75, foe) || circleHits(w.x, w.y + 2, 0.75, foe);
        if (touching && this.hit(w.owner, foe, WALL_RISE, sign(foe.x - w.x), foe.x, foe.y + 0.4, 'earth')) w.hit = true;
      }
    }
    this.walls = this.walls.filter((w) => w.t < WALL_LIFE && w.hp > 0);

    for (const u of this.updrafts) u.t += dt;
    this.updrafts = this.updrafts.filter((u) => u.t < UPDRAFT_LIFE);

    for (const s of this.strikes) {
      s.t += dt;
      if (s.done || s.t < s.delay) continue;
      s.done = true;
      const main = this.stage.main;
      const el: ElementId = s.kind === 2 ? 'fire' : s.kind === 1 ? 'water' : 'lightning';
      // From the sky it lands on the highest thing at that spot, so standing under a platform is cover.
      // A geyser comes the other way: up through the gap, or out of the floor.
      const top = groundBelow(this.stage, s.x, 99)?.y ?? this.stage.blast.bottom;
      const overFloor = Math.abs(s.x - main.x) < main.w / 2;
      const base = s.kind === 2 ? (overFloor ? main.y : this.stage.blast.bottom) : top;
      this.emit('stormHit', s.x, base, Math.max(0, s.owner), el, 0, 0, s.kind);
      // The arena's own strikes can hit either fighter; a bender's only hit the opponent.
      for (const v of this.fighters) {
        if (v.id === s.owner || Math.abs(v.x - s.x) >= 1 + HW) continue;
        const inColumn = s.kind === 2 ? v.y > base - 0.6 && v.y < Math.max(base, main.y) + 9 : v.y > top - 0.6;
        if (inColumn) this.hit(s.owner, v, s.spec, sign(v.x - s.x), v.x, v.y + 0.9, el);
      }
    }
    this.strikes = this.strikes.filter((s) => s.t < s.delay + 0.35);

    for (const w of this.wells) {
      w.t += dt;
      const life = w.big ? HORIZON_LIFE : WELL_LIFE;
      const foe = this.fighters[1 - w.owner];
      const dx = w.x - foe.x;
      const dy = w.y - (foe.y + 0.9);
      const dist = Math.hypot(dx, dy);
      const exposed = foe.state !== 'dead' && foe.state !== 'ult' && foe.invuln <= 0;
      const reach = w.big ? 60 : 8.5;
      if (w.t < life) {
        const k = w.big ? 1.6 : 1;
        if (exposed && dist < reach) {
          foe.push = sign(dx) * (foe.ground ? 5.5 : 8.5) * k * Math.min(1, Math.abs(dx) / 0.6);
          if (!foe.ground && foe.state !== 'hitstun') foe.vy += clamp(dy, -1, 1) * 28 * k * dt;
          else if (w.big && foe.ground && dy > 1 && Math.abs(dx) < 3.5) {
            foe.ground = null;
            foe.vy = 6;
          }
        }
        // The opponent's shots bend toward it, and are swallowed if they get close.
        for (const p of this.projectiles) {
          if (p.owner === w.owner || p.kind !== 'bolt' || p.dead) continue;
          const px = w.x - p.x;
          const py = w.y - p.y;
          const d = Math.hypot(px, py);
          if (d > reach * 0.7 || d < 0.01) continue;
          p.vx += (px / d) * 34 * dt;
          p.vy += (py / d) * 34 * dt;
          if (d < 0.7) p.dead = true;
        }
        if (w.big && w.t >= w.ticks * 0.15) {
          w.ticks++;
          if (exposed && dist < 3.6) {
            const tick: HitSpec = { dmg: 2.2, base: 0, growth: 0, angle: 0, shieldDmg: 9, ult: true, fixed: { vx: clamp(dx * 4, -7, 7), vy: clamp(dy * 4 + 1.5, -5, 8), stun: 0.2 } };
            this.hit(w.owner, foe, tick, sign(-dx), foe.x, foe.y + 0.9, 'void');
          }
        }
      } else if (!w.done) {
        w.done = true;
        this.emit('wellBoom', w.x, w.y, w.owner, 'void', w.big ? 1 : 0);
        if (dist < (w.big ? 5 : 2.9)) this.hit(w.owner, foe, w.big ? HORIZON : WELL, Math.abs(dx) < 0.2 ? 1 : sign(-dx), foe.x, foe.y + 0.9, 'void');
      }
    }
    this.wells = this.wells.filter((w) => w.t < (w.big ? HORIZON_LIFE : WELL_LIFE) + 0.3);

    // Portals: anyone who walks into one mouth comes out of the other, velocity intact.
    for (const p of this.portals) {
      p.t += dt;
      for (const f of this.fighters) {
        if (f.portalCd > 0 || f.state === 'dead' || f.state === 'ult' || f.state === 'ledge' || f.state === 'climb') continue;
        const cy = f.y + 0.9;
        const atA = Math.hypot(f.x - p.ax, cy - p.ay) < PORTAL_R;
        const atB = !atA && Math.hypot(f.x - p.bx, cy - p.by) < PORTAL_R;
        if (!atA && !atB) continue;
        this.emit('warp', f.x, cy, f.id, 'void');
        f.x = atA ? p.bx : p.ax;
        f.y = (atA ? p.by : p.ay) - 0.9;
        f.ground = null;
        f.portalCd = 0.7;
        this.emit('warp', f.x, f.y + 0.9, f.id, 'void');
      }
    }
    this.portals = this.portals.filter((p) => p.t < PORTAL_LIFE);
  }

  spawnProjectile(
    f: Fighter,
    kind: ProjKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    life: number,
    spec: HitSpec,
  ): Projectile {
    const p: Projectile = {
      uid: this.uid++,
      owner: f.id,
      kind,
      el: f.el.id,
      x,
      y,
      vx,
      vy,
      r,
      age: 0,
      life,
      gravity: 0,
      homing: 0,
      hits: 0,
      hitCd: 0,
      dead: false,
      spec,
      priority: 9,
      mode: Mode.Plain,
      warp: 0,
    };
    this.projectiles.push(p);
    this.emit('shoot', x, y, f.id, f.el.id, kind === 'bolt' ? 0 : 1, sign(vx));
    return p;
  }

  /**
   * Lightning's attack has no projectile: it is an instant line that hits the first thing in reach.
   * The event carries how far it got in `power`.
   */
  zap(f: Fighter, aim: number): void {
    const b = f.el.bolt;
    const foe = this.fighters[1 - f.id];
    const a = aim ? AIM_UP : 0;
    const ux = Math.cos(a) * f.facing;
    const uy = Math.sin(a);
    const ox = f.x + f.facing * 0.6;
    const oy = f.y + 1.05 + (aim ? 0.3 : 0);
    let reach = ZAP_RANGE;
    if (!aim) {
      for (const w of this.walls) {
        const d = (w.x - ox) * f.facing;
        if (w.owner !== f.id && d > 0 && d < reach && oy > w.y && oy < w.y + WALL_HEIGHT) {
          reach = d;
          this.damageWall(w, b.dmg);
        }
      }
    }
    for (let d = 0.5; d < reach; d += 0.8) this.swat(f.id, ox + ux * d, oy + uy * d, 0.5, b.dmg);
    const dx = foe.x - ox;
    const dy = foe.y + HEIGHT / 2 - oy;
    const along = dx * ux + dy * uy;
    const off = Math.abs(dx * uy - dy * ux);
    if (along > 0 && along < reach + HW && off < 1) {
      const spec: HitSpec = { dmg: b.dmg, base: b.base, growth: b.growth, angle: b.angle, id: 'bolt' };
      if (this.hit(f.id, foe, spec, f.facing, foe.x, foe.y + 0.9, f.el.id)) reach = Math.max(0.5, along);
    }
    this.emit('zap', ox, oy, f.id, f.el.id, reach, f.facing, aim);
  }

  /** Blink Strike's teleport: behind the opponent if they are close, otherwise straight ahead. */
  blink(f: Fighter, foe: Fighter): void {
    const main = this.stage.main;
    const b = this.stage.blast;
    let x = f.x + f.facing * 6;
    let y = f.y;
    let face = f.facing;
    if (foe.state !== 'dead' && foe.state !== 'ult' && Math.hypot(foe.x - f.x, foe.y - f.y) < 10) {
      const side = sign(foe.x - f.x);
      x = foe.x + side * 1.15;
      y = foe.y;
      face = -side as 1 | -1;
    }
    x = clamp(x, b.left + 2, b.right - 2);
    // Never materialise inside the stage itself: if that is where it leads, strike from where you stand.
    const inside = y < main.y - 0.02 && y + HEIGHT > main.y - main.thick && Math.abs(x - main.x) < main.w / 2 + HW;
    if (inside) return;
    this.emit('blinkOut', f.x, f.y + 0.9, f.id, f.el.id);
    f.x = x;
    f.y = y + 0.02;
    f.vx = 0;
    f.vy = 0;
    f.ground = null;
    f.facing = face;
    f.invuln = Math.max(f.invuln, 0.1);
    this.emit('blinkIn', f.x, f.y + 0.9, f.id, f.el.id);
  }

  spawnStrike(owner: number, x: number, delay: number, spec: HitSpec, kind = 0): void {
    this.strikes.push({ uid: this.uid++, owner, kind, x, t: 0, delay, spec, done: false });
    this.emit('stormWarn', x, groundBelow(this.stage, x, 99)?.y ?? this.stage.main.y, Math.max(0, owner), 'lightning', delay, 0, kind);
  }

  /** Everything the arena does on its own: platforms on their rounds, floors giving way, the conveyor, the hazards. */
  private updateStage(dt: number): void {
    const stage = this.stage;
    const main = stage.main;
    movePlatforms(stage, this.time, dt);

    for (const p of stage.platforms) {
      if (!p.crumble) continue;
      if (p.gone > 0) {
        p.gone -= dt;
        if (p.gone <= 0) this.emit('restore', p.x, p.y, 0, 'earth');
        continue;
      }
      const stoodOn = this.fighters[0].ground === p || this.fighters[1].ground === p;
      p.shake = stoodOn ? p.shake + dt : Math.max(0, p.shake - dt * 0.5);
      if (p.shake >= 0.9) {
        p.shake = 0;
        p.gone = 2.6;
        this.emit('crumble', p.x, p.y, 0, 'earth', p.w);
      }
    }

    if (stage.belt) {
      this.beltT -= dt;
      if (this.beltT <= 0) {
        this.beltT = 6.5;
        this.beltDir = -this.beltDir;
        this.emit('belt', 0, main.y, 0, 'metal', 0, this.beltDir);
      }
    }

    if (stage.hazard === 'none' || this.introT > 0 || this.winner >= 0) return;
    this.hazardT -= dt;
    if (this.hazardT > 0) return;
    const r = this.rand();
    switch (stage.hazard) {
      case 'icicle':
        this.hazardT = 2.2 + r * 2.2;
        this.spawnStrike(-1, (this.rand() - 0.5) * (main.w + 6), 0.9, ICICLE, 1);
        break;
      case 'storm': {
        // The sky aims at one of the fighters, roughly.
        this.hazardT = 2 + r * 2.5;
        const target = this.fighters[this.rand() < 0.5 ? 0 : 1];
        this.spawnStrike(-1, clamp(target.x + (this.rand() - 0.5) * 5, -18, 18), 1, SKY_BOLT, 0);
        break;
      }
      case 'geyser': {
        // Mostly up through the gaps beside the island, sometimes through the floor.
        this.hazardT = 3 + r * 3;
        const side = this.rand() < 0.5 ? -1 : 1;
        const x = this.rand() < 0.7 ? side * (main.w / 2 + 1.4) : (this.rand() - 0.5) * (main.w - 2);
        this.spawnStrike(-1, x, 1.1, GEYSER, 2);
        break;
      }
      case 'vent':
        this.hazardT = 2.6 + r * 2.6;
        this.spawnStrike(-1, (this.rand() - 0.5) * (main.w - 2), 1, GEYSER, 2);
        break;
    }
  }

  /** Shadow's Swap: if it lands, the two fighters trade places exactly. */
  swap(f: Fighter, foe: Fighter): void {
    const ok = foe.state !== 'dead' && foe.state !== 'ult';
    const bx = foe.x;
    const by = foe.y;
    const bg = foe.ground;
    const jolt: HitSpec = { dmg: 4, base: 0, growth: 0, angle: 0, id: 'special', fixed: { vx: 0, vy: 2, stun: 0.34 } };
    if (!ok || this.hit(f.id, foe, jolt, f.facing, foe.x, foe.y + 0.9, f.el.id) !== 1) {
      // Shielded or untouchable: nothing happens, and it is ready again sooner.
      f.spcCd = Math.min(f.spcCd, 2);
      this.emit('fizzle', f.x + f.facing * 0.6, f.y + 1, f.id, f.el.id, 0);
      return;
    }
    foe.x = f.x;
    foe.y = f.y + 0.02;
    foe.ground = null;
    foe.gravFlipT = 0;
    f.x = bx;
    f.y = by;
    f.ground = bg;
    f.vx = f.vy = 0;
    this.emit('swap', f.x, f.y + 0.9, f.id, f.el.id);
    this.emit('swap', foe.x, foe.y + 0.9, foe.id, f.el.id);
  }

  /** Void's Portal: one mouth where the caster stands, the other nine steps ahead. */
  spawnPortal(f: Fighter): void {
    const main = this.stage.main;
    const b = this.stage.blast;
    const ay = f.y + 0.9;
    const bx = clamp(f.x + f.facing * 9, b.left + 3, b.right - 3);
    let by = ay;
    // The far mouth never opens inside the stage; it sits just above the floor instead.
    if (by < main.y + 1 && by > main.y - main.thick - 1 && Math.abs(bx - main.x) < main.w / 2 + 0.8) by = main.y + 1;
    this.portals = this.portals.filter((p) => p.owner !== f.id);
    this.portals.push({ uid: this.uid++, owner: f.id, ax: f.x, ay, bx, by, t: 0 });
    // The caster is standing in the near mouth: they have to step out and back in to use it.
    f.portalCd = 0.9;
    this.emit('portal', f.x, ay, f.id, f.el.id);
    this.emit('portal', bx, by, f.id, f.el.id);
  }

  spawnGremlin(f: Fighter): void {
    this.gremlins.push({ uid: this.uid++, owner: f.id, x: f.x + f.facing * 0.8, y: f.y + 0.2, vx: f.facing * 4, vy: 9, grounded: false, facing: f.facing, hp: 10, t: 0, biteCd: 0.6 });
    this.emit('gremlin', f.x + f.facing * 0.8, f.y + 0.4, f.id, f.el.id);
  }

  /** Any attack that would have hit a fighter at this circle also swats gremlins that are in it. */
  swat(attId: number, cx: number, cy: number, r: number, dmg: number): boolean {
    let any = false;
    for (const m of this.gremlins) {
      if (m.owner === attId || m.hp <= 0) continue;
      if (Math.hypot(m.x - cx, m.y + 0.35 - cy) > r + 0.45) continue;
      m.hp -= dmg;
      m.vx = sign(m.x - cx) * 9;
      m.vy = 8;
      m.grounded = false;
      any = true;
      this.emit(m.hp <= 0 ? 'gremlinDie' : 'gremlinBite', m.x, m.y + 0.35, m.owner, 'tyler', 1);
    }
    return any;
  }

  private updateGremlins(dt: number): void {
    for (const m of this.gremlins) {
      m.t += dt;
      m.biteCd -= dt;
      const foe = this.fighters[1 - m.owner];
      const dx = foe.x - m.x;
      const alive = foe.state !== 'dead';
      if (m.grounded) {
        // Scurry at them; hop when they are above, or when the floor is about to run out.
        const want = alive && Math.abs(dx) > 0.7 ? sign(dx) * 6 : 0;
        m.vx = approach(m.vx, want, 60 * dt);
        if (want) m.facing = sign(want);
        const ahead = groundBelow(this.stage, m.x + m.facing * 0.7, m.y + 0.2);
        if (alive && (foe.y > m.y + 1.2 || (want !== 0 && (!ahead || ahead.y < m.y - 0.1)))) {
          m.vy = 16;
          m.grounded = false;
        }
      }
      if (!m.grounded) m.vy -= 44 * dt;
      const prevY = m.y;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.grounded = false;
      if (m.vy <= 0) {
        for (const p of this.stage.platforms) {
          if (prevY >= p.y - 1e-4 && m.y <= p.y && Math.abs(m.x - p.x) <= p.w / 2 + 0.2) {
            m.y = p.y;
            m.vy = 0;
            m.grounded = true;
            break;
          }
        }
      }
      if (alive && m.biteCd <= 0 && Math.abs(dx) < 0.95 && Math.abs(foe.y - m.y) < 1.4) {
        const nip: HitSpec = { dmg: 2, base: 0, growth: 0, angle: 0, shieldDmg: 3, light: true, fixed: { vx: sign(dx) * 2.5, vy: 3.5, stun: 0.12 } };
        if (this.hit(m.owner, foe, nip, sign(dx), foe.x, foe.y + 0.5, 'tyler')) {
          m.biteCd = 0.7;
          this.emit('gremlinBite', m.x, m.y + 0.35, m.owner, 'tyler', 0);
        }
      }
      if (m.t >= GREMLIN_LIFE && m.hp > 0) {
        m.hp = 0;
        this.emit('gremlinDie', m.x, m.y + 0.35, m.owner, 'tyler', 0);
      }
    }
    const b = this.stage.blast;
    this.gremlins = this.gremlins.filter((m) => m.hp > 0 && m.y > b.bottom && Math.abs(m.x) < b.right);
  }

  spawnWell(f: Fighter, x: number, y: number, big: boolean): void {
    if (!big) this.wells = this.wells.filter((w) => w.owner !== f.id || w.big);
    this.wells.push({ uid: this.uid++, owner: f.id, x, y, t: 0, big, ticks: 0, done: false });
    this.emit('well', x, y, f.id, f.el.id, big ? 1 : 0);
  }

  spawnBolt(f: Fighter, aim = 0): void {
    if (f.el.id === 'lightning') {
      this.zap(f, aim);
      return;
    }
    const b = f.el.bolt;
    const spec: HitSpec = { dmg: b.dmg, base: b.base, growth: b.growth, angle: b.angle, id: 'bolt' };
    const a = aim ? AIM_UP : 0;
    const p = this.spawnProjectile(
      f,
      'bolt',
      f.x + f.facing * 0.7,
      f.y + 1.05 + (aim ? 0.3 : 0),
      f.facing * b.speed * Math.cos(a),
      b.vy0 + b.speed * Math.sin(a),
      b.radius,
      b.life,
      spec,
    );
    p.gravity = b.gravity;
    p.homing = b.homing;
    p.priority = b.priority;
    p.mode = f.el.id === 'metal' ? Mode.DiscOut : f.el.id === 'shadow' ? Mode.Ghost : f.el.id === 'void' ? Mode.Reverse : Mode.Plain;
    if (f.el.id === 'cash' && f.notes++ % 4 === 3) {
      // The fourth throw is the good stuff.
      p.mode = Mode.Gold;
      p.vx *= 0.75;
      p.gravity = 9;
      p.vy += 2.5;
      p.r = 0.55;
      spec.dmg = 9.5;
      spec.base = 12;
      spec.growth = 15;
    }
    if (f.el.id === 'tyler') {
      spec.soft = true;
      spec.light = true;
      // Each shot is the next note of the tune; the event carries which one.
      this.emit('note', p.x, p.y, f.id, f.el.id, f.notes++, f.facing);
    }
  }

  /** Stone Pillar: erupts under the opponent if they are in front and in range, else a few steps ahead. */
  spawnPillar(f: Fighter, foe: Fighter): void {
    const main = this.stage.main;
    let tx = f.x + f.facing * 5;
    let ty = f.y;
    const ahead = (foe.x - f.x) * f.facing;
    if (foe.state !== 'dead' && ahead > 0.5 && ahead < 13) {
      tx = foe.x + foe.vx * 0.2;
      ty = foe.y;
    }
    let p = groundBelow(this.stage, tx, ty) ?? groundBelow(this.stage, tx, f.y);
    if (!p) {
      tx = clamp(tx, main.x - main.w / 2 + 0.9, main.x + main.w / 2 - 0.9);
      p = main;
    }
    this.pillars.push({ uid: this.uid++, owner: f.id, el: f.el.id, x: tx, y: p.y, t: 0, delay: PILLAR_DELAY, spec: PILLAR, group: 0, erupted: false, hit: false });
    this.emit('pillarWarn', tx, p.y, f.id, f.el.id);
  }

  /** One column of the earth ultimate: a pillar on every platform that has ground at `x`. */
  spawnQuake(f: Fighter, x: number): void {
    // All of one caster's quake pillars share a group, so a victim is only launched once.
    const group = 1000 + f.id;
    for (const p of this.stage.platforms) {
      if (Math.abs(x - p.x) > p.w / 2 - 0.2) continue;
      this.pillars.push({ uid: this.uid++, owner: f.id, el: f.el.id, x, y: p.y, t: 0, delay: 0.22, spec: QUAKE, group, erupted: false, hit: false });
      this.emit('pillarWarn', x, p.y, f.id, f.el.id);
    }
  }

  /**
   * A melee hitbox test. Returns true once it connects (hit, blocked or parried) so the move
   * stops checking. A parried attacker is staggered.
   */
  melee(att: Fighter, foe: Fighter, cx: number, cy: number, r: number, spec: HitSpec, dirX: number): boolean {
    this.swat(att.id, cx, cy, r, spec.dmg);
    if (!circleHits(cx, cy, r, foe)) return false;
    const hx = (cx + foe.x) / 2;
    const hy = (cy + foe.y + HEIGHT / 2) / 2;
    const res = this.hit(att.id, foe, spec, dirX, hx, hy, att.el.id);
    if (res === 3) {
      att.setState('hitstun');
      att.hitstun = 0.6;
      att.vx = -dirX * 9;
      att.flashT = 0.18;
    }
    return res !== 0;
  }

  diveShock(f: Fighter): void {
    this.emit('diveLand', f.x, f.y, f.id, f.el.id);
    const foe = this.fighters[1 - f.id];
    const d = sign(foe.x - f.x);
    if (circleHits(f.x - 1.2, f.y + 0.5, 1.2, foe) || circleHits(f.x + 1.2, f.y + 0.5, 1.2, foe)) {
      this.hit(f.id, foe, SHOCK, d, foe.x, foe.y + 0.5, f.el.id);
    }
  }

  breakShield(v: Fighter): void {
    v.shieldHp = 0;
    v.shieldDelay = 3;
    v.stunFor = STUN_TIME;
    v.setState('stunned');
    v.ground = null;
    v.vx = 0;
    v.vy = 12;
    this.hitstop = Math.max(this.hitstop, 0.12);
    this.emit('shieldBreak', v.x, v.y + 0.9, v.id, v.el.id);
  }

  /**
   * Applies a hit to `v`. Returns 0 if it whiffed on invulnerability, 1 if it landed,
   * 2 if it was shielded, 3 if it was parried (shield raised just in time).
   * The hit event carries knockback speed in `power`, damage in `amt`.
   */
  hit(attId: number, v: Fighter, spec: HitSpec, dirX: number, hx: number, hy: number, el: ElementId): 0 | 1 | 2 | 3 {
    if (v.state === 'dead' || v.state === 'ult' || v.invuln > 0) return 0;
    const att = attId < 0 ? this.nobody : this.fighters[attId];

    if (v.state === 'shield') {
      if (v.stateT <= PARRY_WINDOW && !spec.ult) {
        this.hitstop = Math.max(this.hitstop, 0.13);
        v.meter = Math.min(100, v.meter + 6);
        this.emit('parry', hx, hy, v.id, v.el.id, spec.dmg, dirX);
        return 3;
      }
      v.shieldHp -= spec.shieldDmg ?? spec.dmg * 1.15;
      v.vx = dirX * 5;
      this.hitstop = Math.max(this.hitstop, 0.04);
      if (v.shieldHp <= 0) this.breakShield(v);
      else this.emit('shield', hx, hy, v.id, v.el.id, spec.dmg, dirX);
      return 2;
    }

    if (v.armorT > 0 && !spec.ult) {
      // Iron Skin: it still hurts, but less, and it does not budge them.
      const soaked = spec.dmg * 0.6;
      v.damage = Math.min(999, v.damage + soaked);
      att.dealt += soaked;
      att.meter = Math.min(100, att.meter + soaked * 0.5);
      v.flashT = 0.1;
      this.hitstop = Math.max(this.hitstop, 0.03);
      this.emit('armorHit', hx, hy, v.id, v.el.id, soaked, dirX, soaked);
      return 1;
    }

    // The same move landed again and again loses its bite; mixing it up brings it back.
    const stale = spec.id ? att.staleFactor(spec.id) : 1;
    if (spec.id) {
      att.stale.push(spec.id);
      if (att.stale.length > 8) att.stale.shift();
    }
    const dmg = spec.dmg * stale;
    v.damage = Math.min(999, v.damage + dmg);
    att.dealt += dmg;
    if (!spec.ult) att.meter = Math.min(100, att.meter + dmg * 0.5);
    v.meter = Math.min(100, v.meter + dmg * 0.3);
    // Hitting a gold statue breaks it (the next update announces the shatter).
    if (v.goldT > 0) v.goldT = 1e-4;
    if (spec.soft) {
      // A sting and a nudge. Whatever they were doing, they keep doing it.
      v.vx += dirX * 1.2;
      v.flashT = 0.08;
      this.emit('hit', hx, hy, v.id, el, 2, dirX, dmg, 0);
      return 1;
    }
    att.combo = att.comboT > 0 ? att.combo + 1 : 1;
    att.comboT = 1.3;
    att.bestCombo = Math.max(att.bestCombo, att.combo);

    let kb: number;
    if (spec.fixed) {
      v.vx = spec.fixed.vx;
      v.vy = spec.fixed.vy;
      v.hitstun = spec.fixed.stun;
      v.launched = false;
      kb = 8;
    } else {
      kb = ((spec.base + (spec.growth * v.damage) / 100) / v.el.weight) * (0.6 + 0.4 * stale);
      const a = (spec.angle * Math.PI) / 180;
      v.vx = Math.cos(a) * kb * dirX;
      v.vy = Math.sin(a) * kb;
      // A spike into the floor bounces back up.
      if (v.ground && v.vy < 0) v.vy = -v.vy * 0.85;
      v.hitstun = clamp(0.1 + kb * 0.017, 0.16, 1.2);
      v.launched = true;
    }
    if (v.vy > 0.5) v.ground = null;
    v.setState('hitstun');
    v.recoveryUsed = false;
    v.dropT = 0;
    v.flashT = 0.18;
    this.hitstop = Math.max(this.hitstop, clamp(0.02 + dmg * 0.004 + kb * 0.0022, 0.03, 0.17));
    this.emit('hit', hx, hy, v.id, el, kb, dirX, dmg, att.combo);

    // Breaking free: take enough hits in a row and the fighter bursts out, untouchable for a moment,
    // and throws back anyone standing over them. Nothing can be spammed into a lock.
    if (!spec.ult) {
      v.pressure += spec.light ? 0.3 : spec.fixed ? 0.5 : 1;
      if (v.pressure >= 4.5 && v.burstCd <= 0) {
        v.pressure = 0;
        v.burstCd = 4;
        v.hitstun = Math.min(v.hitstun, 0.16);
        v.invuln = 0.8;
        v.vx *= 0.35;
        v.vy = Math.max(v.vy * 0.35, 5);
        v.ground = null;
        v.launched = false;
        this.emit('burst', v.x, v.y + 0.9, v.id, v.el.id);
        if (att.state !== 'dead' && att.state !== 'ult' && Math.hypot(att.x - v.x, att.y - v.y) < 3.4) {
          att.setState('hitstun');
          att.hitstun = 0.32;
          att.vx = sign(att.x - v.x) * 15;
          att.vy = 7;
          att.ground = null;
          att.flashT = 0.18;
        }
      }
    }
    return 1;
  }

  private updateProjectiles(dt: number): void {
    const ps = this.projectiles;
    const main = this.stage.main;
    const b = this.stage.blast;
    const left = main.x - main.w / 2;
    const right = main.x + main.w / 2;
    for (const p of ps) {
      if (p.dead) continue;
      const foe = this.fighters[1 - p.owner];
      p.age += dt;
      p.hitCd -= dt;
      if (p.homing > 0 && foe.state !== 'dead') {
        const want = clamp((foe.y + 0.9 - p.y) * 2.5, -9, 9);
        p.vy = approach(p.vy, want, p.homing * dt);
      }
      p.warp -= dt;
      if (p.mode === Mode.DiscOut) {
        // A razor disc brakes hard at the end of its throw, then turns for home.
        p.vx = approach(p.vx, 0, 30 * dt);
        p.vy = approach(p.vy, 0, 30 * dt);
        if (Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 0.5) {
          p.mode = Mode.DiscBack;
          p.hitCd = 0;
        }
      } else if (p.mode === Mode.DiscBack) {
        const o = this.fighters[p.owner];
        const hx = o.x - p.x;
        const hy = o.y + 1 - p.y;
        const d = Math.hypot(hx, hy) || 1;
        if (o.state === 'dead') p.dead = true;
        else if (d < 0.9) {
          // Caught: the disc goes back in the magazine.
          p.dead = true;
          o.ammo = Math.min(o.el.ammo, o.ammo + 1);
        } else {
          p.vx = approach(p.vx, (hx / d) * 24, 70 * dt);
          p.vy = approach(p.vy, (hy / d) * 24, 70 * dt);
        }
        if (p.dead) continue;
      } else if (p.mode === Mode.Ghost && foe.state !== 'dead') {
        // A shade steers itself at the opponent and ignores everything in between.
        const hx = foe.x - p.x;
        const hy = foe.y + 0.9 - p.y;
        const d = Math.hypot(hx, hy) || 1;
        p.vx = approach(p.vx, (hx / d) * 10, 20 * dt);
        p.vy = approach(p.vy, (hy / d) * 10, 20 * dt);
      }
      p.vy -= p.gravity * dt;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'fry') {
        for (const f of this.fighters) {
          if (f.state !== 'dead' && Math.hypot(f.x - p.x, f.y + 0.9 - p.y) < p.r) f.lagT = 0.12;
        }
        if (p.age >= p.life) p.dead = true;
        continue;
      }
      if (p.kind === 'piano' || p.kind === 'poop') {
        // Both come down hard and end on the first thing they land on.
        const under = groundBelow(this.stage, p.x, prevY + 0.2);
        const landed = p.vy < 0 && under !== null && (under.solid || p.kind === 'piano') && p.y - 0.5 <= under.y;
        const touching = circleHits(p.x, p.y, p.r, foe);
        if (p.kind === 'piano') {
          this.swat(p.owner, p.x, p.y, p.r, 99);
          if (touching || landed) {
            p.dead = true;
            this.emit('pianoCrash', p.x, landed && under ? under.y : p.y, p.owner, p.el);
            if (circleHits(p.x, p.y, p.r + (landed ? 0.7 : 0), foe)) this.hit(p.owner, foe, p.spec, sign(p.vx), foe.x, foe.y + 0.9, p.el);
            continue;
          }
        } else if (touching || landed) {
          p.dead = true;
          this.emit('splat', p.x, landed && under ? under.y : p.y, p.owner, p.el, touching ? 1 : 0);
          if (touching) {
            const d = sign(p.vx);
            const dunk: HitSpec = { dmg: 3.2, base: 0, growth: 0, angle: 0, shieldDmg: 7, ult: true, fixed: { vx: d * 9, vy: -13, stun: 0.22 } };
            this.hit(p.owner, foe, dunk, d, foe.x, foe.y + 1.2, p.el);
          }
          continue;
        }
        if (p.age >= p.life || p.y < b.bottom - 2) p.dead = true;
        continue;
      }

      if (p.kind === 'tremor') {
        // A tremor only exists on the ground it was stomped into, and only trips grounded fighters.
        const under = groundBelow(this.stage, p.x, p.y);
        if (!under || Math.abs(under.y - (p.y - 0.4)) > 0.05) {
          p.dead = true;
          continue;
        }
        if (p.hits === 0 && foe.ground && Math.abs(foe.y - under.y) < 0.05 && Math.abs(foe.x - p.x) < p.r + HW) {
          if (this.hit(p.owner, foe, p.spec, sign(p.vx), foe.x, foe.y + 0.3, p.el)) p.hits = 1;
        }
        if (p.age >= p.life) p.dead = true;
        continue;
      }

      if (p.kind === 'bolt' && p.warp <= 0) {
        for (const g of this.portals) {
          const atA = Math.hypot(p.x - g.ax, p.y - g.ay) < PORTAL_R;
          const atB = !atA && Math.hypot(p.x - g.bx, p.y - g.by) < PORTAL_R;
          if (!atA && !atB) continue;
          this.emit('warp', p.x, p.y, p.owner, 'void', 1);
          p.x = atA ? g.bx : g.ax;
          p.y = atA ? g.by : g.ay;
          p.warp = 0.5;
          this.emit('warp', p.x, p.y, p.owner, 'void', 1);
          break;
        }
      }

      // The opponent's wall stops shots and waves, and takes the damage.
      if ((p.kind === 'bolt' && p.mode !== Mode.Ghost) || p.kind === 'wave') {
        let stopped = false;
        for (const w of this.walls) {
          if (w.owner === p.owner || Math.abs(p.x - w.x) > p.r * 0.5 + 0.3) continue;
          if (p.y + p.r < w.y || p.y - p.r > w.y + WALL_HEIGHT) continue;
          this.damageWall(w, p.spec.dmg);
          stopped = true;
        }
        if (stopped) {
          p.dead = true;
          this.emit('fizzle', p.x, p.y, p.owner, p.el, 1);
          continue;
        }
      }

      if (p.kind === 'bolt' && this.gremlins.length && this.swat(p.owner, p.x, p.y, p.r, p.spec.dmg) && p.mode !== Mode.DiscOut && p.mode !== Mode.DiscBack) {
        p.dead = true;
        continue;
      }
      if (p.kind === 'bolt' && p.mode !== Mode.Ghost) {
        let blocked = p.x > left && p.x < right && p.y - p.r * 0.6 < main.y && p.y > main.y - main.thick;
        if (!blocked && p.gravity > 0 && p.vy < 0) {
          for (const s of this.stage.platforms) {
            if (s.solid) continue;
            if (prevY - p.r >= s.y && p.y - p.r < s.y && Math.abs(p.x - s.x) < s.w / 2) blocked = true;
          }
        }
        if (blocked) {
          p.dead = true;
          this.emit('fizzle', p.x, p.y, p.owner, p.el, 1);
          continue;
        }
      }

      if (p.hitCd <= 0 && circleHits(p.x, p.y, p.r, foe)) this.projectileHit(p, foe);

      if (!p.dead && p.age >= p.life) {
        if (p.kind === 'clone') this.burstClone(p, foe);
        else {
          p.dead = true;
          this.emit('fizzle', p.x, p.y, p.owner, p.el, 0);
        }
      }
      if (!p.dead && (p.x < b.left - 6 || p.x > b.right + 6 || p.y < b.bottom - 4 || p.y > b.top + 8)) {
        p.dead = true;
      }
    }

    // Opposing shots cancel each other. Waves, cyclones and tsunamis swallow bolts whole.
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.dead) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const c = ps[j];
        if (c.dead || a.dead || a.owner === c.owner) continue;
        // Tremors, fry clouds and falling filth are not things a shot can collide with.
        if (a.kind === 'tremor' || c.kind === 'tremor' || a.kind === 'fry' || c.kind === 'fry' || a.kind === 'poop' || c.kind === 'poop') continue;
        const dx = a.x - c.x;
        const dy = a.y - c.y;
        const rr = a.r + c.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        const aBolt = a.kind === 'bolt';
        const cBolt = c.kind === 'bolt';
        if (!aBolt && !cBolt) continue;
        if (aBolt && cBolt) {
          const pa = a.priority;
          const pc = c.priority;
          if (pa <= pc) a.dead = true;
          if (pc <= pa) c.dead = true;
        } else if (aBolt) a.dead = true;
        else c.dead = true;
        const gone = a.dead ? a : c;
        this.emit('clash', gone.x, gone.y, a.owner, gone.el, 0);
      }
    }

    let w = 0;
    for (let i = 0; i < ps.length; i++) if (!ps[i].dead) ps[w++] = ps[i];
    ps.length = w;
  }

  /** A decoy goes off: a burst around it, whether it reached anyone or just ran out of time. */
  private burstClone(p: Projectile, foe: Fighter): void {
    p.dead = true;
    this.emit('cloneBoom', p.x, p.y, p.owner, p.el);
    if (circleHits(p.x, p.y, 2, foe)) this.hit(p.owner, foe, p.spec, sign(foe.x - p.x), foe.x, foe.y + 0.9, p.el);
  }

  private projectileHit(p: Projectile, foe: Fighter): void {
    const d = sign(p.vx);
    if (p.kind === 'clone') {
      this.burstClone(p, foe);
    } else if (p.kind === 'orb') {
      // Ball lightning: a small jolt every third of a second for as long as they stay near it.
      const jolt: HitSpec = { dmg: 2.4, base: 0, growth: 0, angle: 0, shieldDmg: 4, fixed: { vx: sign(foe.x - p.x) * 2, vy: 3, stun: 0.16 } };
      if (this.hit(p.owner, foe, jolt, sign(foe.x - p.x), foe.x, foe.y + 0.9, p.el)) p.hitCd = 0.33;
    } else if (p.kind === 'bolt') {
      // A graviton knocks its target back toward whoever fired it.
      const res = this.hit(p.owner, foe, p.spec, p.mode === Mode.Reverse ? -d : d, p.x, p.y, p.el);
      if (res === 3) {
        // Parried: the shot is theirs now, and it comes back harder.
        p.owner = foe.id;
        p.vx = -p.vx * 1.25;
        p.vy = -p.vy * 0.5;
        p.age = 0;
        p.hitCd = 0.05;
        p.mode = Mode.Plain;
        p.spec = { ...p.spec, dmg: p.spec.dmg * 1.3, base: p.spec.base + 2 };
      } else if (res) {
        // A razor disc cuts through and keeps flying; everything else is spent on impact.
        if (p.mode === Mode.DiscOut || p.mode === Mode.DiscBack) p.hitCd = 0.45;
        else p.dead = true;
      }
    } else if (p.kind === 'wave' || p.kind === 'tsunami') {
      if (p.hits === 0 && this.hit(p.owner, foe, p.spec, d, foe.x, foe.y + 0.9, p.el)) p.hits = 1;
    } else if (p.hits < 4) {
      // Cyclone: drag the victim to the eye and hold them there for a few ticks...
      const tick: HitSpec = {
        dmg: 2.5,
        base: 0,
        growth: 0,
        angle: 0,
        shieldDmg: 5,
        fixed: { vx: clamp((p.x - foe.x) * 5, -6, 6) + p.vx, vy: foe.y > p.y + 0.4 ? 1 : 6, stun: 0.26 },
      };
      if (this.hit(p.owner, foe, tick, d, foe.x, foe.y + 0.9, p.el)) {
        p.hits++;
        p.hitCd = 0.2;
      }
    } else if (this.hit(p.owner, foe, p.spec, d, foe.x, foe.y + 0.9, p.el)) {
      // ...then throw them out of the top.
      p.dead = true;
      this.emit('fizzle', p.x, p.y, p.owner, p.el, 2);
    }
  }

  private updatePillars(dt: number): void {
    const ps = this.pillars;
    for (const p of ps) {
      p.t += dt;
      if (!p.erupted && p.t >= p.delay) {
        p.erupted = true;
        this.emit('pillarErupt', p.x, p.y, p.owner, p.el);
      }
      if (p.erupted && !p.hit && p.t < p.delay + 0.2) {
        const foe = this.fighters[1 - p.owner];
        const touching =
          circleHits(p.x, p.y + 0.9, 1.0, foe) || circleHits(p.x, p.y + 2.3, 1.0, foe) || circleHits(p.x, p.y + 3.6, 0.9, foe);
        if (touching) {
          const d = Math.abs(foe.x - p.x) < 0.15 ? this.fighters[p.owner].facing : sign(foe.x - p.x);
          if (this.hit(p.owner, foe, p.spec, d, foe.x, foe.y + 0.4, p.el)) {
            p.hit = true;
            if (p.group) for (const q of ps) if (q.group === p.group) q.hit = true;
          }
        }
      }
    }
    let w = 0;
    for (let i = 0; i < ps.length; i++) if (ps[i].t < ps[i].delay - PILLAR_DELAY + PILLAR_LIFE) ps[w++] = ps[i];
    ps.length = w;
  }

  private ko(f: Fighter): void {
    const other = this.fighters[1 - f.id];
    const b = this.stage.blast;
    f.stocks--;
    f.falls++;
    other.kos++;
    f.setState('dead');
    f.respawnT = 1.5;
    f.vx = f.vy = 0;
    f.hitstun = 0;
    f.launched = false;
    const x = clamp(f.x, b.left, b.right);
    const y = clamp(f.y, b.bottom, b.top);
    const final = f.stocks <= 0 && this.winner < 0;
    this.emit('ko', x, y, f.id, f.el.id, final ? 1 : 0);
    if (final) {
      this.winner = other.id;
      this.emit('gameover', other.x, other.y, other.id, other.el.id);
    }
  }

  respawn(f: Fighter): void {
    f.setState('free');
    f.x = this.stage.respawn.x[f.id];
    f.y = this.stage.respawn.y;
    f.vx = f.vy = 0;
    f.ground = null;
    f.facing = f.id === 0 ? 1 : -1;
    f.damage = 0;
    f.invuln = 2.5;
    f.shieldHp = MAX_SHIELD;
    f.airJumps = f.el.airJumps;
    f.airDash = true;
    f.recoveryUsed = false;
    f.riseHop = true;
    f.wallJumped = false;
    f.ledgeGrabs = 0;
    f.pressure = 0;
    f.ammo = f.el.ammo;
    f.armorT = 0;
    f.confuseT = 0;
    f.gravFlipT = 0;
    f.lagT = 0;
    f.goldT = 0;
    f.clearBuffers();
    this.emit('respawn', f.x, f.y, f.id, f.el.id);
  }
}
