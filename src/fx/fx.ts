/**
 * Presentation-side effects director. The sim says *what happened* (events)
 * and *what exists* (fighters, projectiles); this module turns that into
 * particles, shockwave rings, camera shake, slow motion and sound.
 *
 * It is a module singleton on purpose: none of this is React state, and
 * nothing here may ever feed back into the sim.
 */
import * as THREE from 'three';
import { ELEMENT_IDS, ELEMENTS } from '../game/elements';
import { CRUSH_TIME, DANCE_TIME, DT, FRY_R, HORIZON_LIFE, PIANO_SPIN, STORM_TIME, TEMPEST_R, TEMPEST_TIME, TSUNAMI_R, ULT_BEAM, ULT_CHARGE, UPDRAFT_HALF, WALL_HEIGHT, WELL_LIFE, type Fighter, type Game } from '../game/sim';
import type { ElementId, GameEvent } from '../game/types';
import { audio } from './audio';
import { ParticleSystem } from './particles';

export const particles = new ParticleSystem(9000);

export interface Ring {
  x: number;
  y: number;
  t: number;
  dur: number;
  r0: number;
  r1: number;
  color: THREE.Color;
  intensity: number;
}

export interface KoBeam {
  x: number;
  y: number;
  angle: number;
  t: number;
  dur: number;
  color: THREE.Color;
}

/** A glowing mark left on the ground by a heavy impact. */
export interface Scorch {
  x: number;
  y: number;
  r: number;
  t: number;
  dur: number;
  color: THREE.Color;
}

/** Floating combat text, positioned in world space and drawn by the HUD. */
export interface Popup {
  x: number;
  y: number;
  text: string;
  t: number;
  dur: number;
  color: string;
  big: boolean;
  /** Drawn as a speech bubble (taunts) rather than floating combat text. */
  bubble: boolean;
}

export const fx = {
  /** Camera trauma 0-1; the rig squares it for the actual offset. */
  shake: 0,
  /** Full-screen flash 0-1, drawn by the HUD overlay. */
  flash: 0,
  flashColor: '#ffffff',
  /** Multiplier on sim time. Dips below 1 for KO slow motion. */
  timeScale: 1,
  slowT: 0,
  slowScale: 1,
  rings: [] as Ring[],
  koBeams: [] as KoBeam[],
  /** Attract mode: keep the visuals, drop the sound effects. */
  silent: false,
  /** A point the camera should keep in frame for `focusT` more seconds (the KO blast). */
  focusX: 0,
  focusY: 0,
  focusT: 0,
  /** 0-1, spikes on a launch hard enough to kill: drives the zoom punch, speed lines and colour fringing. */
  crit: 0,
  critX: 0,
  critY: 0,
  scorches: [] as Scorch[],
  popups: [] as Popup[],
  /** 0-1, how deep into Nightmare's darkness the screen is. */
  dark: 0,
  /** 0-1, how deep-fried the picture is (someone is standing in Tyler's cloud). */
  fry: 0,
  /** 0-1, how hard it is raining money (Kash's ultimate). */
  rain: 0,
  /** A taunting fighter the camera leans toward for `swagT` more seconds. */
  swagX: 0,
  swagY: 0,
  swagT: 0,
  /** The live scene camera, so the HUD can pin text to world positions. */
  camera: null as THREE.PerspectiveCamera | null,
};

const PAL = Object.fromEntries(ELEMENT_IDS.map((id) => [id, mkPal(id)])) as Record<ElementId, [THREE.Color, THREE.Color, THREE.Color]>;
const DUST = new THREE.Color('#8f8374');
const WHITE = new THREE.Color('#ffffff');
const STAR = new THREE.Color('#ffe98a');
const BROWN = new THREE.Color('#6b4423');
const STINK = new THREE.Color('#9acd32');
const BLACK_KEY = new THREE.Color('#2a2a30');

function mkPal(id: ElementId): [THREE.Color, THREE.Color, THREE.Color] {
  const p = ELEMENTS[id].particles;
  return [new THREE.Color(p[0]), new THREE.Color(p[1]), new THREE.Color(p[2])];
}

const rnd = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const pick = (el: ElementId) => PAL[el][Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2];

export function ring(x: number, y: number, r0: number, r1: number, dur: number, color: THREE.Color, intensity = 2): void {
  if (fx.rings.length > 24) fx.rings.shift();
  fx.rings.push({ x, y, t: 0, dur, r0, r1, color, intensity });
}

function scorch(x: number, y: number, r: number, color: THREE.Color, dur = 2.4): void {
  if (fx.scorches.length >= 10) fx.scorches.shift();
  fx.scorches.push({ x, y, r, t: 0, dur, color });
}

function popup(x: number, y: number, text: string, color: string, big = false): void {
  if (fx.popups.length >= 10) fx.popups.shift();
  fx.popups.push({ x: x + rnd(-0.3, 0.3), y, text, t: 0, dur: big ? 1.1 : 0.75, color, big, bubble: false });
}

const TAUNTS = [
  ['Too easy.', "Is that it?", "Warm-up's over?", 'Yawn.', 'Skill issue.', "I'm not even trying.", 'Nice try, though.', 'Call that bending?', 'You good?'],
  ['HA!', 'Look at you!', 'Did that hurt?', 'LOL', 'Again! Do it again!', 'Wow. Just wow.', 'Who taught you that?'],
  ["Wake me when you're ready.", 'Zzz...', "I'll wait.", 'Take your time.', 'Comfy.', 'No rush.', 'Five more minutes.'],
];
const TAUNTS_OVER_GRAVE = ['Bye!', 'See ya.', 'Mind the gap.', 'Have a nice fall.', 'gg ez', 'Bro fell off.', 'That looked like it hurt.'];

/** A jagged line of sparks from (x, y) for `len` along the unit vector (ux, uy). */
function arc(x: number, y: number, ux: number, uy: number, len: number, el: ElementId, density = 12, jitter = 0.28): void {
  const n = Math.max(4, Math.round(len * density));
  let off = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    // A random walk across the line, pinned at both ends, reads as a lightning fork.
    off = (off + rnd(-jitter, jitter)) * 0.82;
    const k = Math.sin(u * Math.PI);
    particles.spawn(x + ux * len * u - uy * off * k, y + uy * len * u + ux * off * k, rnd(-0.1, 0.1), rnd(-0.6, 0.6), rnd(-0.6, 0.6), 0, rnd(0.1, 0.24), rnd(0.16, 0.34), 0, pick(el), rnd(2.4, 4), 0, 0);
  }
}

function addShake(v: number): void {
  fx.shake = Math.min(1, Math.max(fx.shake, v) + v * 0.25);
}

function slow(scale: number, seconds: number): void {
  fx.slowScale = scale;
  fx.slowT = seconds;
}

/** Radial burst of element-coloured sparks. `dirX`/`dirY` bias the spray. */
function burst(
  x: number,
  y: number,
  el: ElementId,
  n: number,
  speed: number,
  size: number,
  life: number,
  dirX = 0,
  dirY = 0,
  gravity = 6,
): void {
  for (let i = 0; i < n; i++) {
    const a = rnd(Math.PI * 2);
    const s = speed * rnd(0.25, 1);
    particles.spawn(
      x + rnd(-0.15, 0.15),
      y + rnd(-0.15, 0.15),
      rnd(-0.3, 0.3),
      Math.cos(a) * s + dirX * speed * 0.7,
      Math.sin(a) * s + dirY * speed * 0.7,
      rnd(-1, 1) * s * 0.4,
      life * rnd(0.5, 1),
      size * rnd(0.6, 1.3),
      0,
      pick(el),
      rnd(1.6, 3.2),
      gravity,
      2.2,
    );
  }
}

function dust(x: number, y: number, n: number, speed: number): void {
  for (let i = 0; i < n; i++) {
    const d = Math.random() < 0.5 ? -1 : 1;
    particles.spawn(x, y + 0.05, rnd(-0.6, 0.6), d * speed * rnd(0.3, 1), rnd(0.3, 1.6), rnd(-1, 1), rnd(0.25, 0.55), rnd(0.25, 0.5), rnd(0.6, 1), DUST, 0.5, -0.5, 3);
  }
}

/** Events the score answers with a stinger, and whether the fighter it wants is the one in the event or their opponent. */
const CUES: Partial<Record<GameEvent['type'], { name: 'ko' | 'parry' | 'burst' | 'shieldBreak' | 'ultStart' | 'ultFire' | 'respawn' | 'hit'; other?: boolean }>> = {
  ko: { name: 'ko' },
  parry: { name: 'parry' },
  burst: { name: 'burst' },
  shieldBreak: { name: 'shieldBreak' },
  ultStart: { name: 'ultStart' },
  ultFire: { name: 'ultFire' },
  respawn: { name: 'respawn' },
  // The hit event names the victim; the score wants the attacker.
  hit: { name: 'hit', other: true },
};

