/**
 * The arena and its world. Purely decorative: collision lives in game/stage.ts,
 * and the slab and platforms here are sized from that same StageDef. Everything
 * else (sky, light, sea, backdrop) comes from the stage's Theme.
 */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { particles } from '../fx/fx';
import { ELEMENTS } from '../game/elements';
import type { Game } from '../game/sim';
import type { StageDef } from '../game/stage';
import { hdr } from './materials';
import { THEMES, type Theme } from './themes';

let tiles: THREE.CanvasTexture | null = null;

/** Greyscale flagstones (grout, per-stone tone, speckle, a few cracks). Tinted by the material colour. */
function tileTexture(): THREE.CanvasTexture {
  if (tiles) return tiles;
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  let s = 7;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  x.fillStyle = '#6f6f6f';
  x.fillRect(0, 0, size, size);
  const rows = 4;
  const cols = 4;
  const tw = size / cols;
  const th = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let q = -1; q < cols; q++) {
      const ox = q * tw + (r % 2 ? tw / 2 : 0);
      const v = 196 + Math.floor(rand() * 59);
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(ox + 3, r * th + 3, tw - 6, th - 6);
      // Worn top-left edge catches the light, bottom-right falls away.
      x.fillStyle = 'rgba(255,255,255,0.22)';
      x.fillRect(ox + 3, r * th + 3, tw - 6, 3);
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(ox + 3, r * th + th - 7, tw - 6, 4);
    }
  }
  for (let i = 0; i < 5200; i++) {
    x.fillStyle = rand() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    x.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
  }
  x.strokeStyle = 'rgba(0,0,0,0.3)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    let px = rand() * size;
    let py = rand() * size;
    x.beginPath();
    x.moveTo(px, py);
    for (let k = 0; k < 6; k++) {
      px += (rand() - 0.5) * 60;
      py += (rand() - 0.5) * 60;
      x.lineTo(px, py);
    }
    x.stroke();
  }
  tiles = new THREE.CanvasTexture(c);
  tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
  tiles.colorSpace = THREE.SRGBColorSpace;
  tiles.anisotropy = 8;
  return tiles;
}

