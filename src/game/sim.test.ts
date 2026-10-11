import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bot } from './bot';
import { ELEMENT_IDS } from './elements';
import { DT, Game, HEIGHT, START_STOCKS, type Fighter } from './sim';
import { STAGES, STAGE_IDS } from './stage';

const BLAST = STAGES.temple.blast;
import { NO_INPUT, type ElementId, type InputFrame } from './types';

const press = (over: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...over });

function run(g: Game, seconds: number, i0: () => InputFrame = () => NO_INPUT, i1: () => InputFrame = () => NO_INPUT): void {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    g.step(i0(), i1());
    g.events.length = 0;
  }
}

function assertSane(g: Game): void {
  for (const f of g.fighters) {
    for (const v of [f.x, f.y, f.vx, f.vy, f.damage, f.meter, f.shieldHp]) assert.ok(Number.isFinite(v), 'fighter state went non-finite');
  }
  for (const p of g.projectiles) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'projectile went non-finite');
  assert.ok(g.projectiles.length < 40, 'projectiles are leaking');
  assert.ok(g.pillars.length < 40, 'pillars are leaking');
}

test('fighters start grounded and stay put with no input', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'] });
  run(g, 1);
  for (const f of g.fighters) {
    assert.equal(f.ground, g.stage.main);
    assert.equal(f.y, 0);
    assert.equal(f.state, 'free');
  }
});

test('inputs are ignored during the countdown', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'], intro: true });
  run(g, 1, () => press({ right: true }));
  assert.equal(g.fighters[0].x, -5);
  run(g, 3, () => press({ right: true }));
  assert.ok(g.fighters[0].x > -5);
});

test('a full jump reaches the side platforms for every element', () => {
  for (const el of ELEMENT_IDS) {
    const g = new Game({ still: true, elements: [el, 'fire'] });
    const f = g.fighters[0];
    let peak = 0;
    let first = true;
    run(g, 1.2, () => {
      const i = press({ up: true, upP: first });
      first = false;
      peak = Math.max(peak, f.y);
      return i;
    });
    assert.ok(peak > 2.9 + 0.1, `${el} peaks at ${peak.toFixed(2)}`);
  }
});

test('walking off the edge and falling costs a stock, then respawns', () => {
  const g = new Game({ still: true, elements: ['earth', 'water'] });
  const f = g.fighters[0];
  run(g, 2.4, () => press({ left: true }));
  assert.equal(f.stocks, START_STOCKS - 1);
  assert.equal(f.state, 'dead');
  run(g, 2);
  assert.notEqual(f.state, 'dead');
  assert.equal(f.damage, 0);
  run(g, 3);
  assert.ok(f.ground, 'respawned fighter should have landed');
});

test('the stage is solid from the side and from below', () => {
  const g = new Game({ still: true, elements: ['air', 'water'] });
  const f = g.fighters[0];
  f.ground = null;
  f.x = -13;
  f.y = -1.5;
  run(g, 0.2, () => press({ right: true }));
  assert.ok(f.x <= -11 - 0.4, `pushed through the side wall: x=${f.x}`);
  f.x = 0;
  f.y = -6;
  f.vy = 30;
  f.vx = 0;
  run(g, 0.2);
  assert.ok(f.y + HEIGHT <= -g.stage.main.thick + 1e-6, `passed through the underside: y=${f.y}`);
});

test('bolts hit, deal damage, and knock back harder at high damage', () => {
  const launch = (pre: number) => {
    const g = new Game({ still: true, elements: ['fire', 'water'] });
    const [a, b] = g.fighters;
    a.x = -2;
    b.x = 2;
    b.damage = pre;
    let first = true;
    let peak = 0;
    run(g, 0.6, () => {
      const i = press({ atk: first, atkP: first });
      first = false;
      peak = Math.max(peak, Math.abs(b.vx));
      return i;
    });
    assert.ok(b.damage > pre, 'bolt should have landed');
    return peak;
  };
  assert.ok(launch(120) > launch(0) * 1.5);
});

test('shield blocks damage and breaks under sustained fire', () => {
  const g = new Game({ still: true, elements: ['earth', 'water'] });
  const [a, b] = g.fighters;
  a.x = -3;
  b.x = 3;
  let n = 0;
  let broke = false;
  run(
    g,
    6,
    () => {
      n++;
      const tapNow = n % 70 === 0;
      return press({ atk: tapNow, atkP: tapNow });
    },
    () => {
      if (b.state === 'stunned') broke = true;
      return press({ grd: true, grdP: n === 1 });
    },
  );
  assert.ok(broke, 'shield should eventually break');
});

test('ultimate freezes the world, then hits everything in its lane', () => {
  const g = new Game({ still: true, elements: ['fire', 'earth'] });
  const [a, b] = g.fighters;
  a.x = -4;
  b.x = 4;
  a.meter = 100;
  let first = true;
  run(g, 0.3, () => {
    const i = press({ atk: true, spc: true, atkP: first, spcP: first });
    first = false;
    return i;
  });
  assert.equal(a.state, 'ult');
  assert.equal(b.damage, 0);
  assert.equal(a.meter, 0);
  run(g, 3);
  assert.ok(b.damage > 25, `ultimate did ${b.damage}`);
  assert.equal(a.state, 'free');
});

test('ultimate still fires when the second key lands mid-attack', () => {
  const g = new Game({ still: true, elements: ['earth', 'water'] });
  const a = g.fighters[0];
  a.meter = 100;
  let n = 0;
  // Attack first; Special arrives 0.2s later, after the cancel window but while the bolt is still recovering.
  run(g, 1, () => {
    n++;
    const spcStep = Math.round(0.2 / DT);
    return press({ atk: true, atkP: n === 1, spc: n >= spcStep, spcP: n === spcStep });
  });
  assert.equal(a.state, 'ult');
});

