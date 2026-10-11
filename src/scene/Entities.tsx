/**
 * Everything in the fight that is not a fighter or the stage: projectiles,
 * stone pillars, ultimate beams, shockwave rings and KO blasts.
 *
 * Each view owns a small fixed pool of meshes and, every frame, points them at
 * whatever the sim / fx singleton currently holds. Nothing here is React state.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fx } from '../fx/fx';
import { ELEMENTS } from '../game/elements';
import { CASH_LIFE, CRUSH_TIME, DANCE_TIME, HORIZON_LIFE, MINE_LIFE, Mode, PILLAR_DELAY, PILLAR_LIFE, PORTAL_LIFE, TEMPEST_TIME, TSUNAMI_R, ULT_BEAM, ULT_HALF_HEIGHT, UPDRAFT_HALF, UPDRAFT_LIFE, WALL_HEIGHT, WALL_LIFE, WELL_LIFE, type Game, type Projectile } from '../game/sim';
import type { ElementId } from '../game/types';
import { beamMaterial, fresnelMaterial, hdr } from './materials';

const CORE: Record<ElementId, THREE.Color> = {
  fire: new THREE.Color(3.4, 1.5, 0.35),
  water: new THREE.Color(0.5, 1.6, 3.4),
  earth: new THREE.Color(1.6, 1.2, 0.5),
  air: new THREE.Color(2.4, 2.9, 2.9),
  lightning: new THREE.Color(3.4, 3.0, 0.9),
  metal: new THREE.Color(1.9, 2.2, 2.5),
  shadow: new THREE.Color(0.25, 0.06, 0.5),
  void: new THREE.Color(0.02, 0.01, 0.05),
  tyler: new THREE.Color(3.2, 2.2, 0.3),
  cash: new THREE.Color(0.6, 2.8, 1.0),
};
const HALO: Record<ElementId, THREE.Color> = {
  fire: new THREE.Color('#ff5a1f'),
  water: new THREE.Color('#2f8cff'),
  earth: new THREE.Color('#c79a4a'),
  air: new THREE.Color('#bff3ff'),
  lightning: new THREE.Color('#ffe14a'),
  metal: new THREE.Color('#9fb4c7'),
  shadow: new THREE.Color('#a35cff'),
  void: new THREE.Color('#ff4fa3'),
  tyler: new THREE.Color('#ffb300'),
  cash: new THREE.Color('#3ddc6b'),
};

/** A breaking wave in profile, facing +X, extruded across the stage's depth. Fits the wave's hit circle. */
function waveGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-1.9, -1.3);
  s.lineTo(1.0, -1.3);
  s.bezierCurveTo(0.25, -0.6, 0.2, 0.55, 1.0, 1.1);
  s.bezierCurveTo(1.45, 1.4, 1.9, 1.0, 1.75, 0.45);
  s.bezierCurveTo(2.25, 1.3, 1.5, 2.0, 0.5, 1.75);
  s.bezierCurveTo(-0.7, 1.45, -1.3, 0.1, -1.9, -1.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 14 });
  g.translate(0, 0, -1.2);
  return g;
}

const SLOTS = 16;
const RINGS = 7;