/** A copy of the flagstone texture with its own repeat, for one surface. */
function tiled(rx: number, ry: number): THREE.Texture {
  const t = tileTexture().clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function Sky({ theme }: { theme: Theme }) {
  const mat = useMemo(() => {
    const v = (c: [number, number, number]) => new THREE.Vector3(...c);
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSun: { value: v(theme.sun.dir).normalize() },
        uSunColor: { value: v(theme.sun.color) },
        uDisc: { value: theme.sun.disc },
        uGlow: { value: theme.sun.glow },
        uZenith: { value: v(theme.sky.zenith) },
        uHigh: { value: v(theme.sky.high) },
        uLow: { value: v(theme.sky.low) },
        uHorizon: { value: v(theme.sky.horizon) },
        uBelow: { value: v(theme.sky.below) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun;
        uniform vec3 uSunColor;
        uniform float uDisc;
        uniform float uGlow;
        uniform vec3 uZenith;
        uniform vec3 uHigh;
        uniform vec3 uLow;
        uniform vec3 uHorizon;
        uniform vec3 uBelow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(uHorizon, uLow, smoothstep(0.0, 0.09, h));
          c = mix(c, uHigh, smoothstep(0.05, 0.3, h));
          c = mix(c, uZenith, smoothstep(0.25, 0.75, h));
          c = mix(c, uBelow, smoothstep(0.0, -0.22, h));
          float s = max(0.0, dot(d, uSun));
          c += uSunColor * pow(s, 10.0) * 0.4 * uGlow;
          c += uSunColor * pow(s, 120.0) * 0.7 * uGlow;
          c += uSunColor * smoothstep(0.9989, 0.9993, s) * uDisc;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
  }, [theme]);
  return (
    <mesh material={mat} renderOrder={-10}>
      <sphereGeometry args={[420, 32, 20]} />
    </mesh>
  );
}

function Stars({ opacity }: { opacity: number }) {
  const geo = useMemo(() => {
    const n = 800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      // Upper dome only, thinning toward the horizon.
      const y = 0.16 + 0.84 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(a) * r * 400;
      pos[i * 3 + 1] = y * 400;
      pos[i * 3 + 2] = Math.sin(a) * r * 400;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial color={hdr('#dfe6ff', 1.6)} size={1.6} sizeAttenuation={false} transparent opacity={opacity} depthWrite={false} fog={false} />
    </points>
  );
}

/** A jagged silhouette strip: `width` wide, peaks up to `height`, standing on y = 0. */
function ridgeGeometry(width: number, height: number, seed: number): THREE.BufferGeometry {
  const seg = 90;
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const ys: number[] = [];
  let y = 0.5;
  for (let i = 0; i <= seg; i++) {
    y += (rand() - 0.5) * 0.28;
    y = Math.max(0.12, Math.min(1, y));
    const u = i / seg;
    const big = 0.55 + 0.45 * Math.sin(u * Math.PI * 3.1 + seed) * Math.sin(u * 7.3 + seed * 2);
    ys.push(height * (0.35 * y + 0.65 * Math.max(0.1, big)));
  }
  const pos: number[] = [];
  for (let i = 0; i < seg; i++) {
    const x0 = (i / seg - 0.5) * width;
    const x1 = ((i + 1) / seg - 0.5) * width;
    pos.push(x0, -40, 0, x1, -40, 0, x1, ys[i + 1], 0, x0, -40, 0, x1, ys[i + 1], 0, x0, ys[i], 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

function Mountains({ colors }: { colors: [string, string, string] }) {
  const layers = useMemo(
    () => [
      { geo: ridgeGeometry(620, 70, 11), z: -260, y: -34 },
      { geo: ridgeGeometry(520, 52, 29), z: -190, y: -34 },
      { geo: ridgeGeometry(420, 36, 53), z: -130, y: -32 },
    ],
    [],
  );
  return (
    <>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geo} position={[0, l.y, l.z]}>
          <meshBasicMaterial color={colors[i]} fog={false} />
        </mesh>
      ))}
    </>
  );
}

/** The sea under the stage: drifting cloud, mist or glowing lava depending on the theme. */
function Sea({ sea }: { sea: Theme['sea'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 110;
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 320,
        y: -Math.random() * 8,
        z: 4 - Math.random() * 165,
        sx: 12 + Math.random() * 18,
        sy: 2.4 + Math.random() * 2.6,
        sz: 9 + Math.random() * 9,
        speed: 0.25 + Math.random() * 0.5,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      // Drift sideways forever, wrapping around the far edges.
      const x = ((((s.x + t * s.speed + 160) % 320) + 320) % 320) - 160;
      dummy.position.set(x, sea.y + s.y + Math.sin(t * 0.2 + i) * 0.5, s.z);
      dummy.scale.set(s.sx, s.sy, s.sz);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <sphereGeometry args={[1, 18, 12]} />
      <meshStandardMaterial color={sea.color} emissive={sea.emissive} emissiveIntensity={sea.glow} roughness={1} />
    </instancedMesh>
  );
}

/** Background drifters: lanterns rising, snow falling, or embers streaming up. */
function Motes({ motes }: { motes: Theme['motes'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = motes.count;
  const lantern = motes.kind === 'lantern';
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 130,
        y: Math.random() * 60,
        z: (lantern ? -10 : 6) - Math.random() * 80,
        speed: 0.5 + Math.random() * 0.9,
        phase: Math.random() * 10,
        s: 0.35 + Math.random() * 0.35,
      })),
    [COUNT, lantern],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    const rise = motes.kind === 'snow' ? -2.2 : motes.kind === 'ember' ? 3.4 : 1;
    const size = lantern ? 1 : motes.kind === 'snow' ? 0.22 : 0.16;
    for (let i = 0; i < COUNT; i++) {
      const s = seeds[i];
      const y = ((((s.y + t * s.speed * rise) % 60) + 60) % 60) - 14;
      dummy.position.set(s.x + Math.sin(t * 0.4 + s.phase) * (lantern ? 1.6 : 3), y, s.z);
      dummy.rotation.set(0, t * 0.3 + s.phase, Math.sin(t * 0.6 + s.phase) * 0.12);
      dummy.scale.set(s.s * size, s.s * size * (lantern ? 1.35 : 1), s.s * size);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh key={COUNT} ref={ref} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      {lantern ? <cylinderGeometry args={[0.42, 0.5, 1, 8]} /> : <icosahedronGeometry args={[1, 0]} />}
      <meshBasicMaterial color={hdr(motes.color, motes.glow)} fog={false} />
    </instancedMesh>
  );
}

function FloatingRocks({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  const rocks = useMemo(
    () => [
      { p: [-19, 5, -9], s: 1.7 },
      { p: [20, 8, -12], s: 2.2 },
      { p: [-25, 13, -22], s: 3 },
      { p: [27, 1, -18], s: 2.6 },
      { p: [-15, -5, -7], s: 1.4 },
      { p: [16, -6, -9], s: 1.8 },
      { p: [3, 15, -26], s: 2.4 },
      { p: [-34, 2, -30], s: 3.6 },
      { p: [38, 12, -34], s: 4 },
    ],
    [],
  );
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }), [color]);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < g.children.length; i++) {
      const c = g.children[i];
      c.position.y = rocks[i].p[1] + Math.sin(t * 0.35 + i * 1.9) * 0.6;
      c.rotation.set(t * 0.05 + i, t * 0.07 + i * 2, i);
    }
  });
  return (
    <group ref={group}>
      {rocks.map((r, i) => (
        <mesh key={i} geometry={geo} material={mat} position={r.p as [number, number, number]} scale={[r.s, r.s * 0.75, r.s * 0.9]} />
      ))}
    </group>
  );
}