test('every special connects on a standing opponent', () => {
  for (const el of ELEMENT_IDS) {
    const g = new Game({ still: true, elements: [el, 'fire'] });
    const [a, b] = g.fighters;
    a.x = -2;
    b.x = 2;
    let first = true;
    run(g, 2.5, () => {
      const i = press({ spc: first, spcP: first });
      first = false;
      return i;
    });
    // Swap, Portal and Deep Fry are not attacks; Midas Touch cannot reach this far; Blink Strike is one lighter hit.
    const want = el === 'shadow' ? 4 : el === 'void' || el === 'tyler' || el === 'cash' ? 0 : el === 'lightning' ? 8 : 10;
    assert.ok(b.damage >= want, `${el} special did ${b.damage}`);
    assertSane(g);
  }
});

/** Lowest damage % at which `setup` + one attack from `a` kills a bot-controlled `b` that tries to recover. */
function koPercent(elA: ElementId, elB: ElementId, bx: number, input: Partial<InputFrame>, ax = bx - 2): number {
  for (let pct = 0; pct <= 300; pct += 10) {
    const g = new Game({ still: true, elements: [elA, elB], seed: 3 });
    const [a, b] = g.fighters;
    a.x = ax;
    b.x = bx;
    b.damage = pct;
    const bot = new Bot(11, 1);
    let first = true;
    for (let i = 0; i < 5 / DT; i++) {
      const i0 = press(first ? input : {});
      first = false;
      // The victim only tries to get back, it never fights.
      const i1 = b.ground ? NO_INPUT : bot.sample(g, 1);
      g.step(i0, { ...i1, atk: false, atkP: false, spc: i1.up && i1.spc, spcP: i1.up && i1.spcP });
      g.events.length = 0;
      if (b.stocks < START_STOCKS) return pct;
    }
  }
  return Infinity;
}

test('kill percents sit in a Smash-like range', () => {
  const rows: string[] = [];
  const checks: (() => void)[] = [];
  // Swap and Portal have no knockback at all, so only the six launching specials are held to the range.
  for (const el of ELEMENT_IDS.filter((e) => e !== 'shadow' && e !== 'void' && e !== 'tyler' && e !== 'cash')) {
    const bolt = koPercent(el, 'water', 0, { atk: true, atkP: true });
    const boltEdge = koPercent(el, 'water', 9.5, { atk: true, atkP: true });
    const spc = koPercent(el, 'water', 0, { spc: true, spcP: true });
    const spcEdge = koPercent(el, 'water', 9.5, { spc: true, spcP: true });
    const sweep = koPercent(el, 'water', 0, { down: true, atk: true, atkP: true }, -1.4);
    rows.push(`${el.padEnd(6)} bolt ${bolt}/${boltEdge}  special ${spc}/${spcEdge}  sweep ${sweep}`);
    checks.push(() => {
      assert.ok(spc >= 60 && spc <= 220, `${el} special kills at ${spc}% from centre`);
      assert.ok(spcEdge <= spc, `${el} special should not kill later at the edge`);
      assert.ok(bolt >= 120, `${el} bolt kills too early (${bolt}%)`);
    });
  }
  console.log('KO % (centre/edge) vs Tide:\n' + rows.join('\n'));
  for (const c of checks) c();
});

test('bot vs bot matches finish for every pairing without the state going bad', () => {
  const lines: string[] = [];
  let seed = 100;
  for (let i = 0; i < ELEMENT_IDS.length; i++) {
    for (let j = i; j < ELEMENT_IDS.length; j++) {
      const els: [ElementId, ElementId] = [ELEMENT_IDS[i], ELEMENT_IDS[j]];
      const g = new Game({ elements: els, seed: seed++, intro: true, stage: STAGE_IDS[seed % STAGE_IDS.length] });
      const bots = [new Bot(seed * 3 + 1), new Bot(seed * 7 + 5)];
      const limit = 300 / DT;
      let steps = 0;
      const seen = new Set<string>();
      while (g.winner < 0 && steps < limit) {
        g.step(bots[0].sample(g, 0), bots[1].sample(g, 1));
        for (const e of g.events) seen.add(e.type);
        g.events.length = 0;
        if (steps % 600 === 0) assertSane(g);
        for (const f of g.fighters as Fighter[]) {
          assert.ok(f.y > BLAST.bottom - 2 && Math.abs(f.x) < BLAST.right + 2, 'fighter escaped the blast zone alive');
        }
        steps++;
      }
      assertSane(g);
      const [a, b] = g.fighters;
      lines.push(
        `${els[0]} vs ${els[1]}: ${g.winner < 0 ? 'TIMEOUT' : 'P' + (g.winner + 1)} in ${(steps * DT).toFixed(0)}s, stocks ${a.stocks}-${b.stocks}, dealt ${a.dealt.toFixed(0)}/${b.dealt.toFixed(0)}, events ${seen.size}`,
      );
      assert.ok(g.winner >= 0, `${els.join(' vs ')} never finished`);
      assert.ok(seen.has('hit') && seen.has('ko') && seen.has('shoot'), 'expected core events');
    }
  }
  console.log(lines.join('\n'));
});

test('random button mashing from both players never breaks the sim', () => {
  let seed = 12345;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const KEYS = ['left', 'right', 'up', 'down', 'atk', 'spc', 'grd'] as const;
  const masher = () => {
    const held: Record<string, boolean> = {};
    return (): InputFrame => {
      const f: Record<string, boolean> = { ...NO_INPUT };
      for (const k of KEYS) {
        const was = !!held[k];
        if (rnd() < 0.04) held[k] = !was;
        f[k] = !!held[k];
        if (k !== 'left' && k !== 'right') f[k + 'P'] = !!held[k] && !was;
      }
      return f as unknown as InputFrame;
    };
  };
  let kos = 0;
  for (let game = 0; game < 24; game++) {
    const els: [ElementId, ElementId] = [ELEMENT_IDS[game % 10], ELEMENT_IDS[(game * 3 + 1) % 10]];
    const g = new Game({ still: true, elements: els, seed: game + 1 });
    const a = masher();
    const b = masher();
    for (let i = 0; i < 90 / DT && g.overT < 2; i++) {
      // Keep both meters topping up so ultimates get mashed out too.
      if (i % 2400 === 0) g.fighters[game % 2].meter = 100;
      g.step(a(), b());
      g.events.length = 0;
      if (i % 240 === 0) assertSane(g);
    }
    assertSane(g);
    kos += g.fighters[0].kos + g.fighters[1].kos;
  }
  assert.ok(kos > 10, `mashing should produce KOs (got ${kos})`);
});

