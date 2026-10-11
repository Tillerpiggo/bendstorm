import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { fx } from '../fx/fx';
import { MAX_SHIELD, PIANO_SPIN, ULT_CHARGE, type Fighter, type Game } from '../game/sim';
import { groundBelow } from '../game/stage';
import type { ElementId } from '../game/types';
import { fresnelMaterial, hdr } from './materials';

/** The model is built facing +Z; this yaw turns it side-on with a slight lean toward the camera. */
const YAW = Math.PI / 2 - 0.42;
/** Overall model scale. The big-headed build stands about 1.9 tall against a 1.75 hurtbox. */
const SCALE = 0.93;
const THIGH = 0.3;
const SHIN = 0.3;
const HIP_Y = 0.66;

const GEO = {
  torso: new THREE.CapsuleGeometry(0.25, 0.22, 6, 14),
  skirt: new THREE.CylinderGeometry(0.25, 0.39, 0.44, 14),
  sash: new THREE.CylinderGeometry(0.275, 0.285, 0.11, 14),
  knot: new THREE.BoxGeometry(0.11, 0.34, 0.05),
  stripe: new THREE.BoxGeometry(0.12, 0.36, 0.03),
  thigh: new THREE.CapsuleGeometry(0.118, 0.16, 4, 10),
  shin: new THREE.CapsuleGeometry(0.1, 0.16, 4, 10),
  foot: new THREE.BoxGeometry(0.22, 0.13, 0.36),
  upperArm: new THREE.CapsuleGeometry(0.09, 0.13, 4, 10),
  foreArm: new THREE.CapsuleGeometry(0.082, 0.12, 4, 10),
  cuff: new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10),
  hand: new THREE.SphereGeometry(0.135, 12, 10),
  head: new THREE.SphereGeometry(0.33, 22, 16),
  eyeWhite: new THREE.SphereGeometry(0.075, 10, 8),
  pupil: new THREE.SphereGeometry(0.045, 8, 6),
  brow: new THREE.BoxGeometry(0.15, 0.035, 0.04),
  hairCap: new THREE.SphereGeometry(0.348, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  topknot: new THREE.ConeGeometry(0.12, 0.4, 8),
  bun: new THREE.SphereGeometry(0.15, 10, 8),
  collar: new THREE.TorusGeometry(0.25, 0.09, 8, 18),
  hat: new THREE.ConeGeometry(0.66, 0.32, 18),
  shawl: new THREE.ConeGeometry(0.5, 0.36, 14, 1, true),
  mark: new THREE.BoxGeometry(0.09, 0.035, 0.3),
  pad: new THREE.SphereGeometry(0.15, 10, 8),
  shield: new THREE.SphereGeometry(1, 28, 20),
  blob: new THREE.CircleGeometry(0.62, 24),
  pebble: new THREE.DodecahedronGeometry(0.1, 0),
  mote: new THREE.SphereGeometry(0.07, 8, 6),
  spike: new THREE.ConeGeometry(0.1, 0.42, 6),
  visor: new THREE.BoxGeometry(0.5, 0.09, 0.12),
  crest: new THREE.BoxGeometry(0.07, 0.2, 0.5),
  hood: new THREE.SphereGeometry(0.375, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
  halo: new THREE.TorusGeometry(0.26, 0.035, 8, 28),
  ear: new THREE.SphereGeometry(0.17, 12, 10),
  crown: new THREE.CylinderGeometry(0.24, 0.2, 0.14, 12, 1, true),
  chain: new THREE.TorusGeometry(0.27, 0.035, 8, 24),
  coin: new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12),
  box: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14),
};

/** Joint angles. Limbs hang down; a negative shoulder/hip angle swings forward. Bends are always >= 0. */
const KEYS = ['aL', 'aR', 'sL', 'sR', 'eL', 'eR', 'lL', 'lR', 'kL', 'kR', 'lean', 'twist', 'head', 'stretch', 'sit'] as const;
type Key = (typeof KEYS)[number];
type Pose = Record<Key, number> & { spin: boolean };

const newPose = (): Pose => ({ aL: 0, aR: 0, sL: 0, sR: 0, eL: 0, eR: 0, lL: 0, lR: 0, kL: 0, kR: 0, lean: 0, twist: 0, head: 0, stretch: 0, sit: 0, spin: false });

function set(P: Pose, v: Partial<Record<Key, number>>): void {
  Object.assign(P, v);
}

