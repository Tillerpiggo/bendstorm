import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { audio } from '../fx/audio';
import type { ScoreState } from '../fx/music';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { emitContinuous, fx, handleEvent, particles, resetFx, simSteps, updateFx } from '../fx/fx';
import { endInputStep, pollGamepads, sampleInput } from '../game/input';
import { NO_INPUT, type InputFrame } from '../game/types';
import { Entities } from './Entities';
import { FighterModel } from './FighterModel';
import { particleMaterial } from './materials';
import { PLAYER_COLORS, type Session } from './session';
import { Stage } from './Stage';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

interface DriverProps {
  session: Session;
  paused: boolean;
  /** Fired once, a beat after the final KO. */
  onFinished: () => void;
}

/**
 * The one place the sim advances. Runs before every other per-frame callback
 * so models, camera and particles all read the same, freshly stepped state.
 */
function Driver({ session, paused, onFinished }: DriverProps) {
  const acc = useRef({ v: 0 });
  const done = useRef(false);
  // Reused every frame: the score reads it and keeps nothing.
  const scoreState = useRef<ScoreState>({ players: [{ stocks: 3, damage: 0 }, { stocks: 3, damage: 0 }] });

  useEffect(() => {
    acc.current.v = 0;
    done.current = false;
    fx.silent = session.kind !== 'match';
    resetFx();
  }, [session]);

  useFrame((_, delta) => {
    const realDt = Math.min(delta, 0.05);
    const g = session.game;
    pollGamepads();
    updateFx(realDt);
    if (paused) {
      // Don't let keys mashed on the pause menu fire as attacks on resume.
      endInputStep();
      return;
    }

    const input = (i: 0 | 1): InputFrame => {
      const c = session.controllers[i];
      if (c === 'human') return sampleInput(i);
      const bot = session.bots[i];
      return c === 'cpu' && bot ? bot.sample(g, i) : NO_INPUT;
    };
    const n = simSteps(acc.current, realDt);
    for (let i = 0; i < n; i++) {
      g.step(input(0), input(1));
      endInputStep();
    }
    for (const e of g.events) handleEvent(e, g);
    g.events.length = 0;
    // Tell the score what is happening so it can follow the fight.
    if (session.kind === 'match') {
      const main = g.stage.main;
      const caster = g.ultCaster();
      const s = scoreState.current;
      for (let i = 0; i < 2; i++) {
        const f = g.fighters[i];
        const p = s.players[i];
        p.stocks = f.stocks;
        p.damage = f.damage;
        p.meter = f.meter;
        p.dead = f.state === 'dead';
        p.offstage = !p.dead && !f.ground && f.state !== 'ledge' && (Math.abs(f.x - main.x) > main.w / 2 || f.y < main.y - 0.5);
      }
      s.countdown = Math.max(0, g.introT);
      s.ultimate = caster ? caster.id : null;
      s.over = g.winner >= 0;
      s.winner = g.winner >= 0 ? (g.winner as 0 | 1) : null;
      audio.score(s);
    }

    const dt = realDt * fx.timeScale;
    emitContinuous(g, dt);
    particles.update(dt);

    const limit = session.kind === 'match' ? 2.4 : 3.5;
    const stale = session.kind === 'attract' && g.time > 150;
    if (!done.current && ((g.winner >= 0 && g.overT > limit) || stale)) {
      done.current = true;
      onFinished();
    }
  }, -3);

  return null;
}