test('every element\'s ultimate hurts a standing opponent and ends cleanly', () => {
  for (const el of ELEMENT_IDS) {
    const g = new Game({ still: true, elements: [el, 'fire'] });
    const [a, b] = g.fighters;
    a.x = -3;
    b.x = 3;
    a.meter = 100;
    let first = true;
    run(g, 5, () => {
      const i = press({ atk: first, spc: first, atkP: first, spcP: first });
      first = false;
      return i;
    });
    // Thunderstorm has to chase a launched target, and Nightmare is a slow burn rather than a hit.
    const want = el === 'lightning' ? 8 : el === 'shadow' ? 15 : el === 'tyler' ? 9 : 25;
    assert.ok(b.damage >= want || b.stocks < START_STOCKS, `${el} ultimate did ${b.damage}`);
    assert.notEqual(a.state, 'ult');
    assert.ok(a.invuln <= 0, 'caster should be vulnerable again');
    assertSane(g);
  }
});

test('a shield raised just in time parries: shots bounce back, strikes stagger', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'] });
  const [a, b] = g.fighters;
  a.x = -4;
  b.x = 4;
  let n = 0;
  let reflected = false;
  run(
    g,
    1.2,
    () => {
      n++;
      return press({ atk: n === 1, atkP: n === 1 });
    },
    () => {
      if (g.projectiles.some((p) => p.owner === 1)) reflected = true;
      // Raise the shield only once the fireball is about to land.
      const close = g.projectiles.some((p) => p.owner === 0 && b.x - p.x < 1.6);
      return press({ grd: close, grdP: close && b.state !== 'shield' });
    },
  );
  assert.ok(reflected, 'the fireball should have been turned around');
  assert.equal(b.damage, 0);
  assert.ok(a.damage > 0, 'the reflected shot should hit its sender');
});

test('point blank, an attack lands as a strike with no projectile', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'] });
  const [a, b] = g.fighters;
  a.x = -0.7;
  b.x = 0.7;
  let first = true;
  let shots = 0;
  run(g, 0.4, () => {
    for (const e of g.events) if (e.type === 'shoot') shots++;
    const i = press({ atk: first, atkP: first });
    first = false;
    return i;
  });
  assert.equal(shots, 0);
  assert.ok(b.damage > 8, `strike did ${b.damage}`);
});

test('holding up aims the shot upward; a quick up+attack is the rising strike', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'] });
  const a = g.fighters[0];
  let n = 0;
  run(g, 0.9, () => {
    n++;
    const late = n === Math.round(0.6 / DT);
    return press({ up: true, upP: n === 1, atk: late, atkP: late });
  });
  const shot = g.projectiles.find((p) => p.owner === 0);
  assert.ok(shot && shot.vy > 5, 'expected an upward shot');

  const g2 = new Game({ still: true, elements: ['fire', 'water'] });
  let m = 0;
  let rose = false;
  run(g2, 0.3, () => {
    m++;
    if (g2.fighters[0].move?.kind === 'rise') rose = true;
    return press({ up: true, upP: m === 1, atk: m === 3, atkP: m === 3 });
  });
  assert.ok(rose, 'expected a rising strike');
  assert.ok(a.y >= 0);
});

test('the lip can be caught, hung from, and climbed, jumped or dropped off', () => {
  const hang = () => {
    const g = new Game({ still: true, elements: ['earth', 'water'] });
    const f = g.fighters[0];
    f.ground = null;
    f.x = -11.9;
    f.y = -0.8;
    f.vy = 1;
    // Steer in until the lip is caught, then let go of the key (holding it would climb straight up).
    for (let i = 0; i < 0.4 / DT && f.state !== 'ledge'; i++) g.step(press({ right: true }), NO_INPUT);
    g.events.length = 0;
    assert.equal(f.state, 'ledge');
    assert.ok(f.invuln > 0, 'the first grab is safe');
    return { g, f };
  };
  // Holding toward the stage would climb at once, so let go of the key before testing each option.
  {
    const { g, f } = hang();
    run(g, 0.5);
    assert.equal(f.state, 'ledge', 'hangs until told otherwise');
    run(g, 0.6, () => press({ right: true }));
    assert.equal(f.ground, g.stage.main);
    assert.ok(f.x > -11, `climbed to ${f.x}`);
  }
  {
    const { g, f } = hang();
    let first = true;
    let peak = -9;
    run(g, 0.5, () => {
      peak = Math.max(peak, f.y);
      const i = press({ up: first, upP: first });
      first = false;
      return i;
    });
    assert.ok(peak > 0.5, `ledge jump should clear the stage (peak ${peak.toFixed(2)})`);
  }
  {
    const { g, f } = hang();
    run(g, 0.2);
    run(g, 0.4, () => press({ down: true }));
    assert.equal(f.state, 'free');
    assert.ok(f.y < -1.8, 'dropped');
  }
  {
    // Getup attack: climbs straight into a sweep that hits someone waiting at the edge.
    const { g, f } = hang();
    const foe = g.fighters[1];
    foe.x = -9.4;
    let first = true;
    run(g, 0.8, () => {
      const i = press({ atk: first, atkP: first });
      first = false;
      return i;
    });
    assert.equal(f.ground, g.stage.main);
    assert.ok(foe.damage > 0, 'getup attack should connect');
  }
  {
    // Ledge hogging: the second fighter cannot take an occupied lip.
    const { g } = hang();
    const b = g.fighters[1];
    b.ground = null;
    b.x = -11.9;
    b.y = -0.8;
    b.vy = 1;
    let took = false;
    run(g, 0.3, undefined, () => {
      if (b.state === 'ledge') took = true;
      return press({ right: true });
    });
    assert.ok(!took, 'an occupied ledge cannot be grabbed');
  }
});