/** Writes the pose this fighter should be heading toward right now. Joints then ease to it. */
function targetPose(f: Fighter, g: Game, t: number, P: Pose): void {
  const breathe = Math.sin(t * 2.4 + f.id * 1.7);
  // Idle bending stance: lead hand up in guard, rear fist at the hip, weight low over bent knees.
  set(P, {
    aL: -1.05 + breathe * 0.05,
    eL: 1.0,
    sL: 0.12,
    aR: 0.25 - breathe * 0.04,
    eR: 1.5,
    sR: -0.22,
    lL: -0.5,
    kL: 0.62,
    lR: 0.38,
    kR: 0.42,
    lean: 0.1,
    twist: 0.32,
    head: -0.05,
    stretch: breathe * 0.012,
    sit: 0,
  });
  P.spin = false;
  const speed = Math.abs(f.vx);

  switch (f.state) {
    case 'free':
      if (f.ground) {
        if (g.winner === f.id) {
          const w = Math.sin(t * 9);
          set(P, { aL: -2.8 + w * 0.25, aR: -2.8 - w * 0.25, eL: 0.3, eR: 0.3, sL: 0.5, sR: -0.5, lL: -0.1, lR: 0.1, kL: 0.3 + Math.abs(w) * 0.5, kR: 0.3 + Math.abs(w) * 0.5, lean: 0, twist: 0, head: -0.3 });
        } else if (speed > 1) {
          const p = f.runPhase * 1.15;
          const k = Math.min(1, speed / 6);
          const s = Math.sin(p);
          const c = Math.cos(p);
          set(P, {
            lL: s * 1.0 * k - 0.1,
            lR: -s * 1.0 * k - 0.1,
            // The knee folds as each leg swings through behind the body.
            kL: 0.3 + Math.max(0, c) * 1.3 * k,
            kR: 0.3 + Math.max(0, -c) * 1.3 * k,
            aL: -s * 1.0 * k - 0.15,
            aR: s * 1.0 * k - 0.15,
            eL: 1.4,
            eR: 1.4,
            sL: 0.15,
            sR: -0.15,
            lean: 0.34 * k,
            twist: s * 0.25 * k,
            head: -0.2 * k,
          });
        }
      } else if (f.vy > 0) {
        set(P, { lL: -1.0, kL: 1.5, lR: 0.35, kR: 0.6, aL: -2.6, eL: 0.35, aR: 0.7, eR: 0.7, sL: 0.2, sR: -0.3, lean: 0.12, twist: 0.1, head: -0.25, stretch: 0.08 });
      } else {
        set(P, { lL: -0.35, kL: 0.6, lR: 0.25, kR: 0.85, aL: -0.4, aR: -0.4, eL: 0.45, eR: 0.45, sL: 1.45, sR: -1.45, lean: -0.06, twist: 0, head: 0.15 });
      }
      break;
    case 'hitstun':
      set(P, { aL: -2.2, aR: -1.0, sL: 0.9, sR: -0.9, eL: 0.5, eR: 0.9, lL: -0.9, kL: 1.0, lR: 0.6, kR: 0.5, lean: -0.35, twist: 0, head: -0.5 });
      break;
    case 'shield':
      set(P, { aL: -1.3, aR: -1.3, eL: 1.55, eR: 1.55, sL: -0.55, sR: 0.55, lL: -0.55, kL: 1.0, lR: 0.45, kR: 1.0, lean: 0.18, twist: 0, head: 0.15 });
      break;
    case 'stunned': {
      const w = Math.sin(t * 7);
      set(P, { aL: 0.1 + w * 0.2, aR: 0.1 - w * 0.2, eL: 0.2, eR: 0.2, sL: 0.3, sR: -0.3, lL: -0.2, kL: 0.6, lR: 0.2, kR: 0.6, lean: w * 0.25, twist: w * 0.2, head: 0.35 + w * 0.2 });
      break;
    }
    case 'dash':
      set(P, { lean: 0.95, aL: 1.2, aR: 1.3, eL: 0.2, eR: 0.3, sL: 0.3, sR: -0.3, lL: -1.05, kL: 0.5, lR: 0.9, kR: 1.3, twist: 0, head: -0.6, stretch: 0.1 });
      break;
    case 'ult':
      if (f.stateT < ULT_CHARGE) {
        set(P, { aL: -0.4, aR: -0.4, sL: 1.9, sR: -1.9, eL: 0.3, eR: 0.3, lL: -0.15, kL: 0.5, lR: 0.2, kR: 0.75, lean: -0.3, twist: 0, head: -0.45 });
      } else if (f.el.id === 'fire') {
        set(P, { aL: -1.5, aR: -1.62, eL: 0.05, eR: 0.05, sL: -0.15, sR: 0.15, lL: -0.75, kL: 0.8, lR: 0.7, kR: 0.3, lean: 0.25, twist: 0, head: -0.1 });
      } else if (f.el.id === 'water') {
        set(P, { aL: -2.5, aR: -2.3, eL: 0.2, eR: 0.2, sL: 0.5, sR: -0.5, lL: -0.6, kL: 0.7, lR: 0.6, kR: 0.4, lean: 0.2, twist: 0, head: -0.3 });
      } else if (f.el.id === 'earth') {
        set(P, { aL: -0.6, aR: -0.6, eL: 0.25, eR: 0.25, sL: 0.5, sR: -0.5, lL: -1.05, kL: 1.7, lR: 0.3, kR: 1.6, lean: 0.5, twist: 0, head: 0.1 });
      } else if (f.el.id === 'air') {
        set(P, { aL: -0.3, aR: -0.3, eL: 0.2, eR: 0.2, sL: 1.6, sR: -1.6, lL: -0.2, kL: 0.5, lR: 0.2, kR: 0.7, lean: 0, twist: 0, head: -0.3 });
        P.spin = true;
      } else if (f.el.id === 'metal') {
        // Arms wide while it pulls, then clapped together with the plates.
        const shut = f.ultT() > 0.88;
        set(P, { aL: -1.5, aR: -1.5, eL: 0.1, eR: 0.1, sL: shut ? -0.35 : 1.3, sR: shut ? 0.35 : -1.3, lL: -0.7, kL: 0.8, lR: 0.7, kR: 0.4, lean: 0.2, twist: 0, head: -0.1 });
      } else {
        // Conducting it: both hands raised and open.
        set(P, { aL: -2.6, aR: -2.6, eL: 0.4, eR: 0.4, sL: 0.7, sR: -0.7, lL: -0.2, kL: 0.5, lR: 0.2, kR: 0.7, lean: -0.15, twist: 0, head: -0.5 });
      }
      break;
    case 'taunt': {
      const beat = Math.sin(t * 7);
      if (f.tauntKind === 2) {
        // Lying back with a hand behind the head, one knee up, the other hand waving them over.
        set(P, { lean: -1.42, sit: 0.72, aL: -2.7, eL: 2.3, sL: 0.5, aR: -1.2 + Math.sin(t * 5) * 0.35, eR: 0.5, sR: -0.3, lL: -1.75, kL: 1.5, lR: -1.45 + beat * 0.05, kR: 0.05, twist: 0, head: 0.5 });
      } else if (f.tauntKind === 1) {
        // Pointing straight at them, doubled over laughing.
        const laugh = Math.sin(t * 19);
        set(P, { aR: -1.55, eR: 0.02, sR: -0.05, aL: -0.5, eL: 1.9, sL: -0.3, lL: -0.4, kL: 0.5, lR: 0.3, kR: 0.4, lean: -0.22 + laugh * 0.07, twist: -0.3, head: -0.45 + laugh * 0.12, stretch: laugh * 0.04 });
      } else {
        // Facing the crowd: one hand on the hip, blowing across the fingertips of the other, hips swaying.
        set(P, { aR: -2.25, eR: 2.3, sR: -0.2, aL: 0.35, eL: 1.7, sL: 0.75, lL: -0.12 + beat * 0.1, kL: 0.3, lR: 0.12 + beat * 0.1, kR: 0.15, lean: -0.1, twist: beat * 0.3, head: -0.2 - Math.abs(beat) * 0.12, stretch: Math.abs(beat) * 0.03 });
      }
      break;
    }
    case 'dance': {
      // Bust Down: bent over, hands on knees, back to the crowd, and shaking it.
      const shake = Math.sin(t * 24);
      set(P, { lean: 1.0, aL: -0.5, aR: -0.5, eL: 0.35, eR: 0.35, sL: 0.3, sR: -0.3, lL: -0.95, kL: 1.35, lR: -0.8, kR: 1.2, twist: shake * 0.55, head: -0.7, stretch: Math.abs(shake) * 0.05, sit: 0 });
      break;
    }
    case 'ledge':
      // Hanging by the fingertips, feet dangling, looking up at the stage.
      set(P, { aL: -3.0, aR: -3.05, eL: 0.06, eR: 0.06, sL: 0.12, sR: -0.12, lL: -0.2 + breathe * 0.08, kL: 0.45, lR: 0.12 - breathe * 0.08, kR: 0.65, lean: 0.14, twist: 0, head: -0.55, stretch: 0.06 });
      break;
    case 'climb':
      set(P, { aL: -0.7, aR: -0.7, eL: 1.3, eR: 1.3, sL: 0.3, sR: -0.3, lL: -1.3, kL: 1.7, lR: -0.6, kR: 1.5, lean: 0.5, twist: 0, head: -0.2 });
      break;
    case 'move':
      movePose(f, P);
      break;
    case 'dead':
      break;
  }
}