export function handleEvent(e: GameEvent, g: Game): void {
  const el = e.el;
  const sound = !fx.silent;
  const cue = CUES[e.type];
  if (cue && sound) audio.cue(cue.name, (cue.other ? 1 - e.id : e.id) as 0 | 1, e.power);
  switch (e.type) {
    case 'jump':
      dust(e.x, e.y, 7, 3.5);
      if (sound) audio.jump();
      break;
    case 'airjump':
      ring(e.x, e.y + 0.1, 0.3, 1.5, 0.3, PAL[el][1], 1.6);
      burst(e.x, e.y, el, 14, 4, 0.22, 0.4, 0, -0.5, 0);
      if (sound) audio.airJump();
      break;
    case 'land':
      if (e.power > 6) dust(e.x, e.y, Math.min(16, 4 + e.power * 0.4), 2 + e.power * 0.12);
      if (sound && e.power > 6) audio.land(e.power);
      break;
    case 'bounce':
      dust(e.x, e.y, 18, 6);
      ring(e.x, e.y + 0.1, 0.4, 2.2, 0.3, WHITE, 1);
      addShake(0.22);
      if (sound) audio.land(e.power * 1.5);
      break;
    case 'dash':
      for (let i = 0; i < 16; i++) {
        particles.spawn(e.x, e.y + rnd(-0.8, 0.8), rnd(-0.3, 0.3), -e.dir * rnd(2, 9), rnd(-1, 1), 0, rnd(0.15, 0.35), rnd(0.15, 0.3), 0, pick(el), 2, 0, 3);
      }
      if (sound) audio.dash();
      break;
    case 'shoot':
      burst(e.x, e.y, el, e.power ? 26 : 9, e.power ? 7 : 4, 0.24, 0.3, e.dir * 0.6, 0, 2);
      if (e.power) ring(e.x, e.y, 0.4, 2.4, 0.35, PAL[el][1], 2);
      if (sound) audio.shoot(el, e.power > 0);
      break;
    case 'swing':
      if (e.power === 1) {
        // Rising strike: a crescent sweeping overhead.
        for (let i = 0; i < 22; i++) {
          const a = Math.PI * (0.1 + 0.8 * (i / 21));
          const cx = e.x + e.dir * 0.45;
          particles.spawn(cx - Math.cos(a) * 1.1 * e.dir, e.y + 0.3 + Math.sin(a) * 1.1, rnd(-0.2, 0.2), -Math.cos(a) * 3 * e.dir, 5 + Math.sin(a) * 4, 0, rnd(0.2, 0.4), rnd(0.25, 0.45), 0, pick(el), 2.6, 0, 3);
        }
      } else {
        for (const side of [-1, 1]) {
          for (let i = 0; i < 12; i++) {
            particles.spawn(e.x + side * rnd(0.5, 2.2), e.y - 0.3 + rnd(0.3), rnd(-0.5, 0.5), side * rnd(1, 5), rnd(3, 9), 0, rnd(0.2, 0.45), rnd(0.25, 0.45), 0, pick(el), 2.4, 14, 1);
          }
        }
      }
      if (sound) audio.swing();
      break;
    case 'special':
      burst(e.x, e.y, el, 18, 5, 0.26, 0.4);
      ring(e.x, e.y, 0.3, 1.8, 0.3, PAL[el][1], 2);
      break;
    case 'recover':
      for (let i = 0; i < 36; i++) {
        particles.spawn(e.x + rnd(-0.3, 0.3), e.y + rnd(0.6), rnd(-0.3, 0.3), rnd(-3, 3), rnd(-12, -3), rnd(-1, 1), rnd(0.25, 0.6), rnd(0.3, 0.55), 0, pick(el), 2.6, 0, 2);
      }
      ring(e.x, e.y + 0.2, 0.3, 2.2, 0.35, PAL[el][0], 2.2);
      if (sound) audio.shoot(el, true);
      break;
    case 'walljump':
      dust(e.x - e.dir * 0.4, e.y, 10, 4);
      ring(e.x - e.dir * 0.4, e.y, 0.2, 1.3, 0.25, PAL[el][1], 1.6);
      if (sound) audio.airJump();
      break;
    case 'ledge':
      dust(e.x, e.y, 8, 3);
      ring(e.x, e.y, 0.2, 1.1, 0.22, WHITE, 1.4);
      if (sound) audio.land(16);
      break;
    case 'climb':
      dust(e.x, e.y, 6, 2.5);
      break;
    case 'burst':
      // Breaking free of a beating.
      burst(e.x, e.y, el, 70, 15, 0.34, 0.5, 0, 0, 0);
      ring(e.x, e.y, 0.4, 4.2, 0.35, WHITE, 4);
      ring(e.x, e.y, 0.3, 2.4, 0.25, PAL[el][0], 3);
      addShake(0.45);
      fx.flash = Math.max(fx.flash, 0.28);
      fx.flashColor = '#ffffff';
      popup(e.x, e.y + 1.3, 'BREAK FREE!', '#ffffff', true);
      if (sound) {
        audio.clash();
        audio.airJump();
      }
      break;
    case 'empty':
      // Out of shots: a sputter where the bolt would have been.
      for (let i = 0; i < 7; i++) {
        particles.spawn(e.x, e.y, 0.3, e.dir * rnd(0.5, 3), rnd(-1, 1.5), 0, rnd(0.15, 0.3), rnd(0.12, 0.22), 0, DUST, 1, 0, 3);
      }
      if (sound) audio.swing();
      break;
    case 'whip': {
      // A rope of water out to wherever it caught (or its full reach).
      const n = Math.round(e.power * 9);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        particles.spawn(e.x + e.dir * e.power * u, e.y + Math.sin(u * Math.PI) * 0.7 + rnd(-0.08, 0.08), rnd(-0.1, 0.1), -e.dir * rnd(1, 6) * u, rnd(-1, 2), 0, rnd(0.2, 0.4), rnd(0.2, 0.36) * (1 - u * 0.4), 0, pick(el), 2.6, 5, 1);
      }
      ring(e.x + e.dir * e.power, e.y, 0.2, 1.6, 0.22, PAL[el][0], 3);
      if (sound) audio.shoot(el, false);
      break;
    }
    case 'heal':
      ring(e.x, e.y, 2.2, 0.4, 0.5, PAL[el][0], 2);
      popup(e.x, e.y + 1.4, 'HEAL', '#9be4ff');
      if (sound) audio.respawn();
      break;
    case 'gust':
      for (let i = 0; i < 90; i++) {
        particles.spawn(e.x + e.dir * rnd(0, 1.5), e.y + rnd(-1.6, 1.6), rnd(-0.8, 0.8), e.dir * rnd(14, 38), rnd(-2, 2), 0, rnd(0.12, 0.3), rnd(0.14, 0.34), 0, pick(el), rnd(1.2, 2.2), 0, 1.5);
      }
      ring(e.x + e.dir * 1.5, e.y, 0.5, 3, 0.25, WHITE, 2);
      ring(e.x + e.dir * 3.5, e.y, 0.5, 2.6, 0.32, PAL[el][2], 1.6);
      addShake(0.15);
      if (sound) {
        audio.dash();
        audio.shoot(el, true);
      }
      break;
    case 'mine':
      burst(e.x, e.y + 0.2, el, 12, 3, 0.2, 0.3);
      if (sound) audio.swing();
      break;
    case 'mineBoom':
      burst(e.x, e.y + 0.5, el, 80, 14, 0.42, 0.6, 0, 0.6, 3);
      ring(e.x, e.y + 0.3, 0.3, 3.4, 0.35, PAL[el][0], 3.4);
      scorch(e.x, e.y, 2.2, PAL[el][1]);
      addShake(0.5);
      if (sound) audio.erupt();
      break;
    case 'wall':
      for (let i = 0; i < 26; i++) {
        particles.spawn(e.x + rnd(-0.5, 0.5), e.y + rnd(0.4), rnd(-1, 1), rnd(-4, 4), rnd(4, 12), rnd(-2, 2), rnd(0.3, 0.7), rnd(0.2, 0.45), 0.1, Math.random() < 0.6 ? DUST : pick(el), rnd(0.8, 2), 24, 0.6);
      }
      addShake(0.25);
      if (sound) audio.erupt();
      break;
    case 'wallBreak':
      for (let i = 0; i < 60; i++) {
        particles.spawn(e.x + rnd(-0.4, 0.4), e.y + rnd(-WALL_HEIGHT / 2, WALL_HEIGHT / 2), rnd(-1.2, 1.2), rnd(-8, 8), rnd(-2, 9), rnd(-3, 3), rnd(0.3, 0.8), rnd(0.2, 0.5), 0.1, Math.random() < 0.7 ? DUST : pick(el), rnd(0.8, 1.8), 26, 0.6);
      }
      addShake(0.3);
      if (sound) audio.erupt();
      break;
    case 'updraft':
      ring(e.x, e.y + 0.1, 0.3, 2, 0.3, PAL[el][0], 2);
      if (sound) audio.shoot(el, true);
      break;
    case 'tremor':
      dust(e.x, e.y, 16, 7);
      addShake(0.3);
      if (sound) audio.rumble();
      break;
    case 'strike':
      // Point-blank attack: a tight cone of sparks driven through the target.
      for (let i = 0; i < 30; i++) {
        particles.spawn(e.x, e.y + rnd(-0.3, 0.3), rnd(-0.3, 0.3), e.dir * rnd(6, 20), rnd(-4, 4), rnd(-2, 2), rnd(0.15, 0.35), rnd(0.25, 0.5), 0, pick(el), 3, 0, 3);
      }
      ring(e.x + e.dir * 0.4, e.y, 0.2, 1.9, 0.22, PAL[el][0], 3);
      break;
    case 'parry':
      burst(e.x, e.y, el, 46, 13, 0.3, 0.45, -e.dir, 0, 0);
      ring(e.x, e.y, 0.3, 3.2, 0.3, WHITE, 4);
      ring(e.x, e.y, 0.2, 1.6, 0.2, PAL[el][0], 3);
      addShake(0.4);
      fx.flash = Math.max(fx.flash, 0.3);
      fx.flashColor = '#ffffff';
      popup(e.x, e.y + 1.2, 'PARRY!', '#ffffff', true);
      if (sound) audio.parry();
      break;
    case 'diveLand':
      scorch(e.x, e.y, 2.4, PAL[el][1]);
      for (let i = 0; i < 34; i++) {
        const d = Math.random() < 0.5 ? -1 : 1;
        particles.spawn(e.x, e.y + 0.1, rnd(-0.6, 0.6), d * rnd(3, 13), rnd(0.5, 5), rnd(-2, 2), rnd(0.25, 0.5), rnd(0.3, 0.55), 0, pick(el), 2.6, 8, 2.5);
      }
      ring(e.x, e.y + 0.15, 0.4, 3.2, 0.35, PAL[el][0], 2.4);
      dust(e.x, e.y, 14, 7);
      addShake(0.35);
      if (sound) audio.erupt();
      break;
    case 'hit': {
      const p = e.power;
      const heavy = p > 26;
      burst(e.x, e.y, el, Math.min(70, 10 + p * 1.3), 4 + p * 0.35, heavy ? 0.4 : 0.28, heavy ? 0.6 : 0.4, e.dir * 0.8, 0.3, 5);
      ring(e.x, e.y, 0.2, 1.2 + p * 0.07, 0.25 + p * 0.004, heavy ? WHITE : PAL[el][0], heavy ? 3 : 2);
      if (heavy) ring(e.x, e.y, 0.3, 4.5, 0.5, PAL[el][1], 1.6);
      addShake(Math.min(0.75, 0.08 + p / 62));
      if (p > 34) fx.flash = Math.max(fx.flash, 0.22);
      if (p > 37) {
        // A launch this hard may well be the kill: sell it.
        fx.crit = 1;
        fx.critX = e.x;
        fx.critY = e.y;
        slow(0.2, 0.32);
      }
      if (e.amt >= 1) popup(e.x, e.y + 0.9, `${Math.round(e.amt)}%`, ELEMENTS[el].glow, e.amt >= 12);
      if (e.combo >= 3) popup(e.x, e.y + 1.7, `${e.combo} HITS`, '#ffd76b', e.combo >= 5);
      if (sound) audio.hit(p);
      break;
    }
    case 'shieldUp':
      ring(e.x, e.y, 0.5, 1.5, 0.22, PAL[el][1], 1.4);
      break;
    case 'shield':
      burst(e.x, e.y, el, 10, 5, 0.2, 0.3, -e.dir, 0, 0);
      addShake(0.08);
      if (sound) audio.shield();
      break;
    case 'shieldBreak':
      burst(e.x, e.y, el, 70, 11, 0.35, 0.7);
      ring(e.x, e.y, 0.5, 4, 0.45, WHITE, 3);
      addShake(0.5);
      fx.flash = Math.max(fx.flash, 0.2);
      if (sound) audio.shieldBreak();
      break;
    case 'clash':
      burst(e.x, e.y, el, 22, 8, 0.26, 0.35, 0, 0, 0);
      ring(e.x, e.y, 0.2, 1.8, 0.25, WHITE, 2.4);
      if (sound) audio.clash();
      break;
    case 'fizzle':
      burst(e.x, e.y, el, e.power === 2 ? 40 : 10, e.power === 2 ? 10 : 3.5, 0.24, 0.4, 0, e.power === 2 ? 0.8 : 0, e.power === 1 ? 10 : 2);
      if (e.power === 1) dust(e.x, e.y, 8, 4);
      break;
    case 'pillarWarn':
      ring(e.x, e.y + 0.08, 1.6, 0.5, 0.36, PAL[el][1], 2.4);
      dust(e.x, e.y, 10, 3);
      if (sound) audio.rumble();
      break;
    case 'pillarErupt':
      scorch(e.x, e.y, 1.7, PAL[el][2], 1.8);
      for (let i = 0; i < 46; i++) {
        particles.spawn(e.x + rnd(-0.9, 0.9), e.y + rnd(0.5), rnd(-0.8, 0.8), rnd(-5, 5), rnd(5, 17), rnd(-2, 2), rnd(0.4, 0.9), rnd(0.25, 0.55), 0.1, Math.random() < 0.5 ? DUST : pick(el), rnd(0.8, 2.2), 26, 0.6);
      }
      ring(e.x, e.y + 0.1, 0.5, 3.4, 0.4, PAL[el][0], 2.2);
      addShake(0.38);
      if (sound) audio.erupt();
      break;
    case 'ko': {
      // Blast inward from wherever they crossed the line.
      const cx = Math.max(-1, Math.min(1, -e.x / g.stage.blast.right));
      const cy = Math.max(-1, Math.min(1, (6 - e.y) / 14));
      const len = Math.hypot(cx, cy) || 1;
      const dx = cx / len;
      const dy = cy / len;
      for (let i = 0; i < 220; i++) {
        const s = rnd(4, 46);
        const spread = rnd(-0.35, 0.35);
        particles.spawn(e.x, e.y, rnd(-1, 1), (dx - dy * spread) * s, (dy + dx * spread) * s, rnd(-3, 3), rnd(0.4, 1.3), rnd(0.4, 1.1), 0, Math.random() < 0.3 ? WHITE : pick(el), rnd(2, 4), 0, 1.4);
      }
      fx.koBeams.push({ x: e.x, y: e.y, angle: Math.atan2(dy, dx), t: 0, dur: 0.75, color: PAL[el][1] });
      ring(e.x + dx * 3, e.y + dy * 3, 1, 9, 0.6, PAL[el][0], 3);
      addShake(1);
      fx.focusX = e.x;
      fx.focusY = e.y;
      fx.focusT = e.power ? 1.6 : 0.9;
      fx.flash = 0.75;
      fx.flashColor = ELEMENTS[el].glow;
      if (e.power) slow(0.22, 1.5);
      else slow(0.45, 0.3);
      if (sound) audio.ko();
      break;
    }
    case 'respawn':
      ring(e.x, e.y + 1, 2.4, 0.4, 0.5, PAL[el][0], 2);
      burst(e.x, e.y + 1, el, 30, 5, 0.25, 0.6, 0, 0, -3);
      if (sound) audio.respawn();
      break;
    case 'ultStart':
      ring(e.x, e.y, 7, 0.4, ULT_CHARGE * 0.9, PAL[el][0], 3);
      ring(e.x, e.y, 4.5, 0.3, ULT_CHARGE * 0.7, PAL[el][1], 2);
      fx.flash = Math.max(fx.flash, 0.35);
      fx.flashColor = ELEMENTS[el].glow;
      if (sound) audio.ultStart();
      break;
    case 'ultFire':
      burst(e.x + e.dir, e.y, el, 60, 14, 0.4, 0.6, e.dir, 0, 0);
      ring(e.x + e.dir, e.y, 0.5, 6, 0.5, WHITE, 3);
      addShake(0.7);
      fx.flash = Math.max(fx.flash, 0.4);
      if (sound) audio.ultFire();
      break;
    case 'count':
      if (sound) audio.count(e.power);
      break;
    case 'gameover':
      if (sound) audio.victory(e.id as 0 | 1);
      break;
    case 'ultEnd':
      break;
    case 'taunt': {
      const lines = e.amt ? TAUNTS_OVER_GRAVE : TAUNTS[e.power] ?? TAUNTS[0];
      if (fx.popups.length >= 10) fx.popups.shift();
      fx.popups.push({ x: e.x, y: e.y + 1.9, text: lines[Math.floor(Math.random() * lines.length)], t: 0, dur: 1.5, color: ELEMENTS[el].color, big: false, bubble: true });
      fx.swagX = e.x;
      fx.swagY = e.y;
      fx.swagT = 1.25;
      burst(e.x, e.y + 0.4, el, 16, 4, 0.2, 0.5, 0, 0.8, -2);
      if (sound) audio.taunt(e.power);
      break;
    }
    case 'tauntDone':
      for (let i = 0; i < 26; i++) {
        particles.spawn(e.x + rnd(-0.7, 0.7), e.y + rnd(-0.8, 0.8), rnd(-0.4, 0.4), rnd(-1, 1), rnd(2, 6), 0, rnd(0.4, 0.8), rnd(0.14, 0.26), 0, Math.random() < 0.5 ? STAR : pick(el), 3, 0, 1);
      }
      popup(e.x, e.y + 1.2, '+SPIRIT', '#ffd76b');
      if (sound) audio.uiConfirm();
      break;
    case 'note':
      // A little spray of the same colour the note is, and the note itself (badly).
      burst(e.x, e.y, el, 4, 3, 0.16, 0.25, e.dir, 0.4, -2);
      if (sound) audio.tylerNote(e.power);
      break;
    case 'fry':
      ring(e.x, e.y, 0.4, FRY_R, 0.4, PAL[el][1], 3);
      popup(e.x, e.y + 2, 'DEEP FRIED', '#ffb300', true);
      if (sound) audio.airhorn();
      break;
    case 'pianoSpin':
      ring(e.x, e.y, 0.5, 2.2, PIANO_SPIN, WHITE, 1.6);
      if (sound) audio.dash();
      break;
    case 'pianoCrash':
      for (let i = 0; i < 90; i++) {
        particles.spawn(e.x + rnd(-1, 1), e.y + rnd(0, 0.8), rnd(-1, 1), rnd(-12, 12), rnd(2, 15), rnd(-3, 3), rnd(0.3, 0.9), rnd(0.2, 0.5), 0.1, Math.random() < 0.5 ? WHITE : BLACK_KEY, rnd(0.8, 2.2), 26, 0.6);
      }
      ring(e.x, e.y + 0.2, 0.4, 4.4, 0.4, WHITE, 3);
      scorch(e.x, e.y, 2.4, PAL[el][1]);
      addShake(0.7);
      fx.flash = Math.max(fx.flash, 0.25);
      fx.flashColor = '#ffffff';
      popup(e.x, e.y + 2.2, 'PIANO.', '#ffffff', true);
      if (sound) audio.pianoCrash();
      break;
    case 'gremlin':
      burst(e.x, e.y, el, 20, 5, 0.22, 0.35);
      if (sound) audio.squeak();
      break;
    case 'gremlinBite':
      burst(e.x, e.y, el, 6, 3, 0.16, 0.2);
      if (sound) audio.squeak();
      break;
    case 'gremlinDie':
      for (let i = 0; i < 26; i++) {
        particles.spawn(e.x, e.y, 0.2, rnd(-4, 4), rnd(-1, 6), rnd(-2, 2), rnd(0.3, 0.6), rnd(0.25, 0.5), 0.4, DUST, 1, -1, 2);
      }
      if (sound) audio.squeak();
      break;
    case 'splat':
      for (let i = 0; i < (e.power ? 26 : 12); i++) {
        particles.spawn(e.x + rnd(-0.3, 0.3), e.y + 0.1, rnd(-0.4, 0.4), rnd(-6, 6), rnd(1, 7), rnd(-2, 2), rnd(0.3, 0.7), rnd(0.2, 0.45), 0.1, BROWN, rnd(0.7, 1.2), 22, 0.6);
      }
      if (!e.power) scorch(e.x, e.y, 0.9, BROWN, 3.5);
      if (sound) audio.splat();
      break;
    case 'slip':
      for (let i = 0; i < 40; i++) {
        particles.spawn(e.x + rnd(-0.6, 0.6), e.y + 0.1, rnd(-0.5, 0.5), rnd(-7, 7), rnd(3, 11), rnd(-2, 2), rnd(0.4, 0.9), rnd(0.2, 0.36), 0.1, pick(el), rnd(1.4, 2.6), 16, 1);
      }
      popup(e.x, e.y + 1.6, 'SLIPPED', ELEMENTS[el].color, true);
      if (sound) audio.kaching();
      break;
    case 'midas':
      burst(e.x, e.y, el, 60, 9, 0.3, 0.6, 0, 0, 2);
      ring(e.x, e.y, 0.3, 2.6, 0.35, STAR, 4);
      popup(e.x, e.y + 1.5, 'GOLD', '#ffe27a', true);
      if (sound) audio.kaching();
      break;
    case 'shatter':
      for (let i = 0; i < 46; i++) {
        particles.spawn(e.x + rnd(-0.4, 0.4), e.y + rnd(-0.8, 0.8), rnd(-0.4, 0.4), rnd(-7, 7), rnd(-1, 8), rnd(-2, 2), rnd(0.3, 0.7), rnd(0.16, 0.34), 0, STAR, rnd(2, 3.4), 18, 0.8);
      }
      if (sound) audio.clang();
      break;
    case 'lambo':
      dust(e.x, e.y - 0.5, 18, 8);
      if (sound) audio.vroom();
      break;
    case 'dance':
      ring(e.x, e.y, 3, 0.5, 0.5, STAR, 3);
      popup(e.x, e.y + 2, 'BUST DOWN', '#ffe27a', true);
      fx.flash = Math.max(fx.flash, 0.3);
      fx.flashColor = '#ffe27a';
      if (sound) audio.kaching();
      break;
    case 'safeDrop':
      break;
    case 'safeHit':
      for (let i = 0; i < 140; i++) {
        particles.spawn(e.x + rnd(-1, 1), e.y + rnd(0, 1.5), rnd(-1, 1), rnd(-14, 14), rnd(2, 20), rnd(-4, 4), rnd(0.4, 1.1), rnd(0.2, 0.45), 0.05, Math.random() < 0.5 ? STAR : pick(el), rnd(1.6, 3.2), 22, 0.6);
      }
      ring(e.x, e.y + 0.3, 0.5, 6, 0.45, STAR, 4);
      scorch(e.x, e.y, 2.6, STAR, 2);
      addShake(0.9);
      fx.flash = Math.max(fx.flash, 0.4);
      fx.flashColor = '#ffe27a';
      if (sound) {
        audio.erupt();
        audio.kaching();
      }
      break;
    case 'zap': {
      const a = e.amt ? (34 * Math.PI) / 180 : 0;
      arc(e.x, e.y, Math.cos(a) * e.dir, Math.sin(a), e.power, el);
      arc(e.x, e.y, Math.cos(a) * e.dir, Math.sin(a), e.power, el, 7, 0.5);
      ring(e.x + Math.cos(a) * e.dir * e.power, e.y + Math.sin(a) * e.power, 0.15, 1.2, 0.18, PAL[el][0], 3);
      if (sound) audio.shoot(el, false);
      break;
    }
    case 'blinkOut':
    case 'blinkIn':
      for (let i = 0; i < 34; i++) {
        particles.spawn(e.x + rnd(-0.3, 0.3), e.y + rnd(-0.9, 0.9), rnd(-0.3, 0.3), rnd(-2, 2), rnd(-7, 7), 0, rnd(0.15, 0.35), rnd(0.14, 0.3), 0, pick(el), 3, 0, 2);
      }
      ring(e.x, e.y, e.type === 'blinkIn' ? 1.8 : 0.2, e.type === 'blinkIn' ? 0.2 : 1.8, 0.2, PAL[el][0], 3);
      if (sound && e.type === 'blinkOut') audio.warp();
      break;
    case 'stormWarn': {
      // `amt` says what is coming: 0 lightning, 1 an icicle, 2 a geyser.
      const warn = e.amt === 2 ? PAL.fire[1] : e.amt === 1 ? PAL.water[0] : PAL.lightning[1];
      ring(e.x, e.y + 0.06, 1.7, 0.6, e.power, warn, 2.2);
      ring(e.x, e.y + 0.06, 1.1, 0.4, e.power, warn, 1.6);
      break;
    }
    case 'stormHit':
      if (e.amt === 2) {
        // A geyser: a column of fire thrown straight up out of the hole.
        for (let i = 0; i < 150; i++) {
          particles.spawn(e.x + rnd(-0.7, 0.7), e.y + rnd(0, 1), rnd(-0.6, 0.6), rnd(-2.5, 2.5), rnd(14, 38), rnd(-1.5, 1.5), rnd(0.3, 0.8), rnd(0.35, 0.8), 0.05, pick('fire'), rnd(2, 3.6), 30, 0.4);
        }
        ring(e.x, Math.max(e.y, -2) + 0.1, 0.4, 3.2, 0.35, PAL.fire[0], 3);
        addShake(0.4);
        if (sound) audio.erupt();
        break;
      }
      // From the sky: a fork from high above down to the strike point, twice for thickness.
      arc(e.x, e.y, 0, 1, 26, el, 9, e.amt === 1 ? 0.12 : 0.5);
      arc(e.x, e.y, 0, 1, 26, el, 6, e.amt === 1 ? 0.2 : 0.9);
      burst(e.x, e.y + 0.2, el, 50, 12, 0.36, 0.5, 0, 0.6, e.amt === 1 ? 26 : 6);
      ring(e.x, e.y + 0.1, 0.4, 3.4, 0.3, WHITE, 4);
      scorch(e.x, e.y, 1.8, PAL[el][1], 1.6);
      addShake(e.amt === 1 ? 0.25 : 0.45);
      if (e.amt === 0) {
        fx.flash = Math.max(fx.flash, 0.3);
        fx.flashColor = '#ffffff';
      }
      if (sound) {
        if (e.amt === 1) audio.shieldBreak();
        else audio.thunder();
      }
      break;
    case 'crumble':
      for (let i = 0; i < 40; i++) {
        particles.spawn(e.x + rnd(-e.power / 2, e.power / 2), e.y - rnd(0, 0.4), rnd(-1.2, 1.2), rnd(-2, 2), rnd(-6, 2), rnd(-1, 1), rnd(0.4, 0.9), rnd(0.25, 0.55), 0.1, DUST, 1, 22, 0.5);
      }
      addShake(0.2);
      if (sound) audio.erupt();
      break;
    case 'restore':
      ring(e.x, e.y, 2.4, 0.4, 0.35, WHITE, 1.6);
      break;
    case 'belt':
      popup(e.x, e.y + 3.2, e.dir > 0 ? 'CONVEYOR  >>>' : '<<<  CONVEYOR', '#ffb347', true);
      if (sound) audio.clang();
      break;
    case 'cable': {
      // `amt` is the cable's upward angle (the ledge tether); 0 for the level Magnet Zip.
      const n = Math.round(e.power * 7);
      const ca = Math.cos(e.amt) * e.dir;
      const sa = Math.sin(e.amt);
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        particles.spawn(e.x + ca * e.power * u, e.y + sa * e.power * u, 0.2, 0, 0, 0, rnd(0.18, 0.3), 0.16, 0.04, PAL[el][i % 3 === 0 ? 0 : 1], 2.4, 0, 0);
      }
      ring(e.x + ca * e.power, e.y + sa * e.power, 0.15, 1, 0.2, PAL[el][0], 3);
      if (sound) audio.clang();
      break;
    }
    case 'armor':
      ring(e.x, e.y, 2, 0.5, 0.3, PAL[el][0], 3);
      burst(e.x, e.y, el, 30, 7, 0.24, 0.4, 0, 0, 0);
      popup(e.x, e.y + 1.4, 'IRON SKIN', ELEMENTS[el].glow, true);
      if (sound) audio.clang();
      break;
    case 'armorHit':
      burst(e.x, e.y, el, 16, 9, 0.2, 0.3, -e.dir, 0.2, 8);
      ring(e.x, e.y, 0.2, 1.2, 0.18, WHITE, 2.4);
      popup(e.x, e.y + 0.9, `${Math.round(e.amt)}%`, '#e6f2ff');
      addShake(0.1);
      if (sound) audio.clang();
      break;
    case 'swap':
      burst(e.x, e.y, el, 44, 9, 0.3, 0.45, 0, 0, -2);
      ring(e.x, e.y, 2.4, 0.3, 0.26, PAL[el][0], 3);
      ring(e.x, e.y, 0.3, 2.4, 0.3, PAL[el][1], 2);
      addShake(0.2);
      if (sound) audio.warp();
      break;
    case 'cloneBoom':
      burst(e.x, e.y, el, 60, 11, 0.36, 0.5);
      ring(e.x, e.y, 0.3, 2.6, 0.3, PAL[el][0], 3);
      addShake(0.3);
      if (sound) audio.hit(20);
      break;
    case 'sink':
      for (let i = 0; i < 26; i++) {
        particles.spawn(e.x + rnd(-0.6, 0.6), e.y + rnd(0, 1.4), rnd(-0.4, 0.4), rnd(-1, 1), rnd(-7, -2), 0, rnd(0.2, 0.4), rnd(0.2, 0.4), 0, pick(el), 1.6, 0, 1);
      }
      if (sound) audio.shoot(el, false);
      break;
    case 'rise':
      for (let i = 0; i < 46; i++) {
        particles.spawn(e.x + rnd(-0.7, 0.7), e.y + rnd(0.3), rnd(-0.5, 0.5), rnd(-3, 3), rnd(6, 17), rnd(-1, 1), rnd(0.25, 0.55), rnd(0.25, 0.5), 0, pick(el), rnd(1.6, 3), 10, 1);
      }
      ring(e.x, e.y + 0.1, 0.3, 2.6, 0.3, PAL[el][0], 3);
      addShake(0.25);
      if (sound) audio.shoot(el, true);
      break;
    case 'curse':
      for (let i = 0; i < 8; i++) {
        particles.spawn(e.x + rnd(-0.5, 0.5), e.y + rnd(-1, 0.6), rnd(-0.3, 0.3), rnd(-0.6, 0.6), rnd(1, 3), 0, rnd(0.3, 0.6), rnd(0.16, 0.3), 0, pick('shadow'), 2, 0, 1);
      }
      popup(e.x, e.y + 0.4, `${e.amt}%`, '#c79bff');
      break;
    case 'portal':
      ring(e.x, e.y, 0.2, 1.6, 0.35, PAL[el][0], 3);
      burst(e.x, e.y, el, 30, 6, 0.24, 0.45, 0, 0, 0);
      if (sound) audio.warp();
      break;
    case 'warp':
      burst(e.x, e.y, el, e.amt ? 12 : 30, 7, 0.24, 0.35, 0, 0, 0);
      ring(e.x, e.y, 1.3, 0.2, 0.2, PAL[el][0], 3);
      if (sound) audio.warp();
      break;
    case 'flip':
      for (let i = 0; i < 70; i++) {
        particles.spawn(e.x + e.dir * rnd(0, e.power), e.y + rnd(-1.6, 0.4), rnd(-0.6, 0.6), rnd(-0.6, 0.6), rnd(6, 16), 0, rnd(0.25, 0.5), rnd(0.14, 0.3), 0, pick(el), rnd(1.6, 2.6), -6, 0.5);
      }
      ring(e.x + e.dir * 3, e.y, 0.5, 3, 0.3, PAL[el][0], 2);
      if (sound) audio.shoot(el, true);
      break;
    case 'well':
      ring(e.x, e.y, e.power ? 9 : 4.5, 0.3, 0.5, PAL[el][1], 2.4);
      if (sound) audio.shoot(el, true);
      break;
    case 'wellBoom': {
      const big = e.power > 0;
      burst(e.x, e.y, el, big ? 160 : 70, big ? 22 : 13, big ? 0.5 : 0.36, 0.6, 0, 0, 0);
      ring(e.x, e.y, 0.3, big ? 9 : 4, 0.4, WHITE, 4);
      ring(e.x, e.y, 0.2, big ? 6 : 2.6, 0.5, PAL[el][1], 3);
      addShake(big ? 0.8 : 0.4);
      fx.flash = Math.max(fx.flash, big ? 0.45 : 0.15);
      fx.flashColor = ELEMENTS[el].glow;
      if (sound) audio.implode();
      break;
    }
  }
}