test('low on the stage wall, one wall jump gets you back up to the lip', () => {
  const g = new Game({ still: true, elements: ['earth', 'water'] });
  const f = g.fighters[0];
  f.ground = null;
  f.x = -11.6;
  f.y = -2.4;
  f.vy = -4;
  f.airJumps = 0;
  let n = 0;
  let kicked = false;
  let caught = false;
  run(g, 1.4, () => {
    n++;
    if (f.vy > 10) kicked = true;
    if (f.state === 'ledge') caught = true;
    return press({ right: n !== 13, up: n === 12, upP: n === 12 });
  });
  assert.ok(kicked, 'expected a wall jump');
  assert.ok(caught || f.ground === g.stage.main, 'the kick should give enough height to reach the lip');
});

test('shots come in bursts: the magazine empties, then refills when you stop', () => {
  for (const el of ELEMENT_IDS) {
    const g = new Game({ still: true, elements: [el, 'fire'] });
    const [a, b] = g.fighters;
    a.x = -9;
    b.x = 9;
    b.invuln = 99;
    let shots = 0;
    let n = 0;
    // Mash attack for four seconds.
    run(g, 4, () => {
      n++;
      for (const e of g.events) if (e.type === 'shoot') shots++;
      const tap = n % 12 === 0;
      return press({ atk: tap, atkP: tap });
    });
    const sustained = Math.round((4 - 0.45) / a.el.reload) + a.el.ammo + 2;
    // A razor disc comes back and is caught, so metal alone can keep one in hand.
    if (el !== 'metal') assert.ok(a.ammo < 1, `${el} should be out of shots while mashing`);
    assert.ok(g.projectiles.length <= sustained, `${el} put out too many shots`);
    run(g, a.el.reload * a.el.ammo + 1);
    assert.equal(Math.round(a.ammo), a.el.ammo, `${el} should reload when idle`);
  }
});

test('the same move over and over hits weaker; a different move does not', () => {
  const g = new Game({ still: true, elements: ['earth', 'water'] });
  const [a, b] = g.fighters;
  const dealt: number[] = [];
  for (let i = 0; i < 5; i++) {
    const before = b.damage;
    b.pressure = 0;
    g.hit(0, b, { dmg: 10, base: 5, growth: 5, angle: 45, id: 'sweep' }, 1, 0, 0, 'earth');
    dealt.push(b.damage - before);
    b.setState('free');
  }
  assert.equal(dealt[0], 10);
  assert.ok(dealt[4] < dealt[0] * 0.75, `fifth repeat dealt ${dealt[4]}`);
  const before = b.damage;
  g.hit(0, b, { dmg: 10, base: 5, growth: 5, angle: 45, id: 'rise' }, 1, 0, 0, 'earth');
  assert.equal(b.damage - before, 10);
  assert.ok(a.stale.length > 0);
});

test('taking hit after hit, a fighter bursts free and cannot be hit for a moment', () => {
  const g = new Game({ still: true, elements: ['fire', 'water'] });
  const [a, b] = g.fighters;
  a.x = -1;
  b.x = 1;
  let n = 0;
  for (; n < 8 && b.invuln <= 0; n++) g.hit(0, b, { dmg: 3, base: 4, growth: 2, angle: 30 }, 1, 0, 0, 'fire');
  assert.equal(n, 5, 'burst on the fifth quick hit');
  assert.equal(g.hit(0, b, { dmg: 3, base: 4, growth: 2, angle: 30 }, 1, 0, 0, 'fire'), 0);
  assert.equal(a.state, 'hitstun', 'the attacker standing over them is thrown back');
});