function movePose(f: Fighter, P: Pose): void {
  const m = f.move;
  if (!m) return;
  const t = m.t;
  switch (m.kind) {
    case 'bolt':
      set(P, { lL: -0.75, kL: 0.85, lR: 0.65, kR: 0.18, lean: 0.25 });
      if (t < f.el.bolt.startup) {
        // Coil: striking arm drawn back, lead hand out.
        set(P, { aR: 0.9, eR: 1.7, aL: -1.25, eL: 0.6, twist: 0.6 });
      } else {
        // Snap: straight arm through the hips.
        set(P, { aR: m.aim ? -2.2 : -1.6, eR: 0.02, aL: 0.5, eL: 1.6, twist: -0.55, head: m.aim ? -0.4 : -0.05 });
      }
      break;
    case 'rise':
      set(P, { aR: -2.95, eR: 0.08, aL: 0.4, eL: 1.5, sL: 0.2, sR: -0.1, lL: -0.2, kL: 0.2, lR: 0.3, kR: 0.5, lean: -0.22, twist: -0.4, head: -0.5, stretch: 0.12 });
      break;
    case 'sweep':
      if (t < 0.12) set(P, { aL: -2.8, aR: -2.8, eL: 0.3, eR: 0.3, lL: -0.4, kL: 0.5, lR: 0.4, kR: 0.5, twist: 0 });
      else set(P, { aL: -0.9, aR: -0.9, sL: 0.95, sR: -0.95, eL: 0.2, eR: 0.2, lL: -1.05, kL: 1.4, lR: 0.9, kR: 1.1, lean: 0.55, twist: 0, head: 0.2 });
      break;
    case 'dive':
      if (m.landed) set(P, { aL: -0.4, aR: -0.4, sL: 1.1, sR: -1.1, eL: 0.3, eR: 0.3, lL: -1.15, kL: 1.9, lR: 0.3, kR: 1.75, lean: 0.35, twist: 0, head: 0.2 });
      else if (t < 0.13) set(P, { lL: -1.35, kL: 1.9, lR: -1.2, kR: 1.8, aL: -2.8, aR: -2.8, eL: 0.4, eR: 0.4, lean: 0.1, twist: 0 });
      else set(P, { lL: 0.12, kL: 0.02, lR: -1.25, kR: 1.9, aL: -2.6, aR: -2.6, sL: 0.4, sR: -0.4, eL: 0.2, eR: 0.2, lean: -0.05, twist: 0, head: 0.3, stretch: 0.16 });
      break;
    case 'recover':
      set(P, { aL: 0.6, aR: 0.6, eL: 0.1, eR: 0.1, sL: 0.5, sR: -0.5, lL: 0.05, kL: 0.2, lR: 0.2, kR: 0.5, lean: 0, twist: 0, head: -0.5, stretch: 0.16 });
      P.spin = f.el.id === 'air' || f.el.id === 'water';
      break;
    case 'spcSide':
      switch (f.el.id) {
        case 'fire':
          // Braced, both palms out, pouring fire.
          set(P, { aL: -1.5, aR: -1.65, eL: 0.05, eR: 0.05, sL: -0.2, sR: 0.2, lL: -0.8, kL: 0.85, lR: 0.75, kR: 0.3, lean: 0.2, twist: 0, head: -0.05 });
          break;
        case 'water':
          if (t < 0.16) set(P, { aR: 1.4, eR: 1.2, aL: -1.0, eL: 0.6, twist: 0.7, lean: -0.05 });
          else set(P, { aR: -1.55, eR: 0.02, aL: 0.6, eL: 1.4, sR: -0.05, lL: -0.8, kL: 0.85, lR: 0.7, kR: 0.2, twist: -0.6, lean: 0.3 });
          break;
        case 'earth':
          if (t < 0.2) set(P, { aL: -0.5, aR: -0.5, eL: 0.4, eR: 0.4, lL: -0.9, kL: 1.4, lR: 0.6, kR: 1.2, lean: 0.45, twist: 0 });
          else set(P, { aL: -2.5, aR: -2.5, eL: 0.5, eR: 0.5, sL: 0.2, sR: -0.2, lL: -0.7, kL: 0.8, lR: 0.7, kR: 0.5, lean: -0.1, twist: 0, head: -0.3 });
          break;
        case 'air':
          set(P, { aL: -1.5, aR: -1.5, eL: 0.03, eR: 0.03, sL: 0.25, sR: -0.25, lL: -0.8, kL: 0.8, lR: 0.8, kR: 0.25, lean: 0.34, twist: 0, head: -0.1 });
          break;
        case 'tyler':
          // Round and round with a piano overhead, then let go.
          if (t < PIANO_SPIN) {
            set(P, { aL: -2.9, aR: -2.9, eL: 0.4, eR: 0.4, sL: 0.6, sR: -0.6, lL: -0.5, kL: 0.8, lR: 0.5, kR: 0.8, lean: 0, twist: 0 });
            P.spin = true;
          } else set(P, { aL: -1.5, aR: -1.5, eL: 0.05, eR: 0.05, lL: -0.9, kL: 0.9, lR: 0.8, kR: 0.2, lean: 0.5, twist: 0 });
          break;
        default:
          // One arm whipped out across the body.
          if (t < 0.14) set(P, { aR: 1.2, eR: 1.4, aL: -1.1, eL: 0.7, twist: 0.7 });
          else set(P, { aR: -1.6, eR: 0.02, aL: 0.6, eL: 1.5, lL: -0.8, kL: 0.85, lR: 0.7, kR: 0.2, twist: -0.6, lean: 0.28 });
          break;
      }
      break;
    case 'spcDown':
      switch (f.el.id) {
        case 'fire':
          // Kneel and press a palm to the ground.
          set(P, { aR: -0.75, eR: 0.15, aL: 0.5, eL: 1.3, sR: -0.1, lL: -1.2, kL: 1.9, lR: 0.35, kR: 1.75, lean: 0.55, twist: 0, head: 0.3 });
          break;
        case 'water':
          set(P, { aL: -2.5, aR: -2.5, eL: 0.6, eR: 0.6, sL: 0.9, sR: -0.9, lL: -0.3, kL: 0.5, lR: 0.3, kR: 0.5, lean: -0.1, twist: 0, head: -0.5 });
          break;
        case 'earth':
          if (m.fired) set(P, { aL: -0.5, aR: -0.5, eL: 0.3, eR: 0.3, sL: 0.8, sR: -0.8, lL: -1.1, kL: 1.6, lR: 0.9, kR: 1.4, lean: 0.4, twist: 0, head: 0.2 });
          else set(P, { lL: -1.6, kL: 1.8, lR: 0.1, kR: 0.3, aL: -2.4, aR: -2.4, eL: 1.0, eR: 1.0, lean: 0.05, twist: 0, stretch: 0.08 });
          break;
        case 'air':
          set(P, { aL: -2.3, aR: -2.3, eL: 0.2, eR: 0.2, sL: 1.1, sR: -1.1, lL: -0.3, kL: 0.5, lR: 0.3, kR: 0.6, lean: -0.1, twist: 0, head: -0.4 });
          P.spin = true;
          break;
        case 'lightning':
          // One hand thrown at the sky, calling it down.
          set(P, { aR: -3.0, eR: 0.05, sR: -0.1, aL: 0.3, eL: 1.4, lL: -0.5, kL: 0.6, lR: 0.4, kR: 0.4, lean: -0.12, twist: 0, head: -0.6 });
          break;
        case 'metal':
          // Fists crossed over the chest as the plating locks.
          set(P, { aL: -1.3, aR: -1.3, eL: 1.9, eR: 1.9, sL: -0.6, sR: 0.6, lL: -0.5, kL: 0.7, lR: 0.5, kR: 0.7, lean: 0.1, twist: 0, head: 0.1 });
          break;
        default:
          // Kneel, palm to the floor.
          set(P, { aR: -0.75, eR: 0.15, aL: 0.5, eL: 1.3, sR: -0.1, lL: -1.2, kL: 1.9, lR: 0.35, kR: 1.75, lean: 0.55, twist: 0, head: 0.3 });
          break;
      }
      break;
    case 'special':
      switch (f.el.id) {
        case 'fire':
          if (t < 0.13) set(P, { lL: -1.0, kL: 1.5, lR: 0.4, kR: 1.4, aL: 1.0, aR: 1.0, eL: 1.0, eR: 1.0, lean: 0.4, twist: 0 });
          else if (t < 0.42) set(P, { lean: 1.25, aL: -3.0, aR: -3.0, eL: 0.02, eR: 0.02, sL: 0.15, sR: -0.15, lL: 0.2, lR: 0.3, kL: 0.1, kR: 0.3, twist: 0, head: -0.9, stretch: 0.15 });
          break;
        case 'water':
          if (t < 0.2) set(P, { aL: 0.8, aR: 0.8, eL: 0.5, eR: 0.5, sL: 0.5, sR: -0.5, lean: -0.1, twist: 0.5 });
          else set(P, { aL: -1.8, aR: -1.9, eL: 0.15, eR: 0.15, sL: 0.5, sR: -0.5, lL: -0.8, kL: 0.9, lR: 0.7, kR: 0.3, lean: 0.32, twist: -0.3 });
          break;
        case 'earth':
          if (t < 0.18) set(P, { lL: -1.5, kL: 1.7, lR: 0.1, kR: 0.4, aL: -0.4, aR: -0.4, eL: 1.3, eR: 1.3, lean: 0.1, twist: 0 });
          else set(P, { aL: -2.7, aR: -2.7, eL: 0.3, eR: 0.3, sL: 0.3, sR: -0.3, lL: -0.85, kL: 1.05, lR: 0.8, kR: 0.95, lean: -0.05, twist: 0, head: -0.3 });
          break;
        case 'air':
          set(P, { aL: -0.3, aR: -0.3, eL: 0.15, eR: 0.15, sL: 1.55, sR: -1.55, lL: -0.3, kL: 0.5, lR: 0.3, kR: 0.6, lean: 0.05, twist: 0 });
          P.spin = true;
          break;
        case 'lightning':
          // Coiled before the blink, mid-swing after it.
          if (t < 0.14) set(P, { lL: -1.0, kL: 1.5, lR: 0.4, kR: 1.4, aL: 0.8, aR: 0.8, eL: 1.2, eR: 1.2, lean: 0.4 });
          else set(P, { aR: -1.7, eR: 0.02, aL: 0.7, eL: 1.5, lL: -0.8, kL: 0.8, lR: 0.7, kR: 0.2, twist: -0.65, lean: 0.3 });
          break;
        case 'metal':
          // Reaching for the cable, then flying along it fist first.
          if (!m.fired) set(P, { aR: -1.6, eR: 0.05, aL: 0.4, eL: 1.4, twist: -0.3, lean: 0.15 });
          else set(P, { lean: 1.15, aR: -3.0, eR: 0.02, aL: 0.9, eL: 0.4, lL: 0.25, lR: 0.35, kL: 0.1, kR: 0.5, twist: 0, head: -0.8, stretch: 0.1 });
          break;
        default:
          // Both palms pressed out: a doorway, or a trade.
          set(P, { aL: -1.5, aR: -1.5, eL: 0.4, eR: 0.4, sL: 0.5, sR: -0.5, lL: -0.6, kL: 0.7, lR: 0.5, kR: 0.4, lean: 0.12, twist: 0, head: -0.1 });
          break;
      }
      break;
  }
}