/** Fractional emission: `rate` per second becomes a whole count this frame. */
function count(rate: number, dt: number): number {
  const n = rate * dt;
  const whole = Math.floor(n);
  return whole + (Math.random() < n - whole ? 1 : 0);
}

function fighterTrails(f: Fighter, g: Game, dt: number): void {
  if (f.state === 'dead') return;
  const el = f.el.id;
  const cy = f.y + 0.95;

  if (f.state === 'ult') {
    if (f.stateT < ULT_CHARGE) {
      // Charge: motes spiral in from all around.
      for (let i = count(260, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        const r = rnd(2.5, 6);
        const px = f.x + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        particles.spawn(px, py, rnd(-1, 1), (f.x - px) * 2.4 - Math.sin(a) * 4, (cy - py) * 2.4 + Math.cos(a) * 4, 0, 0.42, rnd(0.2, 0.4), 0.05, pick(el), 3, 0, 0);
      }
    } else if (el === 'air' && f.ultT() < TEMPEST_TIME) {
      // Tempest: debris whipped around the eye and flung upward.
      for (let i = count(520, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        const h = rnd(0, 1);
        const r = 0.8 + h * TEMPEST_R;
        particles.spawn(f.x + Math.cos(a) * r, f.y - 1 + h * 9, Math.sin(a) * r, -Math.sin(a) * 16, rnd(4, 12), Math.cos(a) * 16, rnd(0.2, 0.5), rnd(0.2, 0.5), 0, pick(el), rnd(1.4, 2.6), 0, 1.5);
      }
      fx.shake = Math.max(fx.shake, 0.28);
    } else if (el === 'metal' && f.ultT() < CRUSH_TIME) {
      // Magnet Crush: filings streaming in to where the plates will meet.
      const px = f.x + f.facing * 3.2;
      const py = f.y + 1.3;
      for (let i = count(420, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        const r = rnd(3, 9);
        const sx = px + Math.cos(a) * r;
        const sy = py + Math.sin(a) * r;
        particles.spawn(sx, sy, rnd(-1, 1), (px - sx) * 3, (py - sy) * 3, 0, 0.32, rnd(0.14, 0.3), 0.04, pick(el), 2.6, 0, 0);
      }
      fx.shake = Math.max(fx.shake, 0.2);
    } else if (el === 'tyler' && f.ultT() < STORM_TIME) {
      // Conducting the storm: a foul green haze rolling off him.
      for (let i = count(120, dt); i > 0; i--) {
        particles.spawn(f.x + rnd(-1, 1), f.y + rnd(0, 2), rnd(-0.5, 0.5), rnd(-1.5, 1.5), rnd(1, 4), 0, rnd(0.4, 0.8), rnd(0.3, 0.6), 0.8, Math.random() < 0.5 ? STINK : BROWN, 0.8, -1, 1);
      }
      fx.shake = Math.max(fx.shake, 0.16);
    } else if (el === 'cash' && f.ultT() < DANCE_TIME) {
      // Making it rain, personally.
      for (let i = count(140, dt); i > 0; i--) {
        particles.spawn(f.x + f.facing * 0.5, f.y + 1.6, rnd(-0.3, 0.3), f.facing * rnd(2, 9) + rnd(-2, 2), rnd(4, 11), rnd(-1, 1), rnd(0.5, 1), rnd(0.2, 0.36), 0.14, Math.random() < 0.3 ? STAR : pick(el), rnd(1.4, 2.4), 16, 0.6);
      }
    } else if (el === 'lightning' || el === 'shadow' || el === 'void') {
      // The caster crackles while the storm, the nightmare or the hole does the work.
      for (let i = count(160, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        particles.spawn(f.x + Math.cos(a) * rnd(0.3, 1.4), cy + Math.sin(a) * rnd(0.3, 1.4), rnd(-0.5, 0.5), Math.cos(a) * rnd(1, 6), Math.sin(a) * rnd(1, 6), 0, rnd(0.15, 0.4), rnd(0.16, 0.36), 0, pick(el), rnd(2, 3.4), 0, 1);
      }
    } else if (el === 'fire' && f.ultT() <= ULT_BEAM) {
      const y = f.y + 1.1;
      for (let i = count(520, dt); i > 0; i--) {
        const d = rnd(0.5, 46);
        particles.spawn(f.x + f.facing * d, y + rnd(-0.9, 0.9), rnd(-0.9, 0.9), f.facing * rnd(10, 40), rnd(-3, 3), rnd(-3, 3), rnd(0.15, 0.45), rnd(0.25, 0.6), 0, pick(el), rnd(2, 4), 0, 0);
      }
      for (let i = count(120, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        particles.spawn(f.x + f.facing * 0.9, y, 0, Math.cos(a) * rnd(3, 11) - f.facing * 3, Math.sin(a) * rnd(3, 11), rnd(-4, 4), rnd(0.2, 0.4), rnd(0.3, 0.5), 0, pick(el), 3, 0, 2);
      }
      fx.shake = Math.max(fx.shake, 0.3);
    }
    return;
  }

  // Statuses that need to be readable at a glance.
  if (f.armorT > 0) {
    for (let i = count(40, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.5, 0.5), f.y + rnd(0.1, 1.8), 0.4, rnd(-0.3, 0.3), rnd(-0.3, 0.6), 0, rnd(0.1, 0.25), rnd(0.1, 0.2), 0, WHITE, 3, 0, 0);
    }
  }
  if (f.confuseT > 0) {
    for (let i = count(46, dt); i > 0; i--) {
      const a = g.time * 5 + rnd(Math.PI * 2);
      particles.spawn(f.x + Math.cos(a) * 0.6, f.y + 2.15 + rnd(-0.1, 0.1), Math.sin(a) * 0.6, -Math.sin(a) * 2, rnd(-0.3, 0.6), Math.cos(a) * 2, rnd(0.3, 0.6), rnd(0.14, 0.28), 0, pick('shadow'), 2.4, 0, 0);
    }
  }
  if (f.gravFlipT > 0) {
    for (let i = count(60, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.5, 0.5), f.y + rnd(0, 1.8), rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(5, 11), 0, rnd(0.2, 0.45), rnd(0.12, 0.26), 0, pick('void'), 2.4, 0, 0);
    }
  }
  if (f.goldT > 0) {
    for (let i = count(36, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.6, 0.6), f.y + rnd(0, 1.9), 0.4, 0, rnd(0.2, 1.2), 0, rnd(0.2, 0.5), rnd(0.1, 0.2), 0, STAR, 3.4, 0, 0);
    }
  }
  if (f.state === 'dance') {
    // Money falling on the dancer from well above.
    for (let i = count(120, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-3.5, 3.5), f.y + rnd(5, 11), rnd(-1.5, 1.5), rnd(-1.5, 1.5), rnd(-12, -6), 0, rnd(0.6, 1.1), rnd(0.2, 0.36), 0.16, Math.random() < 0.3 ? STAR : pick('cash'), rnd(1.4, 2.4), 3, 0.3);
    }
  }
  if (f.sunk()) {
    for (let i = count(70, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.8, 0.8), f.y + 0.06, rnd(-0.6, 0.6), rnd(-1.5, 1.5), rnd(0.3, 2), 0, rnd(0.2, 0.45), rnd(0.2, 0.4), 0, pick(el), 1.4, 0, 2);
    }
    return;
  }

  // Spirit meter full: a steady rising aura so both players can see it is ready.
  if (f.meter >= 100) {
    for (let i = count(46, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.6, 0.6), f.y + rnd(0, 1.2), rnd(-0.5, 0.5), rnd(-0.4, 0.4), rnd(2, 5), 0, rnd(0.4, 0.8), rnd(0.14, 0.26), 0, Math.random() < 0.4 ? WHITE : pick(el), 3, 0, 0.5);
    }
  }

  const speed = Math.hypot(f.vx, f.vy);
  if (f.state === 'hitstun' && speed > 14) {
    // Smash-style launch trail.
    for (let i = count(speed * 5, dt); i > 0; i--) {
      particles.spawn(f.x + rnd(-0.3, 0.3), cy + rnd(-0.5, 0.5), rnd(-0.3, 0.3), f.vx * 0.1 + rnd(-1, 1), f.vy * 0.1 + rnd(-1, 1), 0, rnd(0.3, 0.7), rnd(0.4, 0.8), 0.1, Math.random() < 0.5 ? WHITE : DUST, 0.9, -1, 1.5);
    }
  }
  if (f.state === 'stunned') {
    for (let i = count(14, dt); i > 0; i--) {
      const a = g.time * 6 + rnd(Math.PI * 2);
      particles.spawn(f.x + Math.cos(a) * 0.5, f.y + 2.05, Math.sin(a) * 0.5, Math.cos(a) * 1.2, 0.3, 0, 0.5, 0.2, 0, STAR, 3, 0, 0);
    }
  }
  if (f.state === 'dash') {
    for (let i = count(160, dt); i > 0; i--) {
      particles.spawn(f.x - f.dashDir * rnd(0.6), f.y + rnd(0.1, 1.7), rnd(-0.3, 0.3), -f.dashDir * rnd(1, 5), rnd(-0.5, 0.5), 0, rnd(0.12, 0.3), rnd(0.2, 0.36), 0, pick(el), 2, 0, 2);
    }
  }

  const hx = f.x + f.facing * 0.55;
  const hy = f.y + 1.2;
  if (f.state === 'free') {
    // Idle flair: a wisp of the element curling off the lead hand.
    for (let i = count(el === 'fire' ? 26 : 14, dt); i > 0; i--) {
      particles.spawn(hx + rnd(-0.08, 0.08), hy + rnd(-0.08, 0.08), 0.35, rnd(-0.4, 0.4), el === 'water' ? rnd(-1.2, 0.2) : rnd(0.4, 1.8), 0, rnd(0.25, 0.5), rnd(0.1, 0.2), 0, pick(el), 2, el === 'water' ? 4 : -1, 1);
    }
  }
  const m = f.move;
  if (f.state !== 'move' || !m) return;
  switch (m.kind) {
    case 'bolt':
    case 'rise':
    case 'sweep':
      for (let i = count(50, dt); i > 0; i--) {
        particles.spawn(hx + rnd(-0.15, 0.15), hy + rnd(-0.15, 0.15), 0.3, rnd(-1, 1), rnd(-0.5, 2), 0, rnd(0.15, 0.3), rnd(0.15, 0.28), 0, pick(el), 2.4, 0, 1);
      }
      break;
    case 'dive':
      if (!m.landed && m.t > 0.13) {
        for (let i = count(190, dt); i > 0; i--) {
          particles.spawn(f.x + rnd(-0.4, 0.4), f.y + rnd(0.2, 1.8), rnd(-0.3, 0.3), rnd(-1, 1), rnd(3, 10), 0, rnd(0.15, 0.35), rnd(0.25, 0.45), 0, pick(el), 2.6, 0, 1);
        }
      }
      break;
    case 'recover':
      if (m.fired && m.t < 0.36) {
        for (let i = count(190, dt); i > 0; i--) {
          particles.spawn(f.x + rnd(-0.3, 0.3), f.y + rnd(0.4), rnd(-0.3, 0.3), rnd(-2, 2), rnd(-9, -2), rnd(-1, 1), rnd(0.2, 0.5), rnd(0.25, 0.5), 0, pick(el), 2.6, 0, 1.5);
        }
      }
      break;
    case 'spcSide':
      if (el === 'cash' && m.fired && !m.landed) {
        // Joyride: sparks off the tyres and a wake of loose bills.
        for (let i = count(260, dt); i > 0; i--) {
          particles.spawn(f.x - f.facing * rnd(0.8, 1.6), f.y + rnd(0, 0.5), rnd(-0.6, 0.6), -f.facing * rnd(2, 10), rnd(0.5, 6), rnd(-1, 1), rnd(0.25, 0.6), rnd(0.16, 0.34), 0.05, Math.random() < 0.5 ? STAR : pick(el), rnd(1.6, 3), 10, 1);
        }
        fx.shake = Math.max(fx.shake, 0.1);
      }
      if (el === 'fire' && m.t >= 0.12 && m.t < 0.75) {
        // Flame Stream: a long, widening jet.
        for (let i = count(900, dt); i > 0; i--) {
          const sp = rnd(12, 24);
          particles.spawn(hx, hy - 0.15 + rnd(-0.1, 0.1), rnd(-0.1, 0.1), f.facing * sp, rnd(-2.4, 2.4), rnd(-1.5, 1.5), rnd(0.12, 0.26), rnd(0.18, 0.3), rnd(0.5, 0.9), pick(el), rnd(2, 3.4), -3, 0.6);
        }
        fx.shake = Math.max(fx.shake, 0.12);
      }
      break;
    case 'recover':
      if (el === 'cash' && m.fired && m.t < 0.4) {
        // Cash Out: riding a jet of banknotes.
        for (let i = count(260, dt); i > 0; i--) {
          particles.spawn(f.x + rnd(-0.25, 0.25), f.y + rnd(0.3), rnd(-0.3, 0.3), rnd(-3, 3), rnd(-12, -4), rnd(-1, 1), rnd(0.4, 0.9), rnd(0.2, 0.36), 0.14, Math.random() < 0.25 ? STAR : pick(el), rnd(1.4, 2.4), 6, 1);
        }
      }
      break;
    case 'spcDown':
      if (el === 'water' && m.t >= 0.25 && m.t < 0.9) {
        // Healing Tide: droplets rising and soaking back in.
        for (let i = count(160, dt); i > 0; i--) {
          const a = rnd(Math.PI * 2);
          particles.spawn(f.x + Math.cos(a) * rnd(0.3, 1.1), f.y + rnd(0, 0.6), Math.sin(a) * 0.8, -Math.cos(a) * 1.2, rnd(2, 5), 0, rnd(0.3, 0.6), rnd(0.14, 0.28), 0, Math.random() < 0.4 ? WHITE : pick(el), 2.6, 0, 1);
        }
      } else if (el === 'earth' && !m.fired && !f.ground) {
        for (let i = count(160, dt); i > 0; i--) {
          particles.spawn(f.x + rnd(-0.4, 0.4), f.y + rnd(0.2, 1.6), rnd(-0.3, 0.3), rnd(-1, 1), rnd(4, 10), 0, rnd(0.15, 0.35), rnd(0.25, 0.45), 0, Math.random() < 0.5 ? DUST : pick(el), 1.6, 0, 1);
        }
      }
      break;
    case 'special':
      if (el === 'fire' && m.t >= 0.13 && m.t < 0.42) {
        for (let i = count(420, dt); i > 0; i--) {
          particles.spawn(f.x - f.facing * rnd(0.8), f.y + rnd(0.2, 1.7), rnd(-0.4, 0.4), -f.facing * rnd(1, 9), rnd(-1.5, 3), rnd(-1, 1), rnd(0.2, 0.55), rnd(0.35, 0.7), 0, pick(el), rnd(2, 3.4), -4, 1.5);
        }
      } else {
        for (let i = count(110, dt); i > 0; i--) {
          const a = rnd(Math.PI * 2);
          particles.spawn(f.x + Math.cos(a) * 0.9, cy + Math.sin(a) * 0.9, rnd(-0.4, 0.4), -Math.sin(a) * 4, Math.cos(a) * 4 + 1, 0, rnd(0.2, 0.4), rnd(0.2, 0.36), 0, pick(el), 2.4, 0, 1);
        }
      }
      break;
  }
}