const GEO = {
  orb: new THREE.IcosahedronGeometry(1, 2),
  halo: new THREE.SphereGeometry(1, 16, 12),
  rock: new THREE.DodecahedronGeometry(1, 0),
  wave: waveGeometry(),
  twist: new THREE.TorusGeometry(1, 0.06, 6, 30),
  pillar: new THREE.CylinderGeometry(0.78, 0.95, 4.3, 6),
  cap: new THREE.CylinderGeometry(0.5, 0.78, 0.5, 6),
  disc: new THREE.CircleGeometry(1.25, 28),
  beam: new THREE.CylinderGeometry(1, 1, 1, 28, 1, true),
  ring: new THREE.RingGeometry(0.88, 1, 56),
  ko: new THREE.CylinderGeometry(1, 0.15, 1, 20, 1, true),
  scorch: new THREE.RingGeometry(0.55, 1, 40),
  wall: new THREE.CylinderGeometry(0.42, 0.6, 1, 4, 1),
  razor: new THREE.CylinderGeometry(1, 1, 0.14, 10),
  portal: new THREE.TorusGeometry(1, 0.09, 8, 40),
  plate: new THREE.BoxGeometry(0.7, 4.4, 3),
  box: new THREE.BoxGeometry(1, 1, 1),
  blob: new THREE.SphereGeometry(1, 14, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  column: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
};

function ProjectileSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const rock = useRef<THREE.Mesh>(null);
  const wave = useRef<THREE.Mesh>(null);
  const cyclone = useRef<THREE.Group>(null);
  const disc = useRef<THREE.Mesh>(null);

  const mats = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      halo: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }),
      rock: new THREE.MeshStandardMaterial({ color: '#6f5d4a', roughness: 1, flatShading: true, emissive: '#5a3a1a', emissiveIntensity: 0.35 }),
      wave: fresnelMaterial(new THREE.Color('#3aa8ff'), 0.3, 2.4, 1.4),
      twist: new THREE.MeshBasicMaterial({ color: hdr('#dffaff', 1.5), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
      disc: new THREE.MeshStandardMaterial({ color: '#c9d6e2', roughness: 0.25, metalness: 0.9, emissive: '#e0803a', emissiveIntensity: 0.5 }),
    }),
    [],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = game.projectiles[index];
    if (!p) {
      g.visible = false;
      return;
    }
    // Tyler's and Kash's shots, and the stranger things, have their own slot (see OddSlot).
    if (isOdd(p)) {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    g.visible = true;
    g.position.set(p.x, p.y, 0);
    const metal = p.kind === 'bolt' && p.el === 'metal';
    const bolt = p.kind === 'bolt' && !metal;
    const tremor = p.kind === 'tremor';
    const blob = p.kind === 'orb' || p.kind === 'clone';
    const isRock = (bolt && p.el === 'earth') || tremor;
    core.current!.visible = (bolt && !isRock) || blob;
    halo.current!.visible = (bolt && !isRock) || blob;
    disc.current!.visible = metal;
    rock.current!.visible = isRock;
    const isWave = p.kind === 'wave' || p.kind === 'tsunami';
    wave.current!.visible = isWave;
    cyclone.current!.visible = p.kind === 'cyclone';
    // Grow in over the first few frames so shots don't pop into existence.
    const born = Math.min(1, p.age / 0.06);

    if (metal) {
      // A razor disc (or a shard of one): flat, fast-spinning, tilted into its flight.
      const shard = p.mode === Mode.Plain;
      const s = shard ? p.r * 0.8 : p.r * 1.25;
      disc.current!.scale.set(s, shard ? 0.6 : 1, s * (shard ? 0.35 : 1));
      disc.current!.rotation.set(Math.PI / 2 - 0.5, t * 34 + p.uid, 0);
    } else if (blob) {
      const orb = p.kind === 'orb';
      mats.core.color.copy(CORE[p.el]);
      mats.halo.color.copy(HALO[p.el]);
      const pulse = 1 + Math.sin(t * (orb ? 55 : 20) + p.uid) * (orb ? 0.18 : 0.06);
      // Ball lightning is a small bright heart in a wide crackling field; a decoy is a fighter-sized shade.
      if (orb) core.current!.scale.setScalar(0.34 * pulse * born);
      else core.current!.scale.set(0.42 * born, 0.92 * born, 0.42);
      core.current!.rotation.z = 0;
      halo.current!.scale.setScalar((orb ? p.r : 0.95) * pulse * born);
      mats.halo.opacity = orb ? 0.2 + 0.12 * Math.sin(t * 70) : 0.3;
    } else if (tremor) {
      // A ridge of broken ground racing along the floor.
      const d = Math.sign(p.vx) || 1;
      rock.current!.scale.set(0.95 * born, 0.6 * born * (1 + Math.sin(t * 50) * 0.2), 1.5);
      rock.current!.position.y = -0.25;
      rock.current!.rotation.set(0, 0, -d * p.age * 16);
    } else if (bolt) {
      rock.current!.position.y = 0;
      mats.core.color.copy(CORE[p.el]);
      mats.halo.color.copy(HALO[p.el]);
      const pulse = 1 + Math.sin(t * 40 + p.uid) * 0.08;
      const d = Math.sign(p.vx) || 1;
      if (isRock) {
        rock.current!.scale.setScalar(p.r * 1.15 * born);
        rock.current!.rotation.set(p.age * 5, p.age * 3, -d * p.age * 7);
      } else if (p.el === 'air') {
        // A thin vertical crescent, leaning into its travel.
        core.current!.scale.set(p.r * 0.3, p.r * 1.35 * born, p.r * 0.5);
        core.current!.rotation.z = -d * 0.25;
        halo.current!.scale.set(p.r * 0.9, p.r * 1.7, p.r * 0.9);
        mats.halo.opacity = 0.22;
      } else {
        core.current!.scale.setScalar(p.r * 0.72 * pulse * born);
        core.current!.rotation.z = 0;
        // Shades and gravitons are dark hearts inside a bright corona.
        const dark = p.el === 'shadow' || p.el === 'void';
        halo.current!.scale.setScalar(p.r * (dark ? 2.1 : 1.7) * pulse);
        mats.halo.opacity = dark ? 0.5 : 0.34;
      }
    } else if (isWave) {
      const d = Math.sign(p.vx) || 1;
      const fade = Math.min(1, (p.life - p.age) / 0.25);
      const swell = 1 + Math.sin(t * 14) * 0.05;
      // The tsunami is the same breaking wave, scaled up to its far larger hit circle.
      const big = p.kind === 'tsunami' ? TSUNAMI_R / 1.5 : 1;
      const rise = Math.min(1, p.age / (p.kind === 'tsunami' ? 0.2 : 0.06));
      // Mirror for travel direction; rise out of the ground as it forms.
      wave.current!.scale.set(d * big * (0.6 + 0.4 * rise), big * swell * rise, big);
      wave.current!.position.y = -1.3 * big * (1 - swell * rise);
      mats.wave.uniforms.uOpacity.value = fade * (p.hits ? 0.6 : 1);
    } else {
      const c = cyclone.current!;
      const fade = Math.min(1, (p.life - p.age) / 0.3) * born;
      mats.twist.opacity = 0.55 * fade;
      for (let i = 0; i < c.children.length; i++) {
        const ring = c.children[i];
        const h = i / (c.children.length - 1);
        const r = (0.3 + h * 1.25) * (1 + Math.sin(t * 9 + i) * 0.08);
        ring.position.set(Math.sin(t * 7 + i * 1.3) * 0.18 * h, -1.5 + h * 3.2, Math.cos(t * 6 + i) * 0.12 * h);
        ring.scale.set(r, r, 1 + h);
        ring.rotation.set(Math.PI / 2 + Math.sin(t * 5 + i) * 0.12, 0, t * (14 - h * 6) + i);
      }
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={core} geometry={GEO.orb} material={mats.core} />
      <mesh ref={halo} geometry={GEO.halo} material={mats.halo} />
      <mesh ref={rock} geometry={GEO.rock} material={mats.rock} castShadow />
      <mesh ref={wave} geometry={GEO.wave} material={mats.wave} />
      <mesh ref={disc} geometry={GEO.razor} material={mats.disc} visible={false} castShadow />
      <group ref={cyclone}>
        {Array.from({ length: RINGS }, (_, i) => (
          <mesh key={i} geometry={GEO.twist} material={mats.twist} />
        ))}
      </group>
    </group>
  );
}