test('every directional special does its job', () => {
  const cast = (el: ElementId, keys: Partial<InputFrame>, setup?: (g: Game) => void) => {
    const g = new Game({ still: true, elements: [el, 'fire'] });
    const [a, b] = g.fighters;
    a.x = -2;
    b.x = 1.5;
    setup?.(g);
    let first = true;
    return {
      g,
      a,
      b,
      go: (seconds: number) =>
        run(g, seconds, () => {
          const i = press({ ...keys, spc: first, spcP: first });
          first = false;
          return i;
        }),
    };
  };

  // Fire, side: Flame Stream roasts whatever stands in it.
  let t = cast('fire', { right: true });
  t.go(1.2);
  assert.ok(t.b.damage >= 10, `flame stream did ${t.b.damage}`);

  // Fire, down: the mine waits, then goes off when stepped on.
  t = cast('fire', { down: true }, (g) => (g.fighters[1].x = 8));
  t.go(1);
  assert.equal(t.g.mines.length, 1);
  assert.equal(t.b.damage, 0);
  t.b.x = t.g.mines[0].x;
  run(t.g, 0.2);
  assert.ok(t.b.damage >= 10, 'mine should have gone off');
  assert.equal(t.g.mines.length, 0);

  // Water, side: the whip drags a distant opponent in.
  t = cast('water', { right: true }, (g) => (g.fighters[1].x = 4));
  t.go(0.5);
  assert.ok(t.b.damage > 0 && t.b.x < 3, `whip should pull them in (x=${t.b.x.toFixed(1)})`);

  // Water, down: healing.
  t = cast('water', { down: true }, (g) => {
    g.fighters[0].damage = 50;
    g.fighters[1].x = 9;
  });
  t.go(1.2);
  assert.ok(t.a.damage < 42, `heal left ${t.a.damage}`);

  // Earth, side: the wall stops the opponent walking through and eats their shots.
  t = cast('earth', { right: true }, (g) => (g.fighters[1].x = 6));
  t.go(0.6);
  assert.equal(t.g.walls.length, 1);
  const wallX = t.g.walls[0].x;
  let k = 0;
  run(t.g, 1.2, undefined, () => {
    k++;
    return press({ left: true, atk: k === 5, atkP: k === 5 });
  });
  assert.ok(t.b.x > wallX, `opponent walked through the wall (x=${t.b.x.toFixed(1)})`);
  assert.equal(t.a.damage, 0, 'the wall should have eaten the shot');

  // Earth, down: tremors trip a grounded opponent but pass under a jumping one.
  t = cast('earth', { down: true }, (g) => (g.fighters[1].x = 3));
  t.go(1);
  assert.ok(t.b.damage >= 8, 'tremor should trip a grounded opponent');
  t = cast('earth', { down: true }, (g) => {
    g.fighters[1].x = 3;
    g.fighters[1].y = 3;
    g.fighters[1].ground = null;
    g.fighters[1].vy = 8;
  });
  t.go(0.6);
  assert.equal(t.b.damage, 0, 'tremor should miss an airborne opponent');

  // Air, side: barely any damage, a huge shove.
  t = cast('air', { right: true }, (g) => (g.fighters[1].x = 1));
  t.go(0.6);
  assert.ok(t.b.damage < 3 && t.b.x > 6, `gust should shove them away (x=${t.b.x.toFixed(1)})`);

  // Air, down: the updraft lifts whoever jumps into it.
  t = cast('air', { down: true }, (g) => (g.fighters[1].x = 9));
  t.go(0.5);
  assert.equal(t.g.updrafts.length, 1);
  let first = true;
  let peak = 0;
  run(t.g, 1.5, () => {
    peak = Math.max(peak, t.a.y);
    const i = press({ up: first, upP: first });
    first = false;
    return i;
  });
  assert.ok(peak > 7, `updraft should carry a jump far higher than normal (peak ${peak.toFixed(1)})`);
});

test('every arena plays to a finish with bots', () => {
  let seed = 900;
  for (const stage of STAGE_IDS) {
    for (let k = 0; k < 3; k++) {
      const els: [ElementId, ElementId] = [ELEMENT_IDS[(k * 2) % 4], ELEMENT_IDS[(k + 1) % 4]];
      const g = new Game({ elements: els, stage, seed: seed++ });
      const bots = [new Bot(seed * 3 + 1), new Bot(seed * 7 + 5)];
      let steps = 0;
      while (g.winner < 0 && steps < 300 / DT) {
        g.step(bots[0].sample(g, 0), bots[1].sample(g, 1));
        g.events.length = 0;
        steps++;
      }
      assertSane(g);
      assert.ok(g.winner >= 0, `${stage} ${els.join(' vs ')} never finished`);
    }
  }
});

/** A fresh match with the fighters placed, plus a helper that presses Special once with `keys` held. */
function duel(a: ElementId, ax: number, bx: number, b: ElementId = 'fire') {
  const g = new Game({ still: true, elements: [a, b] });
  const [p, q] = g.fighters;
  p.x = ax;
  q.x = bx;
  const tap = (button: 'atk' | 'spc', keys: Partial<InputFrame>, seconds: number) => {
    let first = true;
    run(g, seconds, () => {
      const i = press({ ...keys, [button]: first, [button + 'P']: first });
      first = false;
      return i;
    });
  };
  return { g, p, q, tap };
}

test('Volt: the arc is instant, the blink lands behind them, the orb zaps, the sky strikes', () => {
  let d = duel('lightning', -3, 2);
  d.tap('atk', {}, 0.12);
  assert.ok(d.q.damage > 0, 'the arc should hit the moment it fires');
  assert.equal(d.g.projectiles.length, 0, 'the arc is not a projectile');

  d = duel('lightning', -3, 2);
  d.tap('spc', {}, 0.19);
  assert.ok(d.p.x > d.q.x && d.p.facing === -1, `blink should land behind them (x=${d.p.x.toFixed(1)})`);
  run(d.g, 0.3);
  assert.ok(d.q.damage >= 8, 'and the strike should connect');

  d = duel('lightning', -3, -0.5);
  d.tap('spc', { right: true }, 1.4);
  assert.ok(d.q.damage >= 4.8, `ball lightning should tick more than once (${d.q.damage})`);

  d = duel('lightning', -5, 4);
  d.tap('spc', { down: true }, 0.6);
  assert.equal(d.q.damage, 0, 'storm call is telegraphed first');
  run(d.g, 0.5);
  assert.ok(d.q.damage >= 12, 'then it lands');
  // Under a platform is cover.
  d = duel('lightning', -9, 0);
  d.tap('spc', { down: true }, 1.2);
  assert.equal(d.q.damage, 0, 'the top platform should take the strike instead');
});