function ParticleField() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const dyn = (arr: Float32Array, n: number) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(particles.pos, 3));
    g.setAttribute('aColor', dyn(particles.col, 3));
    g.setAttribute('aSize', dyn(particles.size, 1));
    g.setAttribute('aAlpha', dyn(particles.alpha, 1));
    return g;
  }, []);
  const mat = useMemo(() => particleMaterial(), []);

  useFrame((state) => {
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    // Converts a world-space diameter to pixels at distance 1.
    const cam = state.camera as THREE.PerspectiveCamera;
    mat.uniforms.uScale.value = state.gl.domElement.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />;
}

/** Frames both fighters, Smash-style: pans to their midpoint and zooms with their distance. */
function CameraRig({ session }: { session: Session }) {
  const cur = useRef({ x: 0, y: 3.5, d: 30, roll: 0 });

  useFrame((state, delta) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const g = session.game;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const c = cur.current;
    const tanH = Math.tan((cam.fov * Math.PI) / 360);
    const aspect = state.size.width / Math.max(1, state.size.height);

    let tx = 0;
    let ty = 3.4;
    let td = 30;
    let rate = 3.2;
    let roll = 0;
    const caster = g.ultCaster();
    fx.camera = cam;
    if (session.kind === 'preview') {
      ty = 1.15;
      td = Math.max(9.5, 4.6 / (2 * tanH * aspect));
    } else if (g.winner >= 0 && g.overT > 1.1 && session.kind === 'match') {
      // Victory shot: close on the winner, framed low so the results sit above them.
      const w = g.fighters[g.winner];
      tx = w.x;
      ty = w.y + 2.5;
      td = 13;
      rate = 2.4;
    } else if (caster) {
      // Punch in on whoever is charging their ultimate.
      tx = caster.x + caster.facing * 1.6;
      ty = caster.y + 1.1;
      td = 11.5;
      rate = 9;
      roll = caster.facing * 0.07;
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const f of g.fighters) {
        if (f.state === 'dead') continue;
        const x = clamp(f.x, -21, 21);
        const y = clamp(f.y, -6, 17);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (fx.focusT > 0) {
        const x = clamp(fx.focusX, -21, 21);
        const y = clamp(fx.focusY, -6, 17);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (minX === Infinity) {
        minX = maxX = 0;
        minY = maxY = 2;
      }
      // Tight when they are trading blows, wide when one is being launched.
      const spanX = maxX - minX + 8.5;
      const spanY = maxY - minY + 6;
      td = clamp(Math.max(spanX / (2 * tanH * aspect), spanY / (2 * tanH)), 11.5, 56);
      tx = clamp((minX + maxX) / 2, -14, 14) * 0.9;
      ty = clamp((minY + maxY) / 2 + 0.75, 0.9, 11);
      if (session.kind === 'attract') {
        td += 5;
        tx += Math.sin(t * 0.23) * 2.5;
      }
      if (fx.swagT > 0) {
        // Lean in on a taunt: the camera is in on the joke.
        const k = Math.min(1, fx.swagT / 0.3) * 0.55;
        td *= 1 - 0.24 * k;
        tx += (fx.swagX - tx) * 0.5 * k;
        ty += (fx.swagY + 0.4 - ty) * 0.5 * k;
      }
      if (fx.crit > 0) {
        // Punch in on a killing blow.
        const k = fx.crit * fx.crit;
        td *= 1 - 0.3 * k;
        tx += (fx.critX - tx) * 0.5 * k;
        ty += (fx.critY - ty) * 0.5 * k;
        rate = 3.2 + 10 * k;
      }
    }

    const k = 1 - Math.exp(-dt * rate);
    c.x += (tx - c.x) * k;
    c.y += (ty - c.y) * k;
    c.d += (td - c.d) * k;
    c.roll += (roll - c.roll) * (1 - Math.exp(-dt * 8));

    const s = fx.shake * fx.shake;
    const ox = (Math.sin(t * 91) + Math.sin(t * 57.3)) * 0.45 * s;
    const oy = (Math.sin(t * 83.1) + Math.cos(t * 49.7)) * 0.45 * s;
    cam.position.set(c.x + ox, c.y + 1 + c.d * 0.055 + oy, c.d);
    cam.lookAt(c.x + ox * 0.4, c.y + oy * 0.4, 0);
    cam.rotation.z += c.roll + ox * 0.012;
  }, -1);

  return null;
}

/** Bloom, a colour-fringe that kicks on big hits, vignette and tone mapping. */
function PostFx() {
  const offset = useMemo(() => new THREE.Vector2(0, 0), []);
  useFrame(() => {
    const k = 0.0004 + fx.crit * 0.006 + fx.shake * fx.shake * 0.003;
    offset.set(k, k * 0.6);
  });
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={1.15} luminanceThreshold={1} luminanceSmoothing={0.25} radius={0.78} />
      <ChromaticAberration offset={offset} radialModulation modulationOffset={0.25} />
      <Vignette darkness={0.6} offset={0.22} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

/** Deep Fry really does drop the resolution: the scene is rendered tiny and scaled back up, blocky. */
function FryResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const low = useRef(false);
  useFrame(() => {
    const want = fx.fry > 0.5;
    if (want === low.current) return;
    low.current = want;
    setDpr(want ? 0.22 : Math.min(window.devicePixelRatio, 1.75));
  });
  return null;
}

interface Props extends DriverProps {
  labels: [string, string];
}

export function GameCanvas({ session, paused, onFinished, labels }: Props) {
  const mirror = session.rules.elements[0] === session.rules.elements[1];
  return (
    <Canvas
      shadows
      flat
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 36, near: 0.5, far: 700, position: [0, 5, 30] }}
    >
      <color attach="background" args={['#0b0a1f']} />
      <Stage key={session.rules.stage} game={session.game} />
      {([0, 1] as const).map((slot) => (
        <FighterModel
          key={`${session.key}-${slot}`}
          game={session.game}
          slot={slot}
          label={labels[slot]}
          labelColor={PLAYER_COLORS[slot]}
          alt={mirror && slot === 1}
        />
      ))}
      <Entities key={session.key} game={session.game} />
      <ParticleField />
      <CameraRig session={session} />
      <Driver session={session} paused={paused} onFinished={onFinished} />
      <FryResolution />
      <PostFx />
    </Canvas>
  );
}
