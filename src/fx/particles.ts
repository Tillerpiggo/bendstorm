import * as THREE from 'three';

/**
 * A fixed pool of additive point sprites, simulated on the CPU.
 * Spawning overwrites the oldest slot, so it never allocates and never fails.
 * The typed arrays are handed straight to a BufferGeometry by ParticleField.
 */
export class ParticleSystem {
  readonly max: number;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private size0: Float32Array;
  private size1: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private cursor = 0;

  constructor(max: number) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
  }

  /**
   * `size`/`sizeEnd` are world-unit diameters at birth and death. `gravity` is
   * downward acceleration (negative floats up), `drag` is per-second velocity decay.
   */
  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size: number,
    sizeEnd: number,
    color: THREE.Color,
    intensity = 1,
    gravity = 0,
    drag = 0,
  ): void {
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    const j = i * 3;
    this.pos[j] = x;
    this.pos[j + 1] = y;
    this.pos[j + 2] = z;
    this.vel[j] = vx;
    this.vel[j + 1] = vy;
    this.vel[j + 2] = vz;
    this.col[j] = color.r * intensity;
    this.col[j + 1] = color.g * intensity;
    this.col[j + 2] = color.b * intensity;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size;
    this.size1[i] = sizeEnd;
    this.grav[i] = gravity;
    this.drag[i] = drag;
    this.size[i] = size;
    this.alpha[i] = 1;
  }

  update(dt: number): void {
    const { pos, vel, life, maxLife, size, alpha, size0, size1, grav, drag } = this;
    for (let i = 0; i < this.max; i++) {
      const l = life[i];
      if (l <= 0) continue;
      const nl = l - dt;
      if (nl <= 0) {
        life[i] = 0;
        size[i] = 0;
        alpha[i] = 0;
        continue;
      }
      life[i] = nl;
      const j = i * 3;
      const d = drag[i];
      if (d > 0) {
        const k = Math.exp(-d * dt);
        vel[j] *= k;
        vel[j + 1] *= k;
        vel[j + 2] *= k;
      }
      vel[j + 1] -= grav[i] * dt;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      const u = nl / maxLife[i];
      size[i] = size1[i] + (size0[i] - size1[i]) * u;
      alpha[i] = u > 0.5 ? 1 : u * 2;
    }
  }

  clear(): void {
    this.life.fill(0);
    this.size.fill(0);
    this.alpha.fill(0);
  }
}