/** A small "P1"-style tag that floats over the fighter's head. */
function makeTag(label: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = 'italic 800 64px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(8, 6, 24, 0.9)';
  ctx.strokeText(label, 96, 46);
  ctx.fillStyle = color;
  ctx.fillText(label, 96, 46);
  ctx.beginPath();
  ctx.moveTo(78, 88);
  ctx.lineTo(114, 88);
  ctx.lineTo(96, 114);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let blobTex: THREE.CanvasTexture | null = null;
/** Soft round shadow, dark in the middle and fading out. */
function blobTexture(): THREE.CanvasTexture {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

function HeadGear({ el, hair, trim, glow }: { el: ElementId; hair: THREE.Material; trim: THREE.Material; glow: THREE.Material }) {
  switch (el) {
    case 'fire':
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          <mesh geometry={GEO.topknot} material={hair} position={[0, 0.48, -0.04]} />
          <mesh geometry={GEO.sash} material={trim} position={[0, 0.32, -0.04]} scale={[0.44, 0.6, 0.44]} />
        </>
      );
    case 'water':
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          <mesh geometry={GEO.bun} material={hair} position={[0, 0.16, -0.34]} />
          <mesh geometry={GEO.mote} material={trim} position={[0.3, -0.02, 0.08]} scale={[0.9, 2.4, 0.9]} />
          <mesh geometry={GEO.mote} material={trim} position={[-0.3, -0.02, 0.08]} scale={[0.9, 2.4, 0.9]} />
        </>
      );
    case 'earth':
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          <mesh geometry={GEO.hat} material={trim} position={[0, 0.36, 0]} />
        </>
      );
    case 'air':
      return <mesh geometry={GEO.mark} material={glow} position={[0, 0.29, 0.14]} rotation={[0.5, 0, 0]} />;
    case 'lightning':
      // Wind-swept spikes and a glowing visor.
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          {[-0.16, 0, 0.16].map((x, i) => (
            <mesh key={i} geometry={GEO.spike} material={hair} position={[x, 0.36 - Math.abs(x) * 0.5, -0.16]} rotation={[-0.75, 0, -x * 2]} />
          ))}
          <mesh geometry={GEO.visor} material={glow} position={[0, 0.035, 0.27]} />
        </>
      );
    case 'metal':
      // A steel helm with a copper crest.
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.03, -0.02]} scale={1.04} />
          <mesh geometry={GEO.crest} material={trim} position={[0, 0.4, -0.04]} />
          <mesh geometry={GEO.visor} material={hair} position={[0, 0.17, 0.27]} scale={[1.05, 0.7, 1]} />
        </>
      );
    case 'shadow':
      // A deep hood, pulled forward.
      return (
        <>
          <mesh geometry={GEO.hood} material={hair} position={[0, 0.0, -0.045]} rotation={[0.28, 0, 0]} />
          <mesh geometry={GEO.spike} material={hair} position={[0, 0.2, -0.36]} rotation={[-1.9, 0, 0]} scale={[1.6, 1, 1.6]} />
        </>
      );
    case 'tyler':
      // Monkey: a cap of fur, a tuft, and ears far too big for the head.
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.04]} />
          <mesh geometry={GEO.spike} material={hair} position={[0, 0.4, 0.02]} rotation={[0.3, 0, 0]} scale={[1.1, 0.7, 1.1]} />
          {[1, -1].map((x) => (
            <group key={x}>
              <mesh geometry={GEO.ear} material={hair} position={[x * 0.36, 0.06, -0.02]} scale={[0.5, 1, 1]} />
              <mesh geometry={GEO.ear} material={trim} position={[x * 0.385, 0.06, 0.0]} scale={[0.3, 0.62, 0.62]} />
            </group>
          ))}
          <mesh geometry={GEO.ear} material={trim} position={[0, -0.11, 0.24]} scale={[1.05, 0.7, 0.6]} />
        </>
      );
    case 'cash':
      // A tilted gold crown, dark shades, and a chain that could anchor a ship.
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          <group position={[0.06, 0.37, -0.02]} rotation={[0.05, 0, -0.22]}>
            <mesh geometry={GEO.crown} material={glow} />
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} geometry={GEO.spike} material={glow} position={[Math.cos((i / 5) * Math.PI * 2) * 0.22, 0.14, Math.sin((i / 5) * Math.PI * 2) * 0.22]} scale={[0.5, 0.4, 0.5]} />
            ))}
          </group>
          <mesh geometry={GEO.visor} material={hair} position={[0, 0.035, 0.28]} scale={[1.02, 1.2, 1]} />
          <mesh geometry={GEO.chain} material={glow} position={[0, -0.42, 0.06]} rotation={[Math.PI / 2 - 0.5, 0, 0]} />
          <mesh geometry={GEO.coin} material={glow} position={[0, -0.6, 0.24]} rotation={[Math.PI / 2, 0, 0]} scale={1.5} />
        </>
      );
    case 'void':
      // Pale hair and a ring of light hanging over the head.
      return (
        <>
          <mesh geometry={GEO.hairCap} material={hair} position={[0, 0.02, -0.03]} />
          <mesh geometry={GEO.bun} material={hair} position={[0, -0.02, -0.33]} scale={[0.9, 1.5, 0.8]} />
          <mesh geometry={GEO.halo} material={glow} position={[0, 0.56, 0]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
        </>
      );
  }
}