test('Flux: discs come back, the cable reels in, shrapnel is a shotgun, iron skin does not flinch, the tether finds the ledge', () => {
  let d = duel('metal', -9, 9);
  d.q.invuln = 99;
  d.tap('atk', {}, 0.3);
  const disc = d.g.projectiles[0];
  assert.ok(disc && disc.vx > 0);
  const before = d.p.ammo;
  run(d.g, 1.6);
  assert.equal(d.g.projectiles.length, 0, 'the disc should have come home');
  assert.ok(d.p.ammo > before, 'and been caught');

  d = duel('metal', -5, 1);
  d.tap('spc', {}, 0.6);
  assert.ok(d.p.x > -1 && d.q.damage >= 10, `magnet zip should close the gap and slam (x=${d.p.x.toFixed(1)}, dmg=${d.q.damage})`);

  d = duel('metal', -1.2, 0.2);
  d.tap('spc', { right: true }, 0.5);
  assert.ok(d.q.damage >= 11, `point-blank shrapnel did ${d.q.damage}`);
  d = duel('metal', -7, 3);
  d.tap('spc', { right: true }, 0.6);
  assert.equal(d.q.damage, 0, 'shrapnel should not reach across the stage');

  d = duel('metal', -2, 2);
  d.tap('spc', { down: true }, 0.3);
  assert.ok(d.p.armorT > 0);
  const res = d.g.hit(1, d.p, { dmg: 20, base: 30, growth: 30, angle: 45 }, -1, 0, 0, 'fire');
  assert.equal(res, 1);
  assert.equal(d.p.damage, 12, 'armoured hits are reduced');
  assert.notEqual(d.p.state, 'hitstun', 'and do not stun');
  assert.equal(d.p.vx, 0);

  d = duel('metal', 0, 5);
  d.p.ground = null;
  d.p.x = -16;
  d.p.y = -6;
  d.p.airJumps = 0;
  d.tap('spc', { up: true }, 0.8);
  assert.equal(d.p.state, 'ledge', 'the tether should reel in to a ledge hang');
});

test('Umbra: shades pass walls, the swap trades places, the decoy bursts, sinking is safe, nightmare reverses controls', () => {
  // A stone wall stops a fireball but not a shade.
  let d = duel('shadow', -6, 2, 'earth');
  d.g.walls.push({ uid: 99, owner: 1, x: -2, y: 0, t: 1, hp: 26, hit: true });
  d.tap('atk', {}, 2.4);
  assert.ok(d.q.damage > 0, 'the shade should have gone through the wall and found them');
  assert.equal(d.g.walls[0].hp, 26);

  d = duel('shadow', -7, 6);
  d.tap('spc', {}, 0.3);
  assert.ok(d.p.x > 5 && d.q.x < -6, `positions should be traded (${d.p.x.toFixed(1)}, ${d.q.x.toFixed(1)})`);
  // The clutch use: falling to your death, swap with someone standing safely on stage.
  d = duel('shadow', 0, 4);
  d.p.ground = null;
  d.p.x = -20;
  d.p.y = -9;
  d.tap('spc', {}, 0.3);
  assert.equal(d.p.ground, d.g.stage.main);
  assert.ok(d.q.y < -8, 'and they are the one falling now');

  d = duel('shadow', -4, 2);
  d.tap('spc', { right: true }, 1.2);
  assert.ok(d.q.damage >= 9, `decoy did ${d.q.damage}`);

  d = duel('shadow', -2, 2);
  d.tap('spc', { down: true }, 0.4);
  assert.ok(d.p.sunk());
  assert.equal(d.g.hit(1, d.p, { dmg: 9, base: 9, growth: 9, angle: 45 }, -1, 0, 0, 'fire'), 0, 'nothing can touch a sunk fighter');

  d = duel('shadow', -4, 4);
  d.p.meter = 100;
  let first = true;
  run(d.g, 1.6, () => {
    const i = press({ atk: first, spc: first, atkP: first, spcP: first });
    first = false;
    return i;
  });
  assert.ok(d.q.confuseT > 0);
  const x0 = d.q.x;
  const dmg0 = d.q.damage;
  run(d.g, 1, undefined, () => press({ right: true }));
  assert.ok(d.q.x < x0, 'holding right should walk them left');
  assert.ok(d.q.damage > dmg0, 'and the curse should be hurting');
});

test('Rift: gravitons knock toward the shooter, portals carry fighters and shots, gravity flips, the singularity drags and pops', () => {
  let d = duel('void', -4, 2);
  d.tap('atk', {}, 0.7);
  assert.ok(d.q.damage > 0 && d.q.x < 2, `a graviton should knock them toward the shooter (x=${d.q.x.toFixed(1)})`);

  d = duel('void', -6, 9);
  d.q.invuln = 99;
  d.tap('spc', {}, 0.5);
  assert.equal(d.g.portals.length, 1);
  const far = d.g.portals[0].bx;
  assert.ok(Math.abs(far - 3) < 0.01);
  // Step out and back in: out the other side.
  run(d.g, 0.5, () => press({ left: true }));
  let jumped = false;
  run(d.g, 0.6, () => {
    if (d.p.x > 2) jumped = true;
    return press({ right: true });
  });
  assert.ok(jumped, `walking into the near mouth should come out of the far one (x=${d.p.x.toFixed(1)})`);
  // Shots take the same route.
  d = duel('void', -6, 9, 'fire');
  d.q.invuln = 99;
  d.tap('spc', {}, 0.5);
  d.q.x = -10;
  d.q.facing = 1;
  let n = 0;
  let through = false;
  run(d.g, 0.6, undefined, () => {
    n++;
    if (d.g.projectiles.some((p) => p.owner === 1 && p.x > 2)) through = true;
    return press({ atk: n === 1, atkP: n === 1 });
  });
  assert.ok(through, 'a fireball entering one mouth should leave by the other');

  d = duel('void', -3, 0);
  d.tap('spc', { right: true }, 0.9);
  assert.ok(d.q.y > 3, `a flipped fighter should be falling upward (y=${d.q.y.toFixed(1)})`);
  run(d.g, 3);
  assert.ok(d.q.ground, 'and come back down afterwards');

  d = duel('void', -6, 2.5);
  d.tap('spc', { down: true }, 1.2);
  assert.ok(d.q.x < 1, `the singularity should be dragging them in (x=${d.q.x.toFixed(1)})`);
  run(d.g, 1.2);
  assert.ok(d.q.damage >= 11, `then burst (${d.q.damage})`);
});