/** A distant pagoda on its own floating island, lit from within. */
function Pagoda({ position, scale }: { position: [number, number, number]; scale: number }) {
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3f3550', roughness: 1, flatShading: true }), []);
  const wall = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5d2a3a', roughness: 0.9 }), []);
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ color: '#241c33', roughness: 0.8, flatShading: true }), []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr('#ffb45e', 2.4), fog: false }), []);
  return (
    <group position={position} scale={scale}>
      <mesh material={stone} position={[0, -5.4, 0]} rotation={[Math.PI, 0.4, 0]}>
        <coneGeometry args={[9, 10, 7]} />
      </mesh>
      <mesh material={stone} position={[0, -0.25, 0]}>
        <cylinderGeometry args={[9, 9, 0.6, 7]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const w = 5.2 - i * 1.05;
        return (
          <group key={i} position={[0, i * 3.1, 0]}>
            <mesh material={wall} position={[0, 1, 0]}>
              <boxGeometry args={[w, 2, w]} />
            </mesh>
            <mesh material={glow} position={[0, 1.05, w / 2 + 0.02]}>
              <planeGeometry args={[w * 0.55, 0.7]} />
            </mesh>
            <mesh material={roof} position={[0, 2.55, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[w * 1.05, 1.3, 4]} />
            </mesh>
          </group>
        );
      })}
      <mesh material={glow} position={[0, 13.7, 0]}>
        <sphereGeometry args={[0.22, 8, 6]} />
      </mesh>
    </group>
  );
}

function Torii() {
  const red = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a3261f', roughness: 0.7, emissive: '#3a0805', emissiveIntensity: 1 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1522', roughness: 0.8 }), []);
  return (
    <group position={[0, 0, -7]}>
      {[-8.2, 8.2].map((x) => (
        <group key={x}>
          <mesh material={red} position={[x, 5.2, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.5, 10.4, 12]} />
          </mesh>
          <mesh material={dark} position={[x, 0.3, 0]}>
            <cylinderGeometry args={[0.66, 0.74, 0.7, 12]} />
          </mesh>
        </group>
      ))}
      <mesh material={dark} position={[0, 10.75, 0]}>
        <boxGeometry args={[21.4, 0.42, 1.3]} />
      </mesh>
      <mesh material={red} position={[0, 10.35, 0]}>
        <boxGeometry args={[20, 0.55, 0.95]} />
      </mesh>
      <mesh material={red} position={[0, 8.7, 0]}>
        <boxGeometry args={[17.6, 0.5, 0.7]} />
      </mesh>
      <mesh material={red} position={[0, 9.5, 0]}>
        <boxGeometry args={[0.5, 1.2, 0.6]} />
      </mesh>
    </group>
  );
}