const PILLAR_MATS = {
  stone: new THREE.MeshStandardMaterial({ color: '#8b7a66', roughness: 1, flatShading: true }),
  cap: new THREE.MeshStandardMaterial({ color: '#a8997f', roughness: 1, flatShading: true, emissive: '#8fd163', emissiveIntensity: 0.6 }),
};

function isOdd(p: Projectile): boolean {
  return p.kind === 'fry' || p.kind === 'piano' || p.kind === 'poop' || (p.kind === 'bolt' && (p.el === 'tyler' || p.el === 'cash'));
}

const glyphs = new Map<string, THREE.CanvasTexture>();
/** A character (a music note, an emoji) drawn to a texture, for sprites. */
function glyph(ch: string, color = '#ffffff'): THREE.CanvasTexture {
  const key = ch + color;
  let tex = glyphs.get(key);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.font = '96px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(10, 8, 24, 0.9)';
  ctx.lineJoin = 'round';
  ctx.strokeText(ch, 64, 70);
  ctx.fillStyle = color;
  ctx.fillText(ch, 64, 70);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  glyphs.set(key, tex);
  return tex;
}

const NOTE_COLORS = ['#ffd35a', '#ff5a5a', '#ffffff', '#7dff9a'];
const FRY_EMOJI = ['😂', '💯', '🔥', '👌', '😂'];

/** Wrong notes, banknotes and gold bars, the Deep Fry cloud, the piano, and what falls in the storm. */
function OddSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const note = useRef<THREE.Sprite>(null);
  const bill = useRef<THREE.Mesh>(null);
  const bar = useRef<THREE.Mesh>(null);
  const cloud = useRef<THREE.Group>(null);
  const piano = useRef<THREE.Group>(null);
  const poop = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      notes: NOTE_COLORS.map((c, i) => new THREE.SpriteMaterial({ map: glyph(i % 2 ? '♫' : '♪', c), transparent: true, depthWrite: false })),
      bill: new THREE.MeshStandardMaterial({ color: '#4fd27a', roughness: 0.7, emissive: '#1f9a4a', emissiveIntensity: 0.9, side: THREE.DoubleSide }),
      bar: new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.25, metalness: 1, emissive: '#ffb300', emissiveIntensity: 0.7 }),
      cloud: fresnelMaterial(new THREE.Color('#ff9a1a'), 0.16, 1.4, 1.2),
      emoji: FRY_EMOJI.map((e) => new THREE.SpriteMaterial({ map: glyph(e), transparent: true, depthWrite: false })),
      black: new THREE.MeshStandardMaterial({ color: '#17161c', roughness: 0.25, metalness: 0.3 }),
      ivory: new THREE.MeshStandardMaterial({ color: '#f4efe2', roughness: 0.5 }),
      brown: new THREE.MeshStandardMaterial({ color: '#6b4423', roughness: 0.6 }),
      eye: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    }),
    [],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = game.projectiles[index];
    if (!p || !isOdd(p)) {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    g.visible = true;
    g.position.set(p.x, p.y, 0);
    const d = Math.sign(p.vx) || 1;
    const isNote = p.kind === 'bolt' && p.el === 'tyler';
    const isGold = p.kind === 'bolt' && p.mode === Mode.Gold;
    const isBill = p.kind === 'bolt' && p.el === 'cash' && !isGold;
    note.current!.visible = isNote;
    bill.current!.visible = isBill;
    bar.current!.visible = isGold;
    cloud.current!.visible = p.kind === 'fry';
    piano.current!.visible = p.kind === 'piano';
    poop.current!.visible = p.kind === 'poop';
    if (isNote) {
      note.current!.material = mats.notes[p.uid % mats.notes.length];
      note.current!.scale.setScalar(0.95 + Math.sin(t * 20 + p.uid) * 0.12);
      note.current!.position.y = Math.sin(t * 14 + p.uid) * 0.18;
    } else if (isBill) {
      bill.current!.rotation.set(t * 9 + p.uid, t * 13, 0.4);
    } else if (isGold) {
      bar.current!.rotation.set(0.3, t * 5, -d * p.age * 6);
    } else if (p.kind === 'fry') {
      const fade = Math.min(1, p.age / 0.3) * Math.min(1, (p.life - p.age) / 0.5);
      const shell = cloud.current!.children[0];
      shell.scale.setScalar(p.r * (0.92 + Math.sin(t * 13) * 0.05));
      mats.cloud.uniforms.uOpacity.value = fade;
      // Emoji tumbling around inside, because of course there are.
      for (let i = 1; i < cloud.current!.children.length; i++) {
        const e = cloud.current!.children[i];
        const a = t * (1.4 + i * 0.3) + i * 1.9;
        const r = p.r * (0.35 + 0.3 * Math.sin(t * 0.9 + i));
        e.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.8, 0.6);
        e.scale.setScalar((0.9 + 0.5 * Math.sin(t * 6 + i)) * fade);
        (e as THREE.Sprite).material.rotation = Math.sin(t * 3 + i) * 0.6;
      }
    } else if (p.kind === 'piano') {
      piano.current!.rotation.z = -d * p.age * 7;
      piano.current!.scale.setScalar(Math.min(1, p.age / 0.08));
    } else {
      poop.current!.rotation.set(0, t * 4 + p.uid, d * 0.3);
    }
  });

  return (
    <group ref={group} visible={false}>
      <sprite ref={note} material={mats.notes[0]} />
      <mesh ref={bill} geometry={GEO.box} material={mats.bill} scale={[0.7, 0.34, 0.03]} />
      <mesh ref={bar} geometry={GEO.box} material={mats.bar} scale={[0.82, 0.3, 0.4]} castShadow />
      <group ref={cloud}>
        <mesh geometry={GEO.halo} material={mats.cloud} />
        {mats.emoji.map((m, i) => (
          <sprite key={i} material={m} />
        ))}
      </group>
      <group ref={piano}>
        <mesh geometry={GEO.box} material={mats.black} scale={[2.1, 1.05, 0.9]} castShadow />
        <mesh geometry={GEO.box} material={mats.black} position={[-0.25, 0.62, -0.1]} scale={[1.5, 0.08, 0.72]} rotation={[0.35, 0, 0]} />
        <mesh geometry={GEO.box} material={mats.ivory} position={[0, 0.1, 0.5]} scale={[1.9, 0.09, 0.26]} />
        {[-0.85, 0.85, 0].map((x, i) => (
          <mesh key={i} geometry={GEO.box} material={mats.black} position={[x, -0.85, i === 2 ? -0.3 : 0.25]} scale={[0.14, 0.7, 0.14]} />
        ))}
      </group>
      <group ref={poop}>
        <mesh geometry={GEO.blob} material={mats.brown} position={[0, -0.22, 0]} scale={[0.52, 0.26, 0.52]} />
        <mesh geometry={GEO.blob} material={mats.brown} position={[0, 0.06, 0]} scale={[0.4, 0.22, 0.4]} />
        <mesh geometry={GEO.blob} material={mats.brown} position={[0, 0.3, 0]} scale={[0.27, 0.18, 0.27]} />
        <mesh geometry={GEO.cone} material={mats.brown} position={[0.03, 0.52, 0]} scale={[0.13, 0.26, 0.13]} rotation={[0, 0, -0.3]} />
        <mesh geometry={GEO.blob} material={mats.eye} position={[0.13, 0.1, 0.33]} scale={0.07} />
        <mesh geometry={GEO.blob} material={mats.eye} position={[-0.13, 0.1, 0.33]} scale={0.07} />
      </group>
    </group>
  );
}

