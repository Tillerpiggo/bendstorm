/**
 * CPU opponent. It plays through the same InputFrame interface as a human:
 * it decides a few times a second which buttons to hold, and the edges fall
 * out of comparing against the previous step. Used for vs-CPU, the title
 * screen's attract fight, and the soak tests.
 */
import { DT, HEIGHT, HW, type Fighter, type Game } from './sim';
import { emptyPad, type InputFrame, type Pad } from './types';

type Key = keyof Pad;
const KEYS: Key[] = ['left', 'right', 'up', 'down', 'atk', 'spc', 'grd', 'taunt'];

export class Bot {
  /** Seconds each key stays held. Taps are just short holds. */
  private hold: Record<Key, number> = { left: 0, right: 0, up: 0, down: 0, atk: 0, spc: 0, grd: 0, taunt: 0 };
  private prev: Pad = emptyPad();
  private thinkT = 0;
  private moveDir = 0;
  private seed: number;

  /** `skill` 0-1 scales reaction speed and how often it takes an opening. */
  constructor(
    seed: number,
    private skill = 0.75,
  ) {
    this.seed = seed >>> 0 || 7;
  }

  private rand(): number {
    this.seed = (this.seed + 0x6d2b79f5) >>> 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Presses a key, but only if it is currently up, so the sim sees a fresh edge. */
  private tap(k: Key, t = 0.06): void {
    if (this.hold[k] <= 0 && !this.prev[k]) this.hold[k] = t;
  }

  private face(d: number): void {
    this.hold[d > 0 ? 'right' : 'left'] = 0.09;
    this.hold[d > 0 ? 'left' : 'right'] = 0;
  }

  sample(g: Game, id: number): InputFrame {
    const me = g.fighters[id];
    const foe = g.fighters[1 - id];
    for (const k of KEYS) this.hold[k] = Math.max(0, this.hold[k] - DT);
    this.thinkT -= DT;
    if (this.thinkT <= 0) {
      this.thinkT = 0.07 + this.rand() * (0.3 - 0.2 * this.skill);
      this.moveDir = 0;
      this.think(g, me, foe);
    }
    const h = this.hold;
    const pad: Pad = {
      left: h.left > 0 || (this.moveDir < 0 && h.right <= 0),
      right: h.right > 0 || (this.moveDir > 0 && h.left <= 0),
      up: h.up > 0,
      down: h.down > 0,
      atk: h.atk > 0,
      spc: h.spc > 0,
      grd: h.grd > 0,
      taunt: h.taunt > 0,
    };
    const p = this.prev;
    const frame: InputFrame = {
      ...pad,
      upP: pad.up && !p.up,
      downP: pad.down && !p.down,
      atkP: pad.atk && !p.atk,
      spcP: pad.spc && !p.spc,
      grdP: pad.grd && !p.grd,
      tauntP: pad.taunt && !p.taunt,
    };
    this.prev = pad;
    return frame;
  }

  /** Picks one of the three specials for the situation and presses the right combination for it. */
  private special(me: Fighter, foe: Fighter, toFoe: number, adx: number, dy: number): void {
    const level = Math.abs(dy) < 1.5;
    const roll = this.rand();
    let which: 'neutral' | 'side' | 'down' = 'neutral';
    switch (me.el.id) {
      case 'fire':
        if (level && adx < 4.2 && roll < 0.6) which = 'side';
        else if (me.ground && adx > 5 && roll < 0.3) which = 'down';
        break;
      case 'water':
        if (me.damage > 45 && adx > 8) which = 'down';
        else if (level && adx > 2.5 && adx < 7 && roll < 0.5) which = 'side';
        break;
      case 'earth':
        if (level && foe.ground && adx < 7 && roll < 0.35) which = 'down';
        else if (level && adx > 2.5 && adx < 7 && roll < 0.3) which = 'side';
        break;
      case 'air':
        if (level && adx < 5.5 && roll < 0.5) which = 'side';
        break;
      case 'lightning':
        if (foe.ground && adx > 3 && roll < 0.4) which = 'down';
        else if (adx > 4 && roll < 0.65) which = 'side';
        break;
      case 'metal':
        if (level && adx < 3 && roll < 0.6) which = 'side';
        else if (me.armorT <= 0 && adx < 6 && roll < 0.8) which = 'down';
        break;
      case 'shadow':
        // Swap is saved for emergencies (see the recovery logic); day to day it is decoys and sinking.
        which = me.ground && adx < 5 && roll < 0.45 ? 'down' : 'side';
        break;
      case 'void':
        if (level && adx < 6 && roll < 0.4) which = 'side';
        else if (adx > 2 && adx < 7.5 && roll < 0.8) which = 'down';
        break;
      case 'cash':
        // Midas needs to be in arm's reach; the car and the trap work from further out.
        if (level && adx < 2 && roll < 0.6) which = 'neutral';
        else if (level && adx > 2.5 && adx < 9 && roll < 0.55) which = 'side';
        else which = 'down';
        break;
      case 'tyler':
        // The piano only when they are right there; otherwise keep a gremlin out.
        if (level && adx < 3.8 && roll < 0.7) which = 'side';
        else if (roll < 0.55) which = 'down';
        break;
    }
    if (which === 'side') {
      this.face(toFoe);
      this.tap('spc');
    } else if (which === 'down') {
      this.hold.down = 0.12;
      this.tap('spc');
    } else if (me.facing !== toFoe) {
      // The neutral special needs no direction held, so turn first and fire on the next thought.
      this.face(toFoe);
    } else {
      this.hold.left = this.hold.right = 0;
      this.moveDir = 0;
      this.tap('spc');
    }
  }

  private think(g: Game, me: Fighter, foe: Fighter): void {
    if (me.state === 'dead' || me.state === 'ult' || me.state === 'climb') return;
    const main = g.stage.main;
    const edge = main.w / 2;
    const dx = foe.x - me.x;
    const dy = foe.y - me.y;
    const adx = Math.abs(dx);
    const toFoe = dx >= 0 ? 1 : -1;
    const r = () => this.rand();

    // Hanging from the lip: get up one way or another, not always the same.
    if (me.state === 'ledge') {
      if (me.stateT < 0.25 + 0.3 * (1 - this.skill)) return;
      const roll = r();
      const near = adx < 3.5 && Math.abs(dy) < 2.5;
      if (near && roll < 0.4) this.tap('atk');
      else if (roll < 0.55) this.tap('grd');
      else if (roll < 0.75) this.tap('up', 0.2);
      else this.moveDir = -me.ledgeSide;
      return;
    }

    // 1. Getting back to the stage beats everything else.
    const offstage = !me.ground && (Math.abs(me.x) > edge - 0.2 || me.y < -0.2);
    if (offstage) {
      const home = me.x > 0 ? -1 : 1;
      const underStage = Math.abs(me.x) < edge + HW + 0.3 && me.y + HEIGHT < main.y - main.thick + 0.4;
      this.moveDir = underStage ? -home : home;
      const needHeight = me.y < 1.2 || Math.abs(me.x) > edge + 4;
      if (needHeight && me.vy < 4 && me.state === 'free') {
        if (me.airJumps > 0) this.tap('up', 0.3);
        else if (me.el.id === 'shadow' && me.spcCd <= 0 && foe.ground && foe.state !== 'shield' && me.y < -2 && this.rand() < this.skill) {
          // Falling with them safe on stage: trade places.
          this.hold.left = this.hold.right = 0;
          this.moveDir = 0;
          this.tap('spc');
        } else if (!me.recoveryUsed) {
          this.hold.up = 0.14;
          this.tap('spc');
        } else if (me.el.id === 'air' && me.spcCd <= 0 && me.y < 0) {
          // Out of jumps: an airbender can still ride an updraft back.
          this.hold.down = 0.12;
          this.tap('spc');
        } else if (me.airDash && me.dashCd <= 0 && me.y > -1.5) this.tap('grd');
      }
      return;
    }

    if (foe.state === 'dead' || g.winner >= 0) {
      // Nothing to fight: rub it in.
      if (me.ground && me.state === 'free' && me.tauntCd <= 0 && r() < 0.5 * this.skill) {
        const pick = r();
        if (pick < 0.35) this.hold.down = 0.12;
        else if (pick < 0.65) this.hold[me.x > 0 ? 'left' : 'right'] = 0.12;
        this.tap('taunt');
      } else if (Math.abs(me.x) > 3 && me.state !== 'taunt') this.moveDir = me.x > 0 ? -1 : 1;
      return;
    }

    // 2. Get out of the way of an ultimate. Each element needs a different answer.
    if (foe.state === 'ult' && r() < 0.35 + 0.65 * this.skill) {
      const ahead = (me.x - foe.x) * foe.facing > 0;
      switch (foe.el.id) {
        case 'fire':
          if (ahead && Math.abs(dy) < 2.4) this.tap('up', 0.3);
          break;
        case 'water':
          // Get above the wave, or dash through it if grounded with a dash ready.
          if (ahead) {
            if (me.ground && me.dashCd <= 0 && adx < 6) {
              this.face(-foe.facing);
              this.tap('grd');
            } else this.tap('up', 0.3);
          }
          break;
        case 'earth':
          if (ahead) this.tap('up', 0.3);
          break;
        case 'air':
          this.moveDir = -toFoe;
          if (me.dashCd <= 0 && adx < 7) this.tap('grd');
          break;
      }
      return;
    }

    // 3. React to incoming shots.
    for (const p of g.projectiles) {
      if (p.owner === me.id || p.dead) continue;
      const rel = p.x - me.x;
      const closing = rel * p.vx < 0;
      if (closing && Math.abs(rel) < 4.5 && Math.abs(p.y - (me.y + 0.9)) < 1.7 && r() < 0.6 * this.skill) {
        if (me.ground && me.shieldCd <= 0 && r() < 0.65) this.hold.grd = 0.28;
        else if (me.ground) this.tap('up', 0.25);
        return;
      }
    }

    const ready = me.state === 'free';
    if (ready && r() < 0.35 + 0.6 * this.skill) {
      // 4. Ultimate when lined up.
      if (me.meter >= 100 && Math.abs(dy) < 1.2 && adx > 1.2 && adx < 15 && foe.invuln <= 0) {
        this.face(toFoe);
        this.hold.atk = 0.1;
        this.hold.spc = 0.1;
        return;
      }
      // 5. Close-range options.
      if (dy > 1.0 && dy < 3.6 && adx < 1.8) {
        this.hold.up = 0.12;
        this.tap('atk');
        return;
      }
      if (!me.ground && dy < -1.5 && adx < 1.0 && Math.abs(me.x) < edge - 1.5) {
        this.hold.down = 0.12;
        this.tap('atk');
        return;
      }
      if (me.ground && adx < 2.3 && Math.abs(dy) < 1.0) {
        if (me.spcCd <= 0 && r() < 0.45) {
          this.special(me, foe, toFoe, adx, dy);
        } else if (me.ground.solid && r() < 0.6) {
          this.hold.down = 0.12;
          this.tap('atk');
        } else {
          this.face(toFoe);
          this.tap('atk');
        }
        return;
      }
      // 6. Signature move, then poke with bolts.
      const tall = me.el.id === 'earth' ? 5 : 1.8;
      if (me.spcCd <= 0 && adx < Math.max(me.el.specialRange, 8) && Math.abs(dy) < tall && r() < 0.5) {
        this.special(me, foe, toFoe, adx, dy);
        return;
      }
      // Shots come in bursts: with none left, close in for strikes instead of standing there.
      if (Math.abs(dy) < 1.5 && adx < 17 && (me.ammo >= 1 || adx < 1.8) && r() < 0.65) {
        this.face(toFoe);
        this.tap('atk');
        return;
      }
      if (me.ammo < 1 && adx > 2) {
        this.moveDir = toFoe;
        return;
      }
    }

    // 7. Spacing.
    const want = me.el.botRange;
    if (adx > want + 1.5 || Math.abs(dy) > 2) this.moveDir = adx > 0.6 ? toFoe : 0;
    else if (adx < want - 2.5 && r() < 0.5) this.moveDir = -toFoe;
    // Only climb after them when close enough for it to matter; otherwise hold the ground.
    if (dy > 1.6 && adx < 5 && r() < 0.28 && (me.ground || (me.airJumps > 0 && me.vy < 0))) this.tap('up', 0.3);
    if (dy < -1.6 && me.ground && !me.ground.solid && r() < 0.45) this.tap('down');

    // Don't walk or drift off the stage.
    if (this.moveDir !== 0 && Math.abs(me.x + this.moveDir * 1.4) > edge - 0.5 && Math.sign(me.x) === this.moveDir) {
      this.moveDir = me.ground ? 0 : -this.moveDir;
    }
  }
}