/** Curtains of light across the night sky. */
function Aurora() {
  const mats = useMemo(
    () =>
      [0, 1].map(
        (i) =>
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            fog: false,
            side: THREE.DoubleSide,
            blending: THREE.CustomBlending,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneFactor,
            uniforms: { uTime: { value: 0 }, uSeed: { value: i * 3.7 }, uGain: { value: i ? 0.5 : 0.8 } },
            vertexShader: /* glsl */ `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }`,
            fragmentShader: /* glsl */ `
              uniform float uTime;
              uniform float uSeed;
              uniform float uGain;
              varying vec2 vUv;
              void main() {
                float x = vUv.x * 6.283 + uSeed;
                float wave = sin(x * 1.3 + uTime * 0.21) * 0.5 + sin(x * 3.1 - uTime * 0.33) * 0.25 + sin(x * 0.6 + uTime * 0.09) * 0.4;
                float y = vUv.y + wave * 0.14;
                float band = smoothstep(0.12, 0.3, y) * (1.0 - smoothstep(0.34, 0.95, y));
                float rays = 0.55 + 0.45 * sin(vUv.x * 240.0 + wave * 9.0 + uSeed);
                float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
                vec3 col = mix(vec3(0.08, 1.0, 0.55), vec3(0.45, 0.3, 1.0), smoothstep(0.2, 0.8, y));
                gl_FragColor = vec4(col * band * rays * edge * uGain, 1.0);
              }`,
          }),
      ),
    [],
  );
  useFrame((state) => {
    for (const m of mats) m.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <>
      <mesh material={mats[0]} position={[-30, 78, -250]} rotation={[0.25, 0.1, 0.06]}>
        <planeGeometry args={[430, 120]} />
      </mesh>
      <mesh material={mats[1]} position={[60, 100, -280]} rotation={[0.3, -0.2, -0.1]}>
        <planeGeometry args={[380, 110]} />
      </mesh>
    </>
  );
}

/** Jagged spires behind and beside the stage: ice on the glacier, obsidian in the crater. */
function Spires({ color, emissive, glow }: { color: string; emissive: string; glow: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: glow, roughness: 0.35, flatShading: true }),
    [color, emissive, glow],
  );
  const list = useMemo(() => {
    let s = 31;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    const out: { p: [number, number, number]; h: number; r: number; tilt: number }[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const h = 5 + rand() * 13;
        out.push({ p: [side * (13 + rand() * 26), -9 + h / 2 + rand() * 4, -8 - rand() * 30], h, r: 1 + rand() * 1.8, tilt: (rand() - 0.5) * 0.35 });
      }
    }
    return out;
  }, []);
  return (
    <>
      {list.map((c, i) => (
        <mesh key={i} material={mat} position={c.p} rotation={[c.tilt * 0.5, i, c.tilt]}>
          <coneGeometry args={[c.r, c.h, 5]} />
        </mesh>
      ))}
    </>
  );
}