/** Tyler's gremlin: a very small monkey with very large ears, bounding after the opponent. */
function GremlinSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      fur: new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.9 }),
      face: new THREE.MeshStandardMaterial({ color: '#d9b38c', roughness: 0.8 }),
      eye: new THREE.MeshBasicMaterial({ color: hdr('#ffb300', 2.6) }),
    }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const m = game.gremlins[index];
    if (!m) {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    g.visible = true;
    const hop = m.grounded ? Math.abs(Math.sin(t * 16 + m.uid)) * 0.14 : 0;
    g.position.set(m.x, m.y + hop, 0.2);
    g.rotation.y = m.facing * 1.1;
    const s = Math.min(1, m.t / 0.15);
    g.scale.set(s, s * (m.grounded ? 1 - hop * 0.6 : 1.12), s);
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.blob} material={mats.fur} position={[0, 0.26, 0]} scale={[0.26, 0.28, 0.24]} castShadow />
      <mesh geometry={GEO.blob} material={mats.fur} position={[0, 0.62, 0.02]} scale={0.24} castShadow />
      <mesh geometry={GEO.blob} material={mats.face} position={[0, 0.58, 0.14]} scale={[0.17, 0.15, 0.13]} />
      {[1, -1].map((x) => (
        <group key={x}>
          <mesh geometry={GEO.blob} material={mats.fur} position={[x * 0.27, 0.72, 0]} scale={[0.15, 0.17, 0.05]} />
          <mesh geometry={GEO.blob} material={mats.face} position={[x * 0.27, 0.72, 0.03]} scale={[0.09, 0.11, 0.03]} />
          <mesh geometry={GEO.blob} material={mats.eye} position={[x * 0.085, 0.65, 0.22]} scale={0.04} />
          <mesh geometry={GEO.blob} material={mats.fur} position={[x * 0.14, 0.05, 0.04]} scale={[0.09, 0.06, 0.13]} />
        </group>
      ))}
      <mesh geometry={GEO.twist} material={mats.fur} position={[0, 0.34, -0.3]} scale={[0.2, 0.2, 1.4]} rotation={[0, Math.PI / 2, 0.6]} />
    </group>
  );
}