function projectileTrails(g: Game, dt: number): void {
  for (const p of g.projectiles) {
    const el = p.el;
    if (p.kind === 'bolt') {
      switch (el) {
        case 'fire':
          for (let i = count(130, dt); i > 0; i--) {
            particles.spawn(p.x + rnd(-0.2, 0.2), p.y + rnd(-0.2, 0.2), rnd(-0.2, 0.2), p.vx * 0.12 + rnd(-1, 1), rnd(-0.5, 2.5), 0, rnd(0.15, 0.4), rnd(0.3, 0.6), 0, pick(el), rnd(2, 3.2), -3, 1);
          }
          break;
        case 'water':
          for (let i = count(90, dt); i > 0; i--) {
            particles.spawn(p.x + rnd(-0.25, 0.25), p.y + rnd(-0.25, 0.25), rnd(-0.2, 0.2), p.vx * 0.2 + rnd(-1, 1), rnd(-1, 1.5), 0, rnd(0.2, 0.5), rnd(0.18, 0.4), 0, pick(el), 2.2, 9, 0.5);
          }
          break;
        case 'earth':
          for (let i = count(40, dt); i > 0; i--) {
            particles.spawn(p.x + rnd(-0.3, 0.3), p.y + rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-1, 1), rnd(-1, 1), 0, rnd(0.3, 0.6), rnd(0.25, 0.5), 0.4, Math.random() < 0.7 ? DUST : pick(el), 0.9, 4, 1);
          }
          break;
        case 'air':
          for (let i = count(120, dt); i > 0; i--) {
            particles.spawn(p.x + rnd(-0.1, 0.1), p.y + rnd(-0.6, 0.6), rnd(-0.3, 0.3), p.vx * 0.35, rnd(-0.6, 0.6), 0, rnd(0.1, 0.25), rnd(0.12, 0.26), 0, pick(el), 1.8, 0, 2);
          }
          break;
        default:
          // Discs, shards, shades and gravitons: a short glittering wake.
          for (let i = count(el === 'metal' ? 60 : 110, dt); i > 0; i--) {
            particles.spawn(p.x + rnd(-0.2, 0.2), p.y + rnd(-0.2, 0.2), rnd(-0.2, 0.2), p.vx * 0.08 + rnd(-0.8, 0.8), p.vy * 0.08 + rnd(-0.8, 0.8), 0, rnd(0.15, 0.4), rnd(0.16, 0.36), 0, pick(el), el === 'shadow' ? 1.4 : 2.2, 0, 1);
          }
          break;
      }
    } else if (p.kind === 'fry') {
      // The cloud: thick, hot, orange, and crackling at the edges.
      for (let i = count(260, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        const r = Math.sqrt(Math.random()) * p.r;
        particles.spawn(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, rnd(-1.5, 1.5), rnd(-1, 1), rnd(-0.5, 1.5), 0, rnd(0.3, 0.7), rnd(0.4, 0.9), 0.2, pick(el), rnd(0.8, 2.6), -1, 0.5);
      }
    } else if (p.kind === 'poop') {
      for (let i = count(70, dt); i > 0; i--) {
        particles.spawn(p.x + rnd(-0.3, 0.3), p.y + rnd(0, 0.6), rnd(-0.3, 0.3), rnd(-0.6, 0.6), rnd(0, 2), 0, rnd(0.3, 0.6), rnd(0.2, 0.4), 0.5, Math.random() < 0.6 ? STINK : BROWN, 0.8, -2, 1);
      }
    } else if (p.kind === 'piano') {
      for (let i = count(60, dt); i > 0; i--) {
        particles.spawn(p.x + rnd(-0.8, 0.8), p.y + rnd(-0.6, 0.6), rnd(-0.4, 0.4), rnd(-1, 1), rnd(-1, 1), 0, rnd(0.15, 0.35), rnd(0.14, 0.3), 0, WHITE, 1.6, 0, 1);
      }
    } else if (p.kind === 'orb') {
      for (let i = count(130, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        const r = rnd(0.2, p.r);
        particles.spawn(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, rnd(-0.4, 0.4), Math.cos(a) * rnd(-4, 6), Math.sin(a) * rnd(-4, 6), 0, rnd(0.08, 0.2), rnd(0.12, 0.26), 0, pick(el), rnd(2.4, 4), 0, 0);
      }
    } else if (p.kind === 'clone') {
      for (let i = count(120, dt); i > 0; i--) {
        particles.spawn(p.x + rnd(-0.3, 0.3), p.y + rnd(-0.9, 0.9), rnd(-0.3, 0.3), -p.vx * rnd(0.05, 0.3), rnd(-0.5, 1.5), 0, rnd(0.2, 0.45), rnd(0.25, 0.5), 0, pick(el), 1.2, -1, 1);
      }
    } else if (p.kind === 'tremor') {
      for (let i = count(220, dt); i > 0; i--) {
        particles.spawn(p.x + rnd(-0.5, 0.5), p.y - 0.35, rnd(-1, 1), -Math.sign(p.vx) * rnd(0, 4), rnd(2, 8), rnd(-1, 1), rnd(0.2, 0.45), rnd(0.2, 0.45), 0.1, Math.random() < 0.7 ? DUST : pick(el), rnd(0.8, 1.8), 22, 0.6);
      }
    } else if (p.kind === 'tsunami') {
      const d = Math.sign(p.vx);
      const k = TSUNAMI_R / 1.5;
      for (let i = count(700, dt); i > 0; i--) {
        const h = rnd(-1.3, 1.7) * k;
        particles.spawn(p.x + d * rnd(-0.6, 1.8) * k * (h > k ? 1.2 : 0.6), p.y + h, rnd(-1.6, 1.6), p.vx * rnd(0.2, 1.1), rnd(-2, 8) * (h > 0.5 * k ? 1 : 0.3), rnd(-2, 2), rnd(0.3, 0.8), rnd(0.4, 0.9), 0, pick(el), rnd(1.4, 2.8), 14, 0.5);
      }
      fx.shake = Math.max(fx.shake, 0.3);
    } else if (p.kind === 'wave') {
      const d = Math.sign(p.vx);
      for (let i = count(240, dt); i > 0; i--) {
        const h = rnd(-1.3, 1.5);
        // Spray peels off the crest and falls behind the wave.
        particles.spawn(p.x + d * rnd(-0.3, 0.9) * (h > 0.6 ? 1.3 : 0.6), p.y + h, rnd(-1.2, 1.2), p.vx * rnd(0.2, 1.1), rnd(-1, 5) * (h > 0.5 ? 1 : 0.3), rnd(-1, 1), rnd(0.25, 0.6), rnd(0.25, 0.55), 0, pick(el), rnd(1.4, 2.6), 12, 0.6);
      }
    } else {
      for (let i = count(200, dt); i > 0; i--) {
        const h = rnd(0, 1);
        const a = rnd(Math.PI * 2);
        const r = 0.35 + h * 1.25;
        const w = 9;
        particles.spawn(p.x + Math.cos(a) * r, p.y - 1.5 + h * 3.2, Math.sin(a) * r, -Math.sin(a) * r * w + p.vx, rnd(2, 5), Math.cos(a) * r * w, rnd(0.2, 0.45), rnd(0.16, 0.34), 0, pick(el), rnd(1.2, 2.2), 0, 2.5);
      }
    }
  }
  for (const s of g.strikes) {
    if (s.done) continue;
    // The telegraph: sparks or frost dropping where it will land, or embers bubbling up for a geyser.
    const up = s.kind === 2;
    const tone = up ? 'fire' : s.kind === 1 ? 'water' : 'lightning';
    for (let i = count(70, dt); i > 0; i--) {
      particles.spawn(s.x + rnd(-0.7, 0.7), up ? rnd(-11, 1) : rnd(0, 16), rnd(-0.4, 0.4), 0, up ? rnd(6, 14) : rnd(-18, -8), 0, rnd(0.12, 0.25), rnd(0.1, 0.2), 0, pick(tone), 2.4, 0, 0);
    }
  }
  for (const p of g.portals) {
    for (const [x, y] of [[p.ax, p.ay], [p.bx, p.by]]) {
      for (let i = count(46, dt); i > 0; i--) {
        const a = rnd(Math.PI * 2);
        particles.spawn(x + Math.cos(a) * 1.05, y + Math.sin(a) * 1.3, 0.2, -Math.sin(a) * 3 - Math.cos(a) * 1.6, Math.cos(a) * 3 - Math.sin(a) * 1.6, 0, rnd(0.25, 0.45), rnd(0.12, 0.24), 0, pick('void'), 2.6, 0, 0);
      }
    }
  }
  for (const w of g.wells) {
    if (w.t > (w.big ? HORIZON_LIFE : WELL_LIFE)) continue;
    // Everything loose spirals into the hole.
    const reach = w.big ? 11 : 4.5;
    for (let i = count(w.big ? 520 : 200, dt); i > 0; i--) {
      const a = rnd(Math.PI * 2);
      const r = rnd(reach * 0.4, reach);
      const sx = w.x + Math.cos(a) * r;
      const sy = w.y + Math.sin(a) * r;
      particles.spawn(sx, sy, rnd(-1, 1), (w.x - sx) * 2.4 - Math.sin(a) * 5, (w.y - sy) * 2.4 + Math.cos(a) * 5, 0, 0.4, rnd(0.14, 0.34), 0.03, pick('void'), rnd(2, 3.4), 0, 0);
    }
    if (w.big) fx.shake = Math.max(fx.shake, 0.3);
  }
  for (const u of g.updrafts) {
    // Streaks of air racing up the column.
    for (let i = count(150, dt); i > 0; i--) {
      particles.spawn(u.x + rnd(-UPDRAFT_HALF, UPDRAFT_HALF), u.y + rnd(0, 7), rnd(-1, 1), rnd(-0.5, 0.5), rnd(11, 19), 0, rnd(0.2, 0.4), rnd(0.12, 0.26), 0, pick('air'), rnd(1, 1.8), 0, 0);
    }
  }
  for (const m of g.mines) {
    for (let i = count(m.t > 0.5 ? 22 : 8, dt); i > 0; i--) {
      particles.spawn(m.x + rnd(-0.3, 0.3), m.y + 0.2, 0.3 + rnd(-0.2, 0.2), rnd(-0.4, 0.4), rnd(0.8, 2.4), 0, rnd(0.3, 0.6), rnd(0.12, 0.24), 0, pick('fire'), 2.4, -1, 0.5);
    }
  }
  for (const pl of g.pillars) {
    if (!pl.erupted) {
      for (let i = count(40, dt); i > 0; i--) {
        particles.spawn(pl.x + rnd(-0.8, 0.8), pl.y + 0.05, rnd(-0.6, 0.6), rnd(-0.5, 0.5), rnd(1, 4), 0, rnd(0.2, 0.4), rnd(0.15, 0.3), 0, pick(pl.el), 2.4, 0, 1);
      }
    }
  }
}

/** Per-frame trail emission. `dt` is scaled game time, so slow motion thins the trails with it. */
export function emitContinuous(g: Game, dt: number): void {
  // Nightmare's darkness closes in while anyone is cursed, and lifts when it ends.
  const cursed = g.fighters[0].confuseT > 0 || g.fighters[1].confuseT > 0;
  fx.dark += ((cursed ? 1 : 0) - fx.dark) * Math.min(1, dt * 5);
  const fried = g.fighters[0].lagT > 0 || g.fighters[1].lagT > 0;
  fx.fry += ((fried ? 1 : 0) - fx.fry) * Math.min(1, dt * 9);
  const raining = g.fighters[0].state === 'dance' || g.fighters[1].state === 'dance';
  fx.rain += ((raining ? 1 : 0) - fx.rain) * Math.min(1, dt * 6);

  if (g.hitstop > 0) return;
  // While an ultimate charges the sim is frozen for everyone but the caster.
  const caster = g.ultCaster();
  if (caster) {
    fighterTrails(caster, g, dt);
    return;
  }
  fighterTrails(g.fighters[0], g, dt);
  fighterTrails(g.fighters[1], g, dt);
  projectileTrails(g, dt);
}

/** Advances timers that run on real time regardless of what the sim is doing. */
export function updateFx(realDt: number): void {
  fx.shake = Math.max(0, fx.shake - realDt * 1.9);
  fx.flash = Math.max(0, fx.flash - realDt * 2.6);
  fx.focusT = Math.max(0, fx.focusT - realDt);
  fx.crit = Math.max(0, fx.crit - realDt * 1.7);
  fx.swagT = Math.max(0, fx.swagT - realDt);
  if (fx.slowT > 0) {
    fx.slowT -= realDt;
    fx.timeScale = fx.slowScale;
  } else {
    fx.timeScale = Math.min(1, fx.timeScale + realDt * 3);
  }
  let w = 0;
  for (const r of fx.rings) {
    r.t += realDt * fx.timeScale;
    if (r.t < r.dur) fx.rings[w++] = r;
  }
  fx.rings.length = w;
  w = 0;
  for (const b of fx.koBeams) {
    b.t += realDt;
    if (b.t < b.dur) fx.koBeams[w++] = b;
  }
  fx.koBeams.length = w;
  w = 0;
  for (const s of fx.scorches) {
    s.t += realDt * fx.timeScale;
    if (s.t < s.dur) fx.scorches[w++] = s;
  }
  fx.scorches.length = w;
  w = 0;
  for (const p of fx.popups) {
    p.t += realDt;
    if (p.t < p.dur) fx.popups[w++] = p;
  }
  fx.popups.length = w;
}

export function resetFx(): void {
  particles.clear();
  fx.rings.length = 0;
  fx.koBeams.length = 0;
  fx.scorches.length = 0;
  fx.popups.length = 0;
  fx.crit = 0;
  fx.dark = 0;
  fx.fry = 0;
  fx.rain = 0;
  fx.swagT = 0;
  fx.shake = 0;
  fx.flash = 0;
  fx.slowT = 0;
  fx.focusT = 0;
  fx.timeScale = 1;
}

/** Sim steps to run for a render frame of `realDt` seconds, carrying the remainder in `acc`. */
export function simSteps(acc: { v: number }, realDt: number): number {
  acc.v += realDt * fx.timeScale;
  let n = Math.floor(acc.v / DT);
  if (n > 8) {
    // The tab was stalled; don't fast-forward the fight.
    n = 8;
    acc.v = 0;
  } else acc.v -= n * DT;
  return n;
}