/** A far volcano with a glowing throat, throwing sparks. */
function Volcano() {
  const rock = useMemo(() => new THREE.MeshBasicMaterial({ color: '#190707', fog: false }), []);
  const lava = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr('#ff5a14', 3.2), fog: false }), []);
  const hot = useMemo(() => new THREE.Color('#ffc46b'), []);
  const warm = useMemo(() => new THREE.Color('#ff4a12'), []);
  useFrame((_, delta) => {
    const n = Math.min(3, Math.floor(delta * 40 + Math.random()));
    for (let i = 0; i < n; i++) {
      particles.spawn(-46 + (Math.random() - 0.5) * 8, 30, -170, (Math.random() - 0.5) * 16, 14 + Math.random() * 22, 0, 1.6 + Math.random() * 1.6, 3.2, 0.4, Math.random() < 0.4 ? hot : warm, 2.4, 14, 0.2);
    }
  });
  return (
    <group position={[-46, -34, -170]}>
      <mesh material={rock} position={[0, 30, 0]}>
        <cylinderGeometry args={[9, 62, 64, 9, 1, true]} />
      </mesh>
      <mesh material={lava} position={[0, 61.5, 0]}>
        <cylinderGeometry args={[8.6, 8.6, 1.2, 9]} />
      </mesh>
      {[-0.5, 0.3, 1.2].map((a, i) => (
        <mesh key={i} material={lava} position={[Math.sin(a) * 26, 30, Math.cos(a) * 26 + 3]} rotation={[0.42 * Math.cos(a), 0, -0.42 * Math.sin(a)]}>
          <boxGeometry args={[1.6 - i * 0.3, 60, 0.6]} />
        </mesh>
      ))}
    </group>
  );
}

/** The lamp at each end of the stage: a live flame, or a humming crystal. */
function Lamp({ x, lamp }: { x: number; lamp: Theme['lamp'] }) {
  const light = useRef<THREE.PointLight>(null);
  const gem = useRef<THREE.Mesh>(null);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4b445c', roughness: 1, flatShading: true }), []);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr(lamp.color, 3) }), [lamp.color]);
  const hot = useMemo(() => new THREE.Color('#ffd27a'), []);
  const warm = useMemo(() => new THREE.Color(lamp.color), [lamp.color]);
  const fire = lamp.kind === 'fire';
  const z = -2.55;
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (light.current) {
      light.current.intensity = fire
        ? lamp.intensity + Math.sin(t * 17 + x) * 5 + Math.sin(t * 31 + x * 2) * 3
        : lamp.intensity * (0.85 + 0.15 * Math.sin(t * 2 + x));
    }
    if (gem.current) {
      gem.current.rotation.y = t * 0.8 + x;
      gem.current.position.y = 2.5 + Math.sin(t * 1.6 + x) * 0.12;
    }
    if (!fire) return;
    const n = Math.min(4, Math.floor(delta * 70 + Math.random()));
    for (let i = 0; i < n; i++) {
      particles.spawn(x + (Math.random() - 0.5) * 0.5, 2.05, z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.7, 1.5 + Math.random() * 2.4, 0, 0.35 + Math.random() * 0.45, 0.55, 0.05, Math.random() < 0.4 ? hot : warm, 2.2, -1.5, 0.6);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh material={stone} position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.42, 1.6, 6]} />
      </mesh>
      <mesh material={stone} position={[0, 1.78, 0]} castShadow>
        <cylinderGeometry args={[0.72, 0.36, 0.42, 8]} />
      </mesh>
      {fire ? (
        <mesh material={glow} position={[0, 1.98, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.06, 8]} />
        </mesh>
      ) : (
        <mesh ref={gem} material={glow} position={[0, 2.5, 0]} scale={[0.34, 0.6, 0.34]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      )}
      <pointLight ref={light} color={lamp.color} intensity={lamp.intensity} distance={16} decay={2} position={[0, 2.7, 0.6]} />
    </group>
  );
}

/** The rift's sky: a ringed gas giant hanging behind everything. */
function Planet() {
  const body = useMemo(() => new THREE.MeshBasicMaterial({ color: '#3a1560', fog: false }), []);
  const lit = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr('#ff7fc0', 1.2), fog: false, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), []);
  return (
    <group position={[70, 60, -300]} rotation={[0.5, 0, 0.35]}>
      <mesh material={body}>
        <sphereGeometry args={[46, 32, 20]} />
      </mesh>
      <mesh material={lit} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[62, 92, 64]} />
      </mesh>
    </group>
  );
}

