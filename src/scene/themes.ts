import type { StageId } from '../game/stage';

type RGB = [number, number, number];

/** How one arena looks. Collision for the same id lives in game/stage.ts. */
export interface Theme {
  /** Sky gradient stops, linear RGB, from straight up down to below the horizon. */
  sky: { zenith: RGB; high: RGB; low: RGB; horizon: RGB; below: RGB };
  /** Direction to the sun or moon, its disc colour, and how hard it glows. */
  sun: { dir: RGB; color: RGB; disc: number; glow: number };
  stars: number;
  fog: string;
  ambient: [string, number];
  hemi: [string, string, number];
  key: { color: string; intensity: number; pos: RGB };
  rim: { color: string; intensity: number; pos: RGB };
  /** The sea below the stage: cloud, mist or lava. */
  sea: { color: string; emissive: string; glow: number; y: number };
  mountains: [string, string, string];
  /** Things drifting through the background. */
  motes: { kind: 'lantern' | 'snow' | 'ember'; color: string; glow: number; count: number };
  stone: { top: string; mid: string; low: string; rock: string; soft: string };
  edge: string;
  rune: string;
  /** Lamp at each end of the stage. */
  lamp: { kind: 'fire' | 'crystal'; color: string; intensity: number };
  decor: 'temple' | 'glacier' | 'crater' | 'storm' | 'rift' | 'foundry';
}