test('a finished taunt pays Spirit; a cancelled or interrupted one does not', () => {
  const taunt = (keys: Partial<InputFrame>, seconds: number, then?: Partial<InputFrame>) => {
    const g = new Game({ still: true, elements: ['fire', 'water'] });
    const a = g.fighters[0];
    let n = 0;
    run(g, seconds, () => {
      n++;
      if (n === 1) return press({ ...keys, taunt: true, tauntP: true });
      return then && n === Math.round(0.6 / DT) ? press(then) : NO_INPUT;
    });
    return { g, a };
  };
  let t = taunt({}, 0.5);
  assert.equal(t.a.state, 'taunt');
  assert.equal(t.a.tauntKind, 0);
  assert.equal(taunt({ down: true }, 0.2).a.tauntKind, 2);
  assert.equal(taunt({ right: true }, 0.2).a.tauntKind, 1);

  t = taunt({}, 1.5);
  assert.equal(t.a.state, 'free');
  assert.equal(t.a.meter, 12);

  t = taunt({}, 1.5, { up: true, upP: true });
  assert.equal(t.a.meter, 0, 'bailing out early earns nothing');

  t = taunt({}, 0.5);
  t.g.hit(1, t.a, { dmg: 5, base: 8, growth: 5, angle: 40 }, -1, 0, 0, 'water');
  run(t.g, 1.5);
  assert.ok(t.a.meter < 12, 'getting hit out of it earns no taunt bonus');
});

test('Tyler: notes chip without interrupting, the fry cloud lags, the piano ends stocks, the gremlin nips and can be swatted, the storm dunks', () => {
  // A stream of wrong notes: damage, but the target keeps doing what it was doing.
  let d = duel('tyler', -4, 2);
  let n = 0;
  let notes = 0;
  run(d.g, 1.2, () => {
    n++;
    const tap = n % 14 === 0;
    return press({ atk: tap, atkP: tap });
  });
  notes = d.p.notes;
  assert.ok(notes >= 8, `expected a run of notes (${notes})`);
  assert.ok(d.q.damage > 5 && d.q.damage < 20, `notes should chip (${d.q.damage})`);
  assert.equal(d.q.state, 'free', 'notes never stun');

  // Deep Fry: a fighter inside the cloud only moves in bursts.
  d = duel('tyler', -6, 0);
  d.tap('spc', {}, 0.9);
  assert.ok(d.g.projectiles.some((p) => p.kind === 'fry'));
  assert.ok(d.q.lagT > 0, 'the cloud should have reached them');
  let frozen = 0;
  let last = d.q.x;
  run(d.g, 0.5, undefined, () => {
    if (d.q.x === last) frozen++;
    last = d.q.x;
    return press({ right: true });
  });
  assert.ok(frozen > 40, `a lagging fighter should stand still most steps (${frozen} of 60)`);
  assert.ok(d.q.x > 1, 'but still gets where they are going, in jumps');

  // Piano Toss: slow to start, short range, enormous.
  d = duel('tyler', -2, 1.5);
  d.q.damage = 60;
  d.tap('spc', { right: true }, 0.4);
  assert.equal(d.q.damage, 60, 'nothing happens during the spin');
  run(d.g, 3);
  assert.ok(d.q.stocks < START_STOCKS, 'a piano at 60% should be a KO');
  d = duel('tyler', -8, 4);
  d.tap('spc', { right: true }, 2);
  assert.equal(d.q.damage, 0, 'it does not travel far');

  // Gremlin: chases, nips, and dies to an attack.
  d = duel('tyler', -5, 3);
  d.tap('spc', { down: true }, 3);
  assert.ok(d.q.damage >= 4, `the gremlin should have got a few nips in (${d.q.damage})`);
  assert.equal(d.g.gremlins.length, 1);
  d.g.melee(d.q, d.p, d.g.gremlins[0].x, d.g.gremlins[0].y + 0.4, 1, { dmg: 12, base: 5, growth: 5, angle: 40 }, 1);
  run(d.g, 0.05);
  assert.equal(d.g.gremlins.length, 0, 'one solid hit swats it');

  // The storm: lots of small dunks, driven down and to the side.
  d = duel('tyler', -5, 2);
  d.p.meter = 100;
  let first = true;
  run(d.g, 4, () => {
    const i = press({ atk: first, spc: first, atkP: first, spcP: first });
    first = false;
    return i;
  });
  assert.ok(d.q.damage >= 9 || d.q.stocks < START_STOCKS, `storm did ${d.q.damage}`);
  assert.ok(d.q.x > 2 || d.q.stocks < START_STOCKS, 'and pushed them away from Tyler');
});

test('Kash: gold bars every fourth throw, Midas makes a statue, the car runs them down, cash on the floor trips, and Bust Down ends with a vault', () => {
  let d = duel('cash', -9, 9);
  d.q.invuln = 99;
  let n = 0;
  let gold = 0;
  run(d.g, 2.4, () => {
    n++;
    if (d.g.projectiles.some((p) => p.mode === 5)) gold++;
    const tap = n % 40 === 0;
    return press({ atk: tap, atkP: tap });
  });
  assert.ok(d.p.notes >= 4 && gold > 0, 'the fourth throw should be a gold bar');

  d = duel('cash', -1.2, 0.4);
  d.tap('spc', {}, 0.4);
  assert.ok(d.q.goldT > 0 && d.q.state === 'hitstun', 'Midas should leave a statue');
  const x = d.q.x;
  run(d.g, 0.6, undefined, () => press({ right: true }));
  assert.ok(Math.abs(d.q.x - x) < 0.3, 'a statue cannot walk');
  run(d.g, 1.2);
  assert.equal(d.q.goldT, 0);
  assert.equal(d.q.state, 'free');

  d = duel('cash', -6, 1);
  d.q.damage = 30;
  d.tap('spc', { right: true }, 1.1);
  assert.ok(d.q.damage >= 40, `the car should hit (${d.q.damage})`);
  assert.ok(d.p.x > 3, 'and keep going');

  d = duel('cash', -4, 4);
  d.tap('spc', { down: true }, 0.9);
  assert.equal(d.g.mines.length, 1);
  assert.ok(d.g.mines[0].cash);
  run(d.g, 1.4, undefined, () => press({ left: true }));
  assert.ok(d.q.damage > 0, 'walking over it should trip them');
  d = duel('cash', -4, 4);
  d.tap('spc', { down: true }, 0.9);
  run(d.g, 5.5);
  assert.equal(d.g.mines.length, 0, 'loose change does not lie around as long as an ember mine');

  d = duel('cash', -5, 3);
  d.p.meter = 100;
  d.q.damage = 40;
  let first = true;
  run(d.g, 1.6, () => {
    const i = press({ atk: first, spc: first, atkP: first, spcP: first });
    first = false;
    return i;
  });
  assert.equal(d.q.state, 'dance', 'they should be dancing');
  const held = d.q.x;
  run(d.g, 0.5, undefined, () => press({ right: true, atk: true, atkP: true }));
  assert.ok(Math.abs(d.q.x - held) < 0.5, 'and unable to do anything about it');
  run(d.g, 4);
  assert.ok(d.q.stocks < START_STOCKS, 'the vault at 40% should be a KO');
});