/** The foundry's skyline: stacks with burning mouths, breathing smoke. */
function Chimneys() {
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: '#26262b', roughness: 0.8, metalness: 0.4 }), []);
  const mouth = useMemo(() => new THREE.MeshBasicMaterial({ color: hdr('#ff7a2a', 3) }), []);
  const smoke = useMemo(() => new THREE.Color('#5a4a40'), []);
  const stacks = useMemo(
    () => [
      { x: -30, h: 30, r: 2.4, z: -34 },
      { x: -17, h: 22, r: 1.8, z: -22 },
      { x: 19, h: 26, r: 2.1, z: -26 },
      { x: 33, h: 36, r: 2.8, z: -42 },
      { x: 4, h: 40, r: 3.2, z: -60 },
    ],
    [],
  );
  useFrame((_, delta) => {
    for (const c of stacks) {
      if (Math.random() < delta * 9) {
        particles.spawn(c.x + (Math.random() - 0.5) * c.r, c.h - 12, c.z, (Math.random() - 0.5) * 2 + 1.5, 4 + Math.random() * 4, 0, 2 + Math.random() * 2, c.r * 1.6, c.r * 5, smoke, 0.5, -0.5, 0.2);
      }
    }
  });
  return (
    <>
      {stacks.map((c, i) => (
        <group key={i} position={[c.x, -12, c.z]}>
          <mesh material={iron} position={[0, c.h / 2, 0]}>
            <cylinderGeometry args={[c.r * 0.8, c.r, c.h, 10]} />
          </mesh>
          <mesh material={mouth} position={[0, c.h, 0]}>
            <cylinderGeometry args={[c.r * 0.72, c.r * 0.72, 0.4, 10]} />
          </mesh>
          <mesh material={mouth} position={[0, c.h * 0.55, 0]}>
            <cylinderGeometry args={[c.r * 0.93, c.r * 0.93, 0.5, 10]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

let chevrons: THREE.CanvasTexture | null = null;
/** Arrowheads for the conveyor, scrolled along it by offsetting the texture. */
function chevronTexture(): THREE.CanvasTexture {
  if (chevrons) return chevrons;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const x = c.getContext('2d')!;
  x.strokeStyle = '#ffffff';
  x.lineWidth = 12;
  x.lineJoin = 'miter';
  x.beginPath();
  x.moveTo(40, 8);
  x.lineTo(80, 32);
  x.lineTo(40, 56);
  x.stroke();
  chevrons = new THREE.CanvasTexture(c);
  chevrons.wrapS = THREE.RepeatWrapping;
  return chevrons;
}

/** The foundry floor: a strip of arrows running whichever way the belt is going. */
function Belt({ game, width }: { game: Game; width: number }) {
  const mat = useMemo(() => {
    const map = chevronTexture().clone();
    map.repeat.set(width / 1.4, 1);
    map.needsUpdate = true;
    return new THREE.MeshBasicMaterial({ map, color: hdr('#ffb347', 1.6), transparent: true, opacity: 0.85, depthWrite: false });
  }, [width]);
  useFrame((_, delta) => {
    const map = mat.map!;
    map.offset.x -= game.beltDir * delta * 2.6;
    // The arrows are drawn pointing right; mirror the strip when the belt runs left.
    map.repeat.x = (width / 1.4) * game.beltDir;
  });
  return (
    <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 2.75]}>
      <planeGeometry args={[width, 0.9]} />
    </mesh>
  );
}

function MainPlatform({ stage, theme }: { stage: StageDef; theme: Theme }) {
  const w = stage.main.w;
  const st = theme.stone;
  const mats = useMemo(
    () => ({
      floor: new THREE.MeshStandardMaterial({ color: st.top, map: tiled(w / 2.75, 2.5), roughness: 0.82 }),
      top: new THREE.MeshStandardMaterial({ color: st.top, roughness: 0.85 }),
      mid: new THREE.MeshStandardMaterial({ color: st.mid, roughness: 0.95 }),
      low: new THREE.MeshStandardMaterial({ color: st.low, roughness: 1 }),
      rock: new THREE.MeshStandardMaterial({ color: st.rock, roughness: 1, flatShading: true }),
      inlay: new THREE.MeshStandardMaterial({ color: '#221d2e', roughness: 0.45, metalness: 0.25 }),
      edge: new THREE.MeshBasicMaterial({ color: hdr(theme.edge, 1.5) }),
    }),
    [st, theme.edge, w],
  );
  const arcs = useMemo(
    () =>
      (['fire', 'water', 'earth', 'air'] as const).map((id, i) => ({
        geo: new THREE.RingGeometry(1.95, 2.3, 28, 1, (i * Math.PI) / 2 + 0.07, Math.PI / 2 - 0.14),
        mat: new THREE.MeshBasicMaterial({ color: hdr(ELEMENTS[id].color, 1.5), side: THREE.DoubleSide }),
      })),
    [],
  );
  // Rock hanging under the slab, spread across whatever width this stage has.
  const hanging = useMemo(
    () =>
      [
        { u: -0.73, r: 2.4, h: 4.2, z: 0.3 },
        { u: -0.38, r: 3.1, h: 6.4, z: -0.4 },
        { u: 0.03, r: 3.6, h: 8.2, z: 0.2 },
        { u: 0.42, r: 3.0, h: 5.8, z: -0.3 },
        { u: 0.75, r: 2.3, h: 3.8, z: 0.4 },
      ].map((c) => ({ ...c, x: (c.u * w) / 2, r: (c.r * w) / 22 })),
    [w],
  );
  return (
    <group>
      <mesh material={mats.top} position={[0, -0.25, 0]} castShadow>
        <boxGeometry args={[w + 0.4, 0.5, 7]} />
      </mesh>
      <mesh material={mats.floor} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w + 0.4, 7]} />
      </mesh>
      <mesh material={mats.mid} position={[0, -1.15, 0]} receiveShadow>
        <boxGeometry args={[w - 0.6, 1.3, 6.3]} />
      </mesh>
      <mesh material={mats.low} position={[0, -2.2, 0]}>
        <boxGeometry args={[w - 2.6, 0.8, 5.5]} />
      </mesh>
      {hanging.map((c, i) => (
        <mesh key={i} material={mats.rock} position={[c.x, -2.6 - c.h / 2, c.z]} rotation={[Math.PI, i * 0.9, 0]} scale={[1, 1, 0.7]}>
          <coneGeometry args={[c.r, c.h, 6]} />
        </mesh>
      ))}
      {/* Glowing lip along the front edge so the stage boundary reads at any zoom. */}
      <mesh material={mats.edge} position={[0, -0.02, 3.5]}>
        <boxGeometry args={[w + 0.4, 0.05, 0.06]} />
      </mesh>
      <mesh material={mats.edge} position={[0, -0.5, 3.5]}>
        <boxGeometry args={[w + 0.4, 0.03, 0.04]} />
      </mesh>
      {/* Four-element seal inlaid at centre stage. */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0.4]}>
        <mesh material={mats.inlay} receiveShadow>
          <circleGeometry args={[1.8, 40]} />
        </mesh>
        {arcs.map((a, i) => (
          <mesh key={i} geometry={a.geo} material={a.mat} position={[0, 0, 0.004]} />
        ))}
        <mesh material={mats.edge} position={[0, 0, 0.004]}>
          <ringGeometry args={[2.55, 2.62, 48]} />
        </mesh>
      </group>
    </group>
  );
}