/** Kash's finisher: a bank vault, falling a long way. */
function Vault({ game, slot }: { game: Game; slot: 0 | 1 }) {
  const f = game.fighters[slot];
  const foe = game.fighters[1 - slot];
  const group = useRef<THREE.Group>(null);
  const at = useRef({ x: 0, y: 0, set: false });
  const mats = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#3d444d', roughness: 0.35, metalness: 0.9 }),
      gold: new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.25, metalness: 1, emissive: '#ffb300', emissiveIntensity: 0.8 }),
    }),
    [],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ut = f.el.id === 'cash' ? f.ultT() : -1;
    const start = DANCE_TIME - 0.75;
    if (ut < start) {
      g.visible = false;
      at.current.set = false;
      return;
    }
    // It is aimed when it is dropped; it does not follow them down.
    if (!at.current.set) at.current = { x: foe.x, y: foe.y, set: true };
    g.visible = true;
    const fall = Math.min(1, (ut - start) / 0.6);
    const settle = Math.max(0, ut - (start + 0.6));
    g.position.set(at.current.x, at.current.y + 1.2 + (1 - fall * fall) * 16, 0);
    g.rotation.z = (1 - fall) * 0.5;
    g.scale.setScalar(Math.max(0, 1 - settle * 1.4));
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.box} material={mats.steel} scale={[2.4, 2.4, 2.2]} castShadow />
      <mesh geometry={GEO.razor} material={mats.gold} position={[0, 0, 1.12]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 1, 0.7]} />
      <mesh geometry={GEO.box} material={mats.gold} position={[0, 0, 1.22]} scale={[0.95, 0.12, 0.1]} />
      <mesh geometry={GEO.box} material={mats.gold} position={[0, 0, 1.22]} scale={[0.12, 0.95, 0.1]} />
    </group>
  );
}

function PillarSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const column = useRef<THREE.Group>(null);
  const warn = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      ...PILLAR_MATS,
      warn: new THREE.MeshBasicMaterial({ color: hdr('#c8ff8a', 2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = game.pillars[index];
    if (!p) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(p.x, p.y, 0);
    const t = p.t;
    // Telegraph: a pulsing glyph on the ground where it is about to erupt.
    const delay = p.delay;
    warn.current!.visible = t < delay + 0.1;
    mats.warn.opacity = 0.35 + 0.35 * Math.sin(state.clock.elapsedTime * 40);
    warn.current!.scale.setScalar(0.5 + (0.6 * Math.min(t, delay)) / delay);

    let h = 0;
    if (t >= delay) {
      const up = Math.min(1, (t - delay) / 0.1);
      // Overshoot slightly, like something punched out of the ground.
      h = up < 1 ? up * 1.08 : 1 + 0.08 * Math.max(0, 1 - (t - delay - 0.1) / 0.12);
      const sink = (t - (delay - PILLAR_DELAY + PILLAR_LIFE - 0.4)) / 0.4;
      if (sink > 0) h = Math.max(0, 1 - sink * sink);
    }
    column.current!.visible = h > 0.001;
    column.current!.scale.set(1, Math.max(0.001, h), 1);
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={warn} geometry={GEO.disc} material={mats.warn} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} />
      <group ref={column}>
        <mesh geometry={GEO.pillar} material={mats.stone} position={[0, 2.15, 0]} castShadow />
        <mesh geometry={GEO.cap} material={mats.cap} position={[0, 4.5, 0]} castShadow />
      </group>
    </group>
  );
}

function Beam({ game, slot }: { game: Game; slot: 0 | 1 }) {
  const f = game.fighters[slot];
  const group = useRef<THREE.Group>(null);
  const flare = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => {
    const c = new THREE.Color(ELEMENTS[f.el.id].color);
    return {
      outer: beamMaterial(c),
      // Kept well under pure white so the beam stays the element's colour through the bloom.
      core: new THREE.MeshBasicMaterial({ color: hdr(f.el.glow, 2.4) }),
      flare: new THREE.MeshBasicMaterial({ color: hdr(f.el.color, 1.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
  }, [f]);
  const LEN = 80;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const bt = f.el.id === 'fire' ? f.ultT() : -1;
    if (bt < 0 || bt > ULT_BEAM) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = state.clock.elapsedTime;
    const env = Math.min(1, bt / 0.07) * Math.min(1, (ULT_BEAM - bt) / 0.16);
    const r = ULT_HALF_HEIGHT * env * (1 + Math.sin(t * 70) * 0.05);
    g.position.set(f.x + f.facing * 0.9, f.y + 1.1, 0);
    g.scale.set(f.facing, 1, 1);
    for (let i = 0; i < 2; i++) {
      const m = g.children[i];
      const k = i === 0 ? r : r * 0.3;
      m.scale.set(k, LEN, k);
    }
    mats.outer.uniforms.uTime.value = t;
    flare.current!.scale.setScalar(r * (1.15 + Math.sin(t * 50) * 0.1));
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.beam} material={mats.outer} rotation={[0, 0, -Math.PI / 2]} position={[LEN / 2, 0, 0]} />
      <mesh geometry={GEO.beam} material={mats.core} rotation={[0, 0, -Math.PI / 2]} position={[LEN / 2, 0, 0]} />
      <mesh ref={flare} geometry={GEO.halo} material={mats.flare} />
    </group>
  );
}

function Rings() {
  const group = useRef<THREE.Group>(null);
  const COUNT = 24;
  const mats = useMemo(
    () =>
      Array.from(
        { length: COUNT },
        () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      ),
    [],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    for (let i = 0; i < COUNT; i++) {
      const m = g.children[i];
      const r = fx.rings[i];
      if (!r || r.t >= r.dur) {
        m.visible = false;
        continue;
      }
      const u = r.t / r.dur;
      const e = 1 - (1 - u) * (1 - u);
      m.visible = true;
      m.position.set(r.x, r.y, 0.4);
      m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      mats[i].color.copy(r.color).multiplyScalar(r.intensity);
      mats[i].opacity = Math.pow(1 - u, 1.4);
    }
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <mesh key={i} geometry={GEO.ring} material={m} visible={false} />
      ))}
    </group>
  );
}