const SCARF_N = 9;
const SCARF_SEG = 0.15;

interface Props {
  game: Game;
  slot: 0 | 1;
  label: string;
  labelColor: string;
  /** Second fighter of a mirror match: shift the palette so the two read apart. */
  alt: boolean;
}

export function FighterModel({ game, slot, label, labelColor, alt }: Props) {
  const f = game.fighters[slot];
  const el = f.el;

  const root = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const shield = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const tag = useRef<THREE.Sprite>(null);
  const blob = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const scarf = useRef<THREE.Mesh>(null);

  const mats = useMemo(() => {
    const robeColor = new THREE.Color(el.robe);
    const trimColor = new THREE.Color(el.trim);
    if (alt) {
      robeColor.lerp(new THREE.Color('#1b1630'), 0.55);
      trimColor.lerp(new THREE.Color('#ffffff'), 0.5);
    }
    const std = (c: THREE.Color | string, rough = 0.78) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: rough, emissive: '#ffffff', emissiveIntensity: 0 });
    return {
      robe: std(robeColor),
      trim: std(trimColor, 0.6),
      skin: std(el.skin, 0.7),
      hair: std(el.hair, 0.9),
      // The monkey's hands and feet are the same dark brown as his ears.
      shoe: std(el.id === 'tyler' ? el.hair : '#2a2233', 0.9),
      hand: new THREE.MeshStandardMaterial({ color: el.id === 'tyler' ? el.hair : el.skin, roughness: 0.6, emissive: el.id === 'cash' ? el.trim : el.color, emissiveIntensity: 0.4 }),
      white: new THREE.MeshBasicMaterial({ color: '#f4f0ea' }),
      pupil: new THREE.MeshBasicMaterial({ color: '#17121f' }),
      glow: new THREE.MeshBasicMaterial({ color: hdr(el.id === 'cash' ? el.trim : el.color, el.id === 'cash' ? 1.9 : 2.2) }),
      car: new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.2, metalness: 1, emissive: '#ffb300', emissiveIntensity: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: '#10131c', roughness: 0.1, metalness: 0.6 }),
      pebble: new THREE.MeshStandardMaterial({ color: '#8b7a66', roughness: 1, flatShading: true }),
      // For the monkey the ribbon is his tail.
      scarf: new THREE.MeshStandardMaterial({ color: el.id === 'tyler' ? el.hair : trimColor, roughness: 0.8, side: THREE.DoubleSide, emissive: el.color, emissiveIntensity: el.id === 'tyler' ? 0 : 0.12 }),
      shield: fresnelMaterial(new THREE.Color(el.color), 0.07, 2.0, 2.0),
      blob: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: '#000000' }),
      tag: new THREE.SpriteMaterial({ map: makeTag(label, labelColor), depthTest: false, transparent: true }),
    };
  }, [el, alt, label, labelColor]);

  useEffect(
    () => () => {
      mats.tag.map?.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
    [mats],
  );

  useEffect(() => {
    rig.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }, []);

  // The scarf is a little rope simulated in world space and drawn as a ribbon.
  const cloth = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SCARF_N * 2 * 3);
    const nrm = new Float32Array(SCARF_N * 2 * 3);
    for (let i = 0; i < SCARF_N * 2; i++) nrm[i * 3 + 2] = 1;
    const idx: number[] = [];
    for (let i = 0; i < SCARF_N - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    return { geo, pos, p: new Float32Array(SCARF_N * 3), prev: new Float32Array(SCARF_N * 3), ready: false };
  }, []);
  useEffect(() => () => cloth.geo.dispose(), [cloth]);

  const anim = useRef({ pose: newPose(), target: newPose(), yaw: (slot === 0 ? 1 : -1) * YAW, tumble: 0, spin: 0, hand: 0.4, drop: 0, flip: 0, melt: 0 });
  const steel = useMemo(() => new THREE.Color('#b7c6d4'), []);
  const gold = useMemo(() => new THREE.Color('#ffcf3a'), []);
  const base = useMemo(() => ({ robe: mats.robe.color.clone(), skin: mats.skin.color.clone(), trim: mats.trim.color.clone(), hair: mats.hair.color.clone(), hand: mats.hand.color.clone() }), [mats]);
  const car = useRef<THREE.Group>(null);
  // The monkey is little.
  const size = el.id === 'tyler' ? SCALE * 0.84 : SCALE;
  const eyeDark = useMemo(() => new THREE.Color('#17121f'), []);
  const eyeLit = useMemo(() => hdr(el.glow, 4), [el]);
  const motes = el.id === 'fire' || el.id === 'void' ? 2 : 3;
  const moteGeo = el.id === 'earth' ? GEO.pebble : el.id === 'cash' ? GEO.coin : GEO.mote;

  useFrame((state, delta) => {
    const g = root.current;
    if (!g || !turn.current || !body.current || !rig.current || !upper.current) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const a = anim.current;

    const dead = f.state === 'dead';
    // Blink through respawn invulnerability, but not through a dash's few i-frames.
    const blink = f.invuln > 0 && f.state !== 'ult' && f.state !== 'dash' && Math.floor(t * 16) % 2 === 0;
    g.visible = !dead && !blink;
    if (scarf.current) scarf.current.visible = g.visible;
    if (blob.current) blob.current.visible = !dead;
    if (dead) {
      if (light.current) light.current.intensity = 0;
      cloth.ready = false;
      return;
    }

    g.position.set(f.x, f.y, 0);
    const caster = game.ultCaster();
    const frozen = game.hitstop > 0 || (caster !== null && caster !== f);
    if (game.hitstop > 0 && f.state === 'hitstun') g.position.x += Math.sin(t * 130) * 0.07;

    const P = a.pose;
    // A gold statue holds whatever pose it was caught in.
    const statue = f.goldT > 0;
    if (!frozen && !statue) {
      const T = a.target;
      targetPose(f, game, t, T);
      const k = 1 - Math.exp(-dt * 26);
      for (const key of KEYS) P[key] += (T[key] - P[key]) * k;

      // The signature taunt turns to face the crowd; everything else stays side-on.
      const yawTo = f.state === 'dance' ? f.facing * (Math.PI - 0.5) : f.state === 'taunt' && f.tauntKind === 0 ? f.facing * 0.22 : f.facing * YAW;
      a.yaw += (yawTo - a.yaw) * (1 - Math.exp(-dt * 18));
      a.flip += ((f.gravFlipT > 0 ? Math.PI : 0) - a.flip) * (1 - Math.exp(-dt * 10));
      a.melt += ((f.sunk() ? 1 : 0) - a.melt) * (1 - Math.exp(-dt * 22));
      if (T.spin) a.spin += dt * 24;
      else {
        a.spin = Math.atan2(Math.sin(a.spin), Math.cos(a.spin));
        a.spin *= Math.exp(-dt * 14);
      }

      if (f.state === 'hitstun' && !f.ground) {
        const sp = Math.hypot(f.vx, f.vy);
        a.tumble += dt * Math.sign(f.vx * f.facing || 1) * -(4 + sp * 0.45);
      } else {
        a.tumble = Math.atan2(Math.sin(a.tumble), Math.cos(a.tumble));
        a.tumble *= Math.exp(-dt * 16);
      }

      const active = f.state === 'move' || f.state === 'ult' || f.state === 'dash';
      a.hand += ((active ? 5 : f.meter >= 100 ? 2.2 : 0.5) - a.hand) * (1 - Math.exp(-dt * 16));

      // Stand on whichever leg reaches lower: the hips sink as the knees bend, so feet stay planted.
      const reach = (hip: number, knee: number) => THIGH * Math.cos(hip) + SHIN * Math.cos(hip + knee);
      const want = f.ground ? THIGH + SHIN - Math.max(reach(P.lL, P.kL), reach(P.lR, P.kR)) : 0;
      a.drop += (want - a.drop) * (1 - Math.exp(-dt * 30));
    }

    turn.current.rotation.y = a.yaw + a.spin;
    body.current.rotation.x = P.lean + a.tumble;
    // Gravity Flip turns the fighter upside down about their middle.
    body.current.rotation.z = a.flip;
    // Squash on landing, stretch on fast vertical motion.
    const squash = f.ground ? Math.max(0, 1 - f.landT * 7) * Math.min(0.3, f.landPow * 0.013) : 0;
    const sy = 1 + P.stretch - squash;
    const sx = 1 / Math.sqrt(Math.max(0.5, sy));
    // Sink flattens the fighter into a puddle; a blink thins them to a sliver for an instant.
    const m = f.move;
    const blinking = f.state === 'move' && !!m && m.kind === 'special' && el.id === 'lightning' && m.t > 0.05 && m.t < 0.2;
    const thin = blinking ? 0.06 : 1;
    const flat = 1 - a.melt * 0.96;
    rig.current.scale.set(sx * size * thin * (1 + a.melt * 0.5), sy * size * flat, sx * size * thin * (1 + a.melt * 0.5));
    rig.current.position.y = -0.95 - a.drop * size - P.sit;
    // Joyride: Kash is in the car, so draw the car instead of him.
    const driving = f.state === 'move' && !!m && m.kind === 'spcSide' && el.id === 'cash' && m.fired && !m.landed;
    rig.current.visible = !driving;
    if (car.current) {
      car.current.visible = driving;
      if (driving) {
        car.current.position.y = 0.34 + Math.sin(t * 60) * 0.015;
        for (let i = 2; i < 6; i++) car.current.children[i].rotation.x = t * 30;
      }
    }
    upper.current.rotation.y = P.twist;
    head.current!.rotation.x = P.head;
    armL.current!.rotation.set(P.aL, 0, P.sL);
    armR.current!.rotation.set(P.aR, 0, P.sR);
    elbowL.current!.rotation.x = -P.eL;
    elbowR.current!.rotation.x = -P.eR;
    legL.current!.rotation.x = P.lL;
    legR.current!.rotation.x = P.lR;
    kneeL.current!.rotation.x = P.kL;
    kneeR.current!.rotation.x = P.kR;

    const flash = f.flashT > 0 ? f.flashT * 9 : 0;
    // Iron Skin plates the whole fighter in steel while it lasts.
    const plated = f.armorT > 0 && el.id === 'metal';
    const shiny = plated || statue;
    mats.robe.metalness = mats.skin.metalness = mats.trim.metalness = mats.hair.metalness = mats.hand.metalness = statue ? 1 : plated ? 0.9 : 0;
    mats.robe.roughness = shiny ? 0.26 : 0.78;
    mats.skin.roughness = shiny ? 0.28 : 0.7;
    mats.robe.color.copy(statue ? gold : plated ? steel : base.robe);
    mats.skin.color.copy(statue ? gold : plated ? steel : base.skin);
    mats.trim.color.copy(statue ? gold : base.trim);
    mats.hair.color.copy(statue ? gold : base.hair);
    mats.hand.color.copy(statue ? gold : base.hand);
    mats.robe.emissiveIntensity = flash;
    mats.skin.emissiveIntensity = flash * 0.6;
    mats.trim.emissiveIntensity = flash;
    mats.hand.emissiveIntensity = a.hand;
    const ult = f.state === 'ult';
    mats.pupil.color.copy(ult || f.meter >= 100 ? eyeLit : eyeDark);
    mats.white.color.set(ult ? '#ffffff' : '#f4f0ea');

    if (shield.current) {
      const up = f.state === 'shield';
      shield.current.visible = up;
      if (up) shield.current.scale.setScalar(0.8 + 0.6 * (f.shieldHp / MAX_SHIELD) + Math.sin(t * 30) * 0.015);
    }
    if (light.current) {
      const base = ult ? 40 : f.meter >= 100 ? 14 + Math.sin(t * 9) * 4 : 6;
      light.current.intensity = base + a.hand * 2;
    }
    if (tag.current) {
      tag.current.position.set(0, 2.62 + Math.sin(t * 3 + slot) * 0.04, 0);
      // The tag is noise once both players know who is who; keep it faint mid-fight.
      mats.tag.opacity = game.introT > 0 || f.invuln > 0 || fx.timeScale < 0.9 ? 1 : 0.6;
    }

    // Contact shadow on whatever is underneath, shrinking with height.
    if (blob.current) {
      const p = groundBelow(game.stage, f.x, f.y + 0.2);
      if (!p) blob.current.visible = false;
      else {
        const h = f.y - p.y;
        const s = Math.max(0.35, 1 - h * 0.09);
        blob.current.position.set(f.x, p.y + 0.02, 0.1);
        blob.current.scale.set(s * 1.25, s, 1);
        mats.blob.opacity = 0.75 * s;
      }
    }

    // Little tokens of the element circling the bender.
    if (orbit.current) {
      const calm = f.state === 'free' || f.state === 'move' || f.state === 'shield' || f.state === 'ledge';
      orbit.current.visible = calm;
      const fast = el.id === 'air' ? 4.5 : 2.2;
      for (let i = 0; i < orbit.current.children.length; i++) {
        const c = orbit.current.children[i];
        const ang = t * fast + (i * Math.PI * 2) / orbit.current.children.length + slot;
        c.position.set(Math.cos(ang) * 0.8, 1.05 + Math.sin(t * 2.3 + i * 2) * 0.32, Math.sin(ang) * 0.8);
        c.rotation.set(t + i, t * 1.3, 0);
      }
    }

    // Scarf: verlet rope pinned at the back of the neck.
    if (scarf.current) {
      const ax = f.x - Math.sin(a.yaw + a.spin) * 0.26;
      const ay = f.y + ((el.id === 'tyler' ? 0.66 : 1.36) - a.drop) * sy * size + 0.02;
      const az = -Math.cos(a.yaw + a.spin) * 0.26;
      const p = cloth.p;
      const prev = cloth.prev;
      const far = Math.abs(p[0] - ax) + Math.abs(p[1] - ay) > 4;
      if (!cloth.ready || far) {
        for (let i = 0; i < SCARF_N; i++) {
          p[i * 3] = prev[i * 3] = ax - f.facing * i * SCARF_SEG * 0.6;
          p[i * 3 + 1] = prev[i * 3 + 1] = ay - i * SCARF_SEG * 0.8;
          p[i * 3 + 2] = prev[i * 3 + 2] = az;
        }
        cloth.ready = true;
      }
      if (!frozen) {
        const wind = Math.sin(t * 2.1 + slot * 2) * 2.2 - f.facing * 1.6;
        for (let i = 1; i < SCARF_N; i++) {
          const j = i * 3;
          const vx = (p[j] - prev[j]) * 0.94;
          const vy = (p[j + 1] - prev[j + 1]) * 0.94;
          prev[j] = p[j];
          prev[j + 1] = p[j + 1];
          p[j] += vx + wind * dt * dt * (0.4 + i * 0.12);
          p[j + 1] += vy - 15 * dt * dt + Math.sin(t * 9 + i) * 0.4 * dt * dt;
          p[j + 2] = az - 0.02 * i;
        }
        p[0] = ax;
        p[1] = ay;
        p[2] = az;
        for (let it = 0; it < 4; it++) {
          for (let i = 1; i < SCARF_N; i++) {
            const j = i * 3;
            const dx = p[j] - p[j - 3];
            const dy = p[j + 1] - p[j - 2];
            const d = Math.hypot(dx, dy) || 1e-5;
            const k = SCARF_SEG / d;
            p[j] = p[j - 3] + dx * k;
            p[j + 1] = p[j - 2] + dy * k;
          }
        }
      }
      const out = cloth.pos;
      for (let i = 0; i < SCARF_N; i++) {
        const j = i * 3;
        const n = Math.min(SCARF_N - 1, i + 1) * 3;
        const m = Math.max(0, i - 1) * 3;
        let tx = p[n] - p[m];
        let ty = p[n + 1] - p[m + 1];
        const d = Math.hypot(tx, ty) || 1;
        tx /= d;
        ty /= d;
        const w = el.id === 'tyler' ? 0.05 : 0.085 - 0.045 * (i / (SCARF_N - 1));
        out[i * 6] = p[j] - ty * w;
        out[i * 6 + 1] = p[j + 1] + tx * w;
        out[i * 6 + 2] = p[j + 2];
        out[i * 6 + 3] = p[j] + ty * w;
        out[i * 6 + 4] = p[j + 1] - tx * w;
        out[i * 6 + 5] = p[j + 2];
      }
      cloth.geo.attributes.position.needsUpdate = true;
    }
  });

  const limbArm = (ref: RefObject<THREE.Group | null>, elbow: RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, 1.24, 0]}>
      <mesh geometry={GEO.upperArm} material={mats.robe} position={[0, -0.14, 0]} />
      <group ref={elbow} position={[0, -0.27, 0]}>
        <mesh geometry={GEO.foreArm} material={mats.robe} position={[0, -0.12, 0]} />
        <mesh geometry={GEO.cuff} material={mats.trim} position={[0, -0.21, 0]} />
        <mesh geometry={GEO.hand} material={mats.hand} position={[0, -0.31, 0]} />
      </group>
    </group>
  );
  const limbLeg = (ref: RefObject<THREE.Group | null>, knee: RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, HIP_Y, 0]}>
      <mesh geometry={GEO.thigh} material={mats.robe} position={[0, -THIGH / 2, 0]} />
      <group ref={knee} position={[0, -THIGH, 0]}>
        <mesh geometry={GEO.shin} material={mats.robe} position={[0, -SHIN / 2, 0]} />
        <mesh geometry={GEO.foot} material={mats.shoe} position={[0, -SHIN, 0.07]} />
      </group>
    </group>
  );

  return (
    <>
      <group ref={root}>
        <group ref={turn}>
          {el.id === 'cash' && (
          <group ref={car} visible={false}>
            <mesh geometry={GEO.box} material={mats.car} scale={[1.15, 0.36, 2.7]} castShadow />
            <mesh geometry={GEO.box} material={mats.glass} position={[0, 0.3, -0.15]} scale={[0.95, 0.3, 1.15]} />
            {[
              [0.6, 0.85],
              [-0.6, 0.85],
              [0.6, -0.9],
              [-0.6, -0.9],
            ].map(([x, z], i) => (
              <mesh key={i} geometry={GEO.wheel} material={mats.glass} position={[x, -0.12, z]} rotation={[0, 0, Math.PI / 2]} />
            ))}
            <mesh geometry={GEO.box} material={mats.car} position={[0, 0.34, -1.25]} scale={[1.2, 0.06, 0.3]} />
            <mesh geometry={GEO.box} material={mats.glow} position={[0, 0.02, 1.36]} scale={[0.9, 0.1, 0.04]} />
          </group>
        )}
        <group ref={body} position={[0, 0.95, 0]}>
            <group ref={rig} position={[0, -0.95, 0]}>
              {limbLeg(legL, kneeL, 0.16)}
              {limbLeg(legR, kneeR, -0.16)}
              <mesh geometry={GEO.skirt} material={mats.robe} position={[0, 0.68, 0]} />
              <mesh geometry={GEO.sash} material={mats.trim} position={[0, 0.86, 0]} />
              <mesh geometry={GEO.knot} material={mats.trim} position={[0.11, 0.68, 0.33]} rotation={[-0.22, 0, 0]} />
              <group ref={upper} position={[0, 0.8, 0]}>
                <group position={[0, -0.8, 0]}>
                  <mesh geometry={GEO.torso} material={mats.robe} position={[0, 1.05, 0]} />
                  <mesh geometry={GEO.stripe} material={mats.trim} position={[0, 1.1, 0.238]} />
                  {el.id === 'fire' && (
                    <>
                      <mesh geometry={GEO.pad} material={mats.trim} position={[0.32, 1.3, 0]} scale={[1.1, 0.6, 1.2]} />
                      <mesh geometry={GEO.pad} material={mats.trim} position={[-0.32, 1.3, 0]} scale={[1.1, 0.6, 1.2]} />
                    </>
                  )}
                  {el.id === 'water' && <mesh geometry={GEO.collar} material={mats.trim} position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]} />}
                  {el.id === 'air' && <mesh geometry={GEO.shawl} material={mats.trim} position={[0, 1.3, 0]} />}
                  {limbArm(armL, elbowL, 0.33)}
                  {limbArm(armR, elbowR, -0.33)}
                  <group ref={head} position={[0, 1.7, 0]}>
                    <mesh geometry={GEO.head} material={mats.skin} />
                    {[1, -1].map((s) => (
                      <group key={s}>
                        <mesh geometry={GEO.eyeWhite} material={mats.white} position={[s * 0.125, 0.03, 0.285]} scale={[1, 1.15, 0.5]} />
                        <mesh geometry={GEO.pupil} material={mats.pupil} position={[s * 0.125, 0.025, 0.318]} scale={[1, 1.2, 0.5]} />
                        {/* Brows angled down toward the nose: these are fighters. */}
                        <mesh geometry={GEO.brow} material={mats.hair} position={[s * 0.125, 0.135, 0.3]} rotation={[0, 0, s * -0.38]} />
                      </group>
                    ))}
                    <HeadGear el={el.id} hair={mats.hair} trim={mats.trim} glow={mats.glow} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
        <group ref={orbit}>
          {Array.from({ length: motes }, (_, i) => (
            <mesh key={i} geometry={moteGeo} material={el.id === 'earth' ? mats.pebble : mats.glow} castShadow={el.id === 'earth'} />
          ))}
        </group>
        <mesh ref={shield} geometry={GEO.shield} material={mats.shield} position={[0, 0.9, 0]} visible={false} />
        <pointLight ref={light} color={el.id === 'cash' ? el.glow : el.color} intensity={6} distance={9} decay={2} position={[0, 1.1, 1.4]} />
        <sprite ref={tag} material={mats.tag} scale={[0.95, 0.63, 1]} renderOrder={20} />
      </group>
      <mesh ref={blob} geometry={GEO.blob} material={mats.blob} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1} />
      <mesh ref={scarf} geometry={cloth.geo} material={mats.scarf} frustumCulled={false} />
    </>
  );
}