function SoftPlatforms({ stage, theme }: { stage: StageDef; theme: Theme }) {
  const softs = stage.platforms.filter((p) => !p.solid);
  const mats = useMemo(
    () => ({
      slab: new THREE.MeshStandardMaterial({ color: theme.stone.soft, roughness: 0.85 }),
      tops: softs.map((p) => new THREE.MeshStandardMaterial({ color: theme.stone.soft, map: tiled(p.w / 2.75, 1), roughness: 0.82 })),
      rock: new THREE.MeshStandardMaterial({ color: theme.stone.rock, roughness: 1, flatShading: true }),
      rune: new THREE.MeshBasicMaterial({ color: hdr(theme.rune, 1.7) }),
    }),
    // `softs` is derived from `stage`, so keying on the stage is enough.
    [theme, stage],
  );
  const group = useRef<THREE.Group>(null);
  // Platforms move, shake and vanish during a match, so follow the live stage every frame.
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < softs.length; i++) {
      const p = softs[i];
      const node = g.children[i];
      node.visible = p.gone <= 0;
      const rattle = p.shake > 0 ? Math.sin(t * 70 + i) * 0.05 * Math.min(1, p.shake * 2) : 0;
      node.position.set(p.x + rattle, p.y - rattle * 0.5, 0);
    }
  });
  return (
    <group ref={group}>
      {softs.map((p, i) => (
        <group key={i} position={[p.x, p.y, 0]}>
          <mesh material={mats.slab} position={[0, -p.thick / 2, 0]} castShadow>
            <boxGeometry args={[p.w, p.thick, 2.7]} />
          </mesh>
          <mesh material={mats.tops[i]} position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[p.w, 2.7]} />
          </mesh>
          <mesh material={mats.rune} position={[0, -p.thick / 2, 1.36]}>
            <boxGeometry args={[p.w * 0.72, 0.05, 0.03]} />
          </mesh>
          <mesh material={mats.rock} position={[0, -p.thick - 0.75, 0]} rotation={[Math.PI, i, 0]} scale={[1, 1, 0.6]}>
            <coneGeometry args={[p.w * 0.36, 1.5, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Stage({ game }: { game: Game }) {
  const stage = game.stage;
  const theme = THEMES[stage.id];
  const lampX = stage.main.w / 2 - 0.8;
  return (
    <>
      <fog attach="fog" args={[theme.fog, 70, 260]} />
      <ambientLight intensity={theme.ambient[1]} color={theme.ambient[0]} />
      <hemisphereLight args={[theme.hemi[0], theme.hemi[1], theme.hemi[2]]} />
      <directionalLight
        position={theme.key.pos}
        intensity={theme.key.intensity}
        color={theme.key.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={18}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      {/* Rim light from behind the stage: the low sun, the aurora, or the lava. */}
      <directionalLight position={theme.rim.pos} intensity={theme.rim.intensity} color={theme.rim.color} />
      <Sky theme={theme} />
      <Stars opacity={theme.stars} />
      <Mountains colors={theme.mountains} />
      <Sea sea={theme.sea} />
      <Motes motes={theme.motes} />
      <FloatingRocks color={theme.stone.mid} />
      {theme.decor === 'temple' && (
        <>
          <Pagoda position={[-44, 0, -70]} scale={1.9} />
          <Pagoda position={[52, 10, -100]} scale={1.5} />
          <Torii />
        </>
      )}
      {theme.decor === 'glacier' && (
        <>
          <Aurora />
          <Spires color="#a9dcff" emissive="#1f6fa8" glow={0.9} />
        </>
      )}
      {theme.decor === 'crater' && (
        <>
          <Volcano />
          <Spires color="#241c22" emissive="#ff3a10" glow={0.12} />
          <pointLight color="#ff4a12" intensity={420} distance={60} decay={2} position={[0, -12, 2]} />
        </>
      )}
      {theme.decor === 'storm' && <Spires color="#2a3342" emissive="#ffe14a" glow={0.05} />}
      {theme.decor === 'rift' && (
        <>
          <Planet />
          <Aurora />
        </>
      )}
      {theme.decor === 'foundry' && (
        <>
          <Chimneys />
          <pointLight color="#ff5a1a" intensity={380} distance={60} decay={2} position={[0, -12, 2]} />
        </>
      )}
      {stage.belt && <Belt game={game} width={stage.main.w} />}
      <Lamp x={-lampX} lamp={theme.lamp} />
      <Lamp x={lampX} lamp={theme.lamp} />
      <MainPlatform stage={stage} theme={theme} />
      <SoftPlatforms stage={stage} theme={theme} />
    </>
  );
}