/** The Smash-style column of light that fires inward from the blast line on a KO. */
function KoBeams() {
  const group = useRef<THREE.Group>(null);
  const COUNT = 3;
  const LEN = 70;
  const mats = useMemo(
    () =>
      Array.from(
        { length: COUNT },
        () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      ),
    [],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    for (let i = 0; i < COUNT; i++) {
      const holder = g.children[i];
      const b = fx.koBeams[i];
      if (!b) {
        holder.visible = false;
        continue;
      }
      const u = b.t / b.dur;
      holder.visible = true;
      holder.position.set(b.x, b.y, 0);
      holder.rotation.z = b.angle;
      const w = 3.4 * Math.pow(1 - u, 2.2) + 0.02;
      holder.children[0].scale.set(w, LEN, w * 0.6);
      mats[i].color.copy(b.color).multiplyScalar(3.2);
      mats[i].opacity = 1 - u * u;
    }
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <group key={i} visible={false}>
          {/* The cone's wide end sits on the blast line and it narrows toward the stage. */}
          <mesh geometry={GEO.ko} material={m} rotation={[0, 0, Math.PI / 2]} position={[LEN / 2 - 4, 0, 0]} />
        </group>
      ))}
    </group>
  );
}

/** Air's ultimate: a towering funnel around the caster, built from the same rings as the cyclone. */
function Tempest({ game, slot }: { game: Game; slot: 0 | 1 }) {
  const f = game.fighters[slot];
  const group = useRef<THREE.Group>(null);
  const COUNT = 13;
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: hdr('#dffaff', 1.5), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const ut = f.el.id === 'air' ? f.ultT() : -1;
    if (ut < 0 || ut > TEMPEST_TIME + 0.25) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = state.clock.elapsedTime;
    const env = Math.min(1, ut / 0.18) * Math.min(1, (TEMPEST_TIME + 0.25 - ut) / 0.25);
    mat.opacity = 0.5 * env;
    g.position.set(f.x, f.y, 0);
    for (let i = 0; i < COUNT; i++) {
      const ring = g.children[i];
      const h = i / (COUNT - 1);
      const r = (0.7 + h * 4.2) * env * (1 + Math.sin(t * 8 + i) * 0.07);
      ring.position.set(Math.sin(t * 6 + i * 1.3) * 0.5 * h, -1 + h * 9, Math.cos(t * 5 + i) * 0.4 * h);
      ring.scale.set(r, r, 1.6 + h * 2.5);
      ring.rotation.set(Math.PI / 2 + Math.sin(t * 4 + i) * 0.1, 0, t * (16 - h * 7) + i);
    }
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh key={i} geometry={GEO.twist} material={mat} />
      ))}
    </group>
  );
}

/** Fire's Ember Mine: a glowing glyph that pulses faster once it is armed. */
function MineSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      core: new THREE.MeshBasicMaterial({ color: hdr('#ff7a2a', 3) }),
      glyph: new THREE.MeshBasicMaterial({ color: hdr('#ff5a1a', 2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const m = game.mines[index];
    if (!m) {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    g.visible = true;
    g.position.set(m.x, m.y, 0.3);
    const armed = m.t > 0.5;
    const fade = Math.min(1, ((m.cash ? CASH_LIFE : MINE_LIFE) - m.t) / 0.5) * Math.min(1, m.t / 0.15);
    // Loose Change is the same trap in green and gold.
    mats.core.color.setRGB(m.cash ? 3 : 3, m.cash ? 2.2 : 1.1, m.cash ? 0.5 : 0.25);
    mats.glyph.color.setRGB(m.cash ? 0.4 : 2, m.cash ? 2 : 0.6, m.cash ? 0.8 : 0.1);
    const pulse = 0.5 + 0.5 * Math.sin(t * (armed ? 14 : 5));
    g.children[0].scale.setScalar((0.16 + pulse * 0.06) * fade);
    g.children[0].position.y = 0.3 + Math.sin(t * 3) * 0.05;
    g.children[1].scale.setScalar((0.9 + pulse * 0.25) * fade);
    mats.glyph.opacity = (armed ? 0.35 + pulse * 0.45 : 0.25) * fade;
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.halo} material={mats.core} />
      <mesh geometry={GEO.scorch} material={mats.glyph} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} />
    </group>
  );
}

/** Earth's Stone Wall: a slab that punches up, stands, cracks as it takes hits, then sinks. */
function WallSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8b7a66', roughness: 1, flatShading: true, emissive: '#ff8a3c', emissiveIntensity: 0 }), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const w = game.walls[index];
    if (!w) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const up = Math.min(1, w.t / 0.12);
    const sink = Math.max(0, (w.t - (WALL_LIFE - 0.35)) / 0.35);
    const h = (up < 1 ? up * 1.06 : 1) * (1 - sink * sink);
    g.position.set(w.x, w.y, 0);
    g.scale.set(1, Math.max(0.001, h), 1);
    // The more it has taken, the hotter its cracks glow.
    mat.emissiveIntensity = (1 - w.hp / 26) * 0.9;
  });
  return (
    <group ref={group} visible={false}>
      {/* Scale on the parent so the four-sided column stays a rectangular slab after its 45° turn. */}
      <group position={[0, WALL_HEIGHT / 2, 0]} scale={[0.8, WALL_HEIGHT, 2.5]}>
        <mesh geometry={GEO.wall} material={mat} rotation={[0, Math.PI / 4, 0]} castShadow />
      </group>
    </group>
  );
}