test('arenas move: platforms carry riders, ice slides, floors crumble, the conveyor pushes, the rift wraps and floats', () => {
  // A fighter standing on the temple's sliding top platform is carried with it.
  let g = new Game({ elements: ['fire', 'water'], stage: 'temple' });
  let f = g.fighters[0];
  const top = g.stage.platforms[3];
  run(g, 0.05);
  f.x = top.x;
  f.y = top.y;
  f.ground = top;
  const off = f.x - top.x;
  run(g, 3);
  assert.equal(f.ground, top);
  assert.ok(Math.abs(f.x - top.x - off) < 0.05, 'rider should stay put relative to the platform');
  assert.ok(Math.abs(top.x) > 0.5, 'and the platform should actually have gone somewhere');

  // Ice: letting go of the stick does not stop you.
  const slide = (stage: 'temple' | 'glacier') => {
    const gg = new Game({ elements: ['fire', 'water'], stage, seed: 5 });
    const ff = gg.fighters[0];
    ff.x = -4;
    run(gg, 0.6, () => press({ right: true }));
    const x0 = ff.x;
    run(gg, 0.5);
    return ff.x - x0;
  };
  assert.ok(slide('glacier') > slide('temple') * 3, 'ice should carry you much further after you let go');

  // The foundry: a crumbling platform drops whoever stands on it too long, then comes back.
  g = new Game({ elements: ['fire', 'water'], stage: 'foundry' });
  f = g.fighters[0];
  const weak = g.stage.platforms[1];
  f.x = weak.x;
  f.y = weak.y;
  f.ground = weak;
  g.fighters[1].x = 8;
  run(g, 1.1);
  assert.ok(weak.gone > 0 && f.ground !== weak, 'the platform should have given way');
  run(g, 3);
  assert.equal(weak.gone <= 0, true, 'and returned');
  // ...and its floor is a conveyor.
  g = new Game({ elements: ['fire', 'water'], stage: 'foundry' });
  const x0 = g.fighters[1].x;
  run(g, 1);
  assert.ok(Math.abs(g.fighters[1].x - x0) > 2, 'standing still on the conveyor should move you');

  // The rift: lighter gravity, and no side blast zones.
  const peak = (stage: 'temple' | 'rift') => {
    const gg = new Game({ elements: ['fire', 'water'], stage });
    const ff = gg.fighters[0];
    let first = true;
    let top2 = 0;
    run(gg, 2, () => {
      top2 = Math.max(top2, ff.y);
      const i = press({ upP: first, up: first });
      first = false;
      return i;
    });
    return top2;
  };
  assert.ok(peak('rift') > peak('temple') * 1.4, 'jumps should go much higher in low gravity');
  g = new Game({ elements: ['fire', 'water'], stage: 'rift' });
  f = g.fighters[0];
  f.ground = null;
  f.x = 23.5;
  f.y = 8;
  f.vx = 30;
  f.vy = 6;
  run(g, 0.2);
  assert.equal(f.stocks, START_STOCKS, 'flying out the side of the rift is not a KO');
  assert.ok(f.x < 0, 'it brings you back in on the other side');
});

test('arena hazards are telegraphed, hit whoever is there, and credit nobody', () => {
  for (const stage of ['glacier', 'crater', 'carousel', 'foundry'] as const) {
    const g = new Game({ elements: ['fire', 'water'], stage, seed: 3 });
    let warned = 0;
    let landed = 0;
    for (let i = 0; i < 20 / DT; i++) {
      g.step(NO_INPUT, NO_INPUT);
      for (const e of g.events) {
        if (e.type === 'stormWarn') warned++;
        if (e.type === 'stormHit') landed++;
      }
      g.events.length = 0;
      // Put the first fighter in the path of every strike just before it lands.
      for (const s of g.strikes) {
        if (s.done || s.t < s.delay - DT * 3) continue;
        const f = g.fighters[0];
        f.x = s.x;
        f.y = g.stage.main.y + 1;
        f.ground = null;
        f.vx = f.vy = 0;
        f.invuln = 0;
      }
    }
    assert.ok(warned >= 3 && landed >= 3, `${stage} should keep throwing hazards (${warned} warned, ${landed} landed)`);
    assert.ok(g.fighters[0].damage + g.fighters[1].damage > 0 || g.fighters[0].stocks + g.fighters[1].stocks < 6, `${stage} hazards should hurt`);
    assert.equal(g.fighters[0].dealt + g.fighters[1].dealt, 0, 'nobody gets credit for the arena');
    assert.equal(g.fighters[0].meter > 20 || g.fighters[1].meter > 20, false);
  }
});