export const THEMES: Record<StageId, Theme> = {
  temple: {
    sky: { zenith: [0.012, 0.02, 0.085], high: [0.09, 0.045, 0.2], low: [0.62, 0.17, 0.2], horizon: [1.0, 0.52, 0.22], below: [0.1, 0.05, 0.16] },
    sun: { dir: [0.28, 0.1, -1], color: [1.0, 0.82, 0.55], disc: 2.4, glow: 1 },
    stars: 0.85,
    fog: '#4a2140',
    ambient: ['#b9a7ff', 0.32],
    hemi: ['#8f86ff', '#5a2a2e', 0.85],
    key: { color: '#ffd9b0', intensity: 3.1, pos: [9, 20, 13] },
    rim: { color: '#ff7a45', intensity: 2.4, pos: [-8, 7, -16] },
    sea: { color: '#c98aa0', emissive: '#5a2440', glow: 0.9, y: -20 },
    mountains: ['#a8485a', '#6c2f58', '#3d1f4a'],
    motes: { kind: 'lantern', color: '#ff9b3d', glow: 2.6, count: 64 },
    stone: { top: '#a39bb8', mid: '#5a536c', low: '#443d55', rock: '#322c42', soft: '#aaa2c2' },
    edge: '#ffc36b',
    rune: '#7fe3ff',
    lamp: { kind: 'fire', color: '#ff8a3c', intensity: 26 },
    decor: 'temple',
  },
  glacier: {
    sky: { zenith: [0.004, 0.01, 0.045], high: [0.008, 0.04, 0.12], low: [0.02, 0.13, 0.22], horizon: [0.16, 0.42, 0.52], below: [0.015, 0.04, 0.09] },
    sun: { dir: [-0.34, 0.4, -1], color: [0.85, 0.93, 1.0], disc: 3.2, glow: 0.35 },
    stars: 1,
    fog: '#0c2a44',
    ambient: ['#9fc4ff', 0.34],
    hemi: ['#7fb6ff', '#16263f', 0.9],
    key: { color: '#d5e9ff', intensity: 2.7, pos: [-10, 20, 12] },
    rim: { color: '#58f0c8', intensity: 2.2, pos: [8, 8, -16] },
    sea: { color: '#86b2d6', emissive: '#16324f', glow: 0.9, y: -21 },
    mountains: ['#3d6f8f', '#234a6b', '#14304d'],
    motes: { kind: 'snow', color: '#e8f6ff', glow: 1.5, count: 180 },
    stone: { top: '#c3dcef', mid: '#6f90b3', low: '#48658a', rock: '#2b4466', soft: '#d6ecf8' },
    edge: '#8ff2ff',
    rune: '#b6fff0',
    lamp: { kind: 'crystal', color: '#6fe8ff', intensity: 22 },
    decor: 'glacier',
  },
  crater: {
    sky: { zenith: [0.022, 0.006, 0.01], high: [0.1, 0.018, 0.018], low: [0.42, 0.07, 0.025], horizon: [1.0, 0.34, 0.07], below: [0.3, 0.06, 0.02] },
    sun: { dir: [0.1, -0.04, -1], color: [1.0, 0.5, 0.2], disc: 0, glow: 1.5 },
    stars: 0.22,
    fog: '#3a0f0a',
    ambient: ['#ffb199', 0.26],
    hemi: ['#ff8f66', '#2a0a08', 0.8],
    key: { color: '#ffd0a8', intensity: 2.6, pos: [8, 20, 13] },
    rim: { color: '#ff4a1a', intensity: 3.4, pos: [-4, -6, -12] },
    sea: { color: '#ff5a1a', emissive: '#ff3300', glow: 2.4, y: -17 },
    mountains: ['#6a1a12', '#40100e', '#220909'],
    motes: { kind: 'ember', color: '#ff7a2a', glow: 3.2, count: 150 },
    stone: { top: '#70646c', mid: '#3d353b', low: '#2a2428', rock: '#1b171b', soft: '#7d7077' },
    edge: '#ff7a3a',
    rune: '#ffb347',
    lamp: { kind: 'fire', color: '#ff6a2a', intensity: 30 },
    decor: 'crater',
  },
  carousel: {
    sky: { zenith: [0.01, 0.015, 0.03], high: [0.03, 0.05, 0.09], low: [0.09, 0.13, 0.18], horizon: [0.3, 0.36, 0.42], below: [0.02, 0.03, 0.05] },
    sun: { dir: [0.2, 0.5, -1], color: [0.8, 0.85, 1.0], disc: 0, glow: 0.25 },
    stars: 0,
    fog: '#1a2433',
    ambient: ['#a9c0e0', 0.36],
    hemi: ['#8fa8d0', '#1a1f2c', 0.85],
    key: { color: '#dfe9ff', intensity: 2.4, pos: [6, 20, 13] },
    rim: { color: '#ffe14a', intensity: 1.8, pos: [-8, 8, -16] },
    sea: { color: '#4a5868', emissive: '#141c28', glow: 0.8, y: -20 },
    mountains: ['#2c3a4c', '#1e2938', '#131b27'],
    motes: { kind: 'snow', color: '#bcd0ee', glow: 1.2, count: 220 },
    stone: { top: '#98a5ba', mid: '#4d586b', low: '#394253', rock: '#262d3a', soft: '#aab7cc' },
    edge: '#ffe14a',
    rune: '#fff6b0',
    lamp: { kind: 'crystal', color: '#ffe14a', intensity: 20 },
    decor: 'storm',
  },
  rift: {
    sky: { zenith: [0.02, 0.0, 0.06], high: [0.08, 0.01, 0.16], low: [0.25, 0.03, 0.3], horizon: [0.9, 0.25, 0.6], below: [0.03, 0.0, 0.08] },
    sun: { dir: [-0.3, 0.3, -1], color: [1.0, 0.6, 0.9], disc: 0, glow: 0.6 },
    stars: 1,
    fog: '#22093a',
    ambient: ['#d0a8ff', 0.36],
    hemi: ['#b98fff', '#1a0a2e', 0.85],
    key: { color: '#f0d9ff', intensity: 2.5, pos: [8, 20, 13] },
    rim: { color: '#ff4fa3', intensity: 2.6, pos: [-8, 7, -16] },
    sea: { color: '#7a3fb0', emissive: '#3a0f6a', glow: 1.3, y: -21 },
    mountains: ['#5a1f7a', '#35104f', '#1c0830'],
    motes: { kind: 'ember', color: '#ff9be0', glow: 2.6, count: 140 },
    stone: { top: '#a69bcc', mid: '#55497a', low: '#3d335c', rock: '#261f3d', soft: '#b9aee2' },
    edge: '#ff4fa3',
    rune: '#7fe3ff',
    lamp: { kind: 'crystal', color: '#ff4fa3', intensity: 22 },
    decor: 'rift',
  },
  foundry: {
    sky: { zenith: [0.02, 0.015, 0.012], high: [0.07, 0.04, 0.03], low: [0.24, 0.11, 0.05], horizon: [0.75, 0.34, 0.1], below: [0.1, 0.04, 0.02] },
    sun: { dir: [0, 0.02, -1], color: [1.0, 0.55, 0.2], disc: 0, glow: 1 },
    stars: 0.1,
    fog: '#2a1a12',
    ambient: ['#ffd0a8', 0.3],
    hemi: ['#ffb07a', '#1a1410', 0.85],
    key: { color: '#ffe2c2', intensity: 2.6, pos: [8, 20, 13] },
    rim: { color: '#ff7a2a', intensity: 2.8, pos: [-6, 4, -14] },
    sea: { color: '#ff6a1a', emissive: '#ff3a00', glow: 2, y: -19 },
    mountains: ['#3a2418', '#241610', '#140c08'],
    motes: { kind: 'ember', color: '#ffa040', glow: 3, count: 120 },
    stone: { top: '#878b94', mid: '#44474e', low: '#2f3136', rock: '#1c1d20', soft: '#979ca6' },
    edge: '#ffb347',
    rune: '#ff7a3a',
    lamp: { kind: 'fire', color: '#ff7a2a', intensity: 28 },
    decor: 'foundry',
  },
};