/** Air's Updraft: a faint column with rings climbing through it. */
function UpdraftSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const RINGS_N = 5;
  const HEIGHT = 10;
  const mats = useMemo(
    () => ({
      column: fresnelMaterial(new THREE.Color('#cfefff'), 0.05, 0.5, 1.2),
      ring: new THREE.MeshBasicMaterial({ color: hdr('#dffaff', 1.3), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const u = game.updrafts[index];
    if (!u) {
      g.visible = false;
      return;
    }
    const t = state.clock.elapsedTime;
    g.visible = true;
    g.position.set(u.x, u.y, 0);
    const fade = Math.min(1, u.t / 0.2) * Math.min(1, (UPDRAFT_LIFE - u.t) / 0.4);
    mats.column.uniforms.uOpacity.value = fade;
    mats.ring.opacity = 0.4 * fade;
    for (let i = 0; i < RINGS_N; i++) {
      const ring = g.children[i + 1];
      const h = (t * 0.9 + i / RINGS_N) % 1;
      ring.position.y = h * HEIGHT;
      ring.scale.setScalar(UPDRAFT_HALF * (0.75 + 0.3 * Math.sin(h * Math.PI)));
      ring.rotation.set(Math.PI / 2, 0, t * 5 + i);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.column} material={mats.column} position={[0, HEIGHT / 2, 0]} scale={[UPDRAFT_HALF, HEIGHT, UPDRAFT_HALF]} />
      {Array.from({ length: RINGS_N }, (_, i) => (
        <mesh key={i} geometry={GEO.twist} material={mats.ring} />
      ))}
    </group>
  );
}

/** Lightning's sky strikes: a faint column while it is telegraphed, then a blinding one as it lands. */
function StrikeSlot({ game, index }: { game: Game; index: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr('#fff6b0', 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const s = game.strikes[index];
    if (!s) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const t = state.clock.elapsedTime;
    const struck = s.t >= s.delay;
    const after = s.t - s.delay;
    // A geyser's column stands on the bottom of the screen; sky strikes hang from the top.
    m.position.set(s.x, s.kind === 2 ? -1 : 12, 0);
    const w = struck ? 1.1 * Math.max(0, 1 - after / 0.3) : 0.55 + Math.sin(t * 40) * 0.08;
    m.scale.set(w, s.kind === 2 ? 22 : 30, w);
    mat.opacity = struck ? Math.max(0, 1 - after / 0.3) : 0.07 + 0.1 * (s.t / s.delay);
    const k = struck ? 2.4 : 1;
    // Lightning yellow-white, ice pale blue, lava orange.
    if (s.kind === 2) mat.color.setRGB(2.2 * k, 0.8 * k, 0.15 * k);
    else if (s.kind === 1) mat.color.setRGB(0.9 * k, 1.7 * k, 2.1 * k);
    else mat.color.setRGB(2.1 * k, 2 * k, 1.4 * k);
  });
  return <mesh ref={mesh} geometry={GEO.column} material={mat} visible={false} />;
}

/** Void's portals: two rings with a swirling throat, the near one pink and the far one blue. */
function PortalPair({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      a: new THREE.MeshBasicMaterial({ color: hdr('#ff4fa3', 2.6) }),
      b: new THREE.MeshBasicMaterial({ color: hdr('#4f7bff', 2.6) }),
      throat: new THREE.MeshBasicMaterial({ color: '#05030d', transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const p = game.portals[index];
    if (!p) {
      g.visible = false;
      return;
    }
    g.visible = true;
    const t = state.clock.elapsedTime;
    const s = Math.min(1, p.t / 0.2) * Math.min(1, (PORTAL_LIFE - p.t) / 0.4);
    const ends = [
      [p.ax, p.ay],
      [p.bx, p.by],
    ];
    for (let i = 0; i < 2; i++) {
      const mouth = g.children[i];
      mouth.position.set(ends[i][0], ends[i][1], 0);
      mouth.scale.set(s * 1.05, s * 1.35 * (1 + Math.sin(t * 6 + i) * 0.04), s);
      mouth.children[0].rotation.z = t * (i ? -3 : 3);
    }
  });
  return (
    <group ref={group} visible={false}>
      {[mats.a, mats.b].map((m, i) => (
        <group key={i}>
          <mesh geometry={GEO.portal} material={m} />
          <mesh geometry={GEO.disc} material={mats.throat} scale={[0.76, 0.76, 1]} />
        </group>
      ))}
    </group>
  );
}

/** Void's singularity: a black sphere, a bright accretion ring tilted around it, and a glow. Bigger for the ultimate. */
function WellSlot({ game, index }: { game: Game; index: number }) {
  const group = useRef<THREE.Group>(null);
  const mats = useMemo(
    () => ({
      hole: new THREE.MeshBasicMaterial({ color: '#000000' }),
      ring: new THREE.MeshBasicMaterial({ color: hdr('#ff7fc0', 3) }),
      glow: fresnelMaterial(new THREE.Color('#ff4fa3'), 0.02, 2.6, 2.4),
    }),
    [],
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const w = game.wells[index];
    if (!w) {
      g.visible = false;
      return;
    }
    const life = w.big ? HORIZON_LIFE : WELL_LIFE;
    const t = state.clock.elapsedTime;
    g.visible = w.t < life + 0.12;
    g.position.set(w.x, w.y, 0);
    // Swells as it feeds, then snaps shut.
    const grow = Math.min(1, w.t / 0.25) * (0.75 + 0.25 * (w.t / life));
    const close = w.t > life ? Math.max(0, 1 - (w.t - life) / 0.12) : 1;
    const r = (w.big ? 1.9 : 0.8) * grow * close;
    g.children[0].scale.setScalar(r);
    g.children[1].scale.setScalar(r * 1.9);
    g.children[1].rotation.set(1.25, 0, t * 5);
    g.children[2].scale.setScalar(r * 1.55);
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.halo} material={mats.hole} />
      <mesh geometry={GEO.portal} material={mats.ring} />
      <mesh geometry={GEO.halo} material={mats.glow} />
    </group>
  );
}

/** Metal's ultimate: two steel plates that hang open while it pulls, then slam together. */
function Crush({ game, slot }: { game: Game; slot: 0 | 1 }) {
  const f = game.fighters[slot];
  const group = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#aebccb', roughness: 0.3, metalness: 0.9, emissive: '#e0803a', emissiveIntensity: 0.25 }), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const ut = f.el.id === 'metal' ? f.ultT() : -1;
    if (ut < 0) {
      g.visible = false;
      return;
    }
    g.visible = true;
    g.position.set(f.x + f.facing * 3.2, f.y + 1.3, 0);
    const appear = Math.min(1, ut / 0.15);
    // Wide apart through the pull, a hard clap at the end, then they drift back out.
    const gap = ut < CRUSH_TIME - 0.07 ? 3.3 - ut * 0.5 : ut < CRUSH_TIME + 0.12 ? Math.max(0.35, 3 * (1 - (ut - (CRUSH_TIME - 0.07)) / 0.07)) : 0.35 + (ut - CRUSH_TIME - 0.12) * 6;
    g.children[0].position.x = -gap;
    g.children[1].position.x = gap;
    g.scale.setScalar(appear);
    mat.emissiveIntensity = ut > CRUSH_TIME - 0.07 && ut < CRUSH_TIME + 0.15 ? 2.5 : 0.25;
  });
  return (
    <group ref={group} visible={false}>
      <mesh geometry={GEO.plate} material={mat} castShadow />
      <mesh geometry={GEO.plate} material={mat} castShadow />
    </group>
  );
}

/** A few real lights that ride on the brightest shots, so they light the stage as they fly. */
function ShotLights({ game }: { game: Game }) {
  const group = useRef<THREE.Group>(null);
  const COUNT = 4;
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    let n = 0;
    for (const p of game.projectiles) {
      if (n >= COUNT) break;
      if ((p.kind === 'bolt' && p.el === 'earth') || p.kind === 'tremor') continue;
      const l = g.children[n++] as THREE.PointLight;
      l.visible = true;
      l.position.set(p.x, p.y, 1.2);
      l.color.copy(HALO[p.el]);
      l.intensity = p.kind === 'bolt' ? 22 : p.kind === 'tsunami' ? 90 : 40;
    }
    for (; n < COUNT; n++) g.children[n].visible = false;
  });
  return (
    <group ref={group}>
      {Array.from({ length: COUNT }, (_, i) => (
        <pointLight key={i} visible={false} distance={11} decay={2} />
      ))}
    </group>
  );
}

/** Marks left on the ground by heavy impacts: a glowing ring that cools and fades. */
function Scorches() {
  const group = useRef<THREE.Group>(null);
  const COUNT = 10;
  const mats = useMemo(
    () => Array.from({ length: COUNT }, () => new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
    [],
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    for (let i = 0; i < COUNT; i++) {
      const m = g.children[i];
      const s = fx.scorches[i];
      if (!s) {
        m.visible = false;
        continue;
      }
      const u = s.t / s.dur;
      m.visible = true;
      m.position.set(s.x, s.y + 0.03, 0.2);
      m.scale.setScalar(s.r * (0.85 + 0.15 * Math.min(1, s.t * 8)));
      mats[i].color.copy(s.color).multiplyScalar(2.2 * Math.pow(1 - u, 2));
      mats[i].opacity = 1 - u;
    }
  });
  return (
    <group ref={group}>
      {mats.map((m, i) => (
        <mesh key={i} geometry={GEO.scorch} material={m} rotation={[-Math.PI / 2, 0, 0]} visible={false} />
      ))}
    </group>
  );
}

export function Entities({ game }: { game: Game }) {
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => (
        <group key={i}>
          <ProjectileSlot game={game} index={i} />
          <OddSlot game={game} index={i} />
        </group>
      ))}
      <GremlinSlot game={game} index={0} />
      <GremlinSlot game={game} index={1} />
      <Vault game={game} slot={0} />
      <Vault game={game} slot={1} />
      {Array.from({ length: 16 }, (_, i) => (
        <PillarSlot key={i} game={game} index={i} />
      ))}
      <Beam game={game} slot={0} />
      <Beam game={game} slot={1} />
      <Tempest game={game} slot={0} />
      <Tempest game={game} slot={1} />
      <Crush game={game} slot={0} />
      <Crush game={game} slot={1} />
      {[0, 1].map((i) => (
        <group key={i}>
          <MineSlot game={game} index={i} />
          <WallSlot game={game} index={i} />
          <UpdraftSlot game={game} index={i} />
          <PortalPair game={game} index={i} />
        </group>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <WellSlot key={i} game={game} index={i} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <StrikeSlot key={i} game={game} index={i} />
      ))}
      <ShotLights game={game} />
      <Scorches />
      <Rings />
      <KoBeams />
    </>
  );
}
