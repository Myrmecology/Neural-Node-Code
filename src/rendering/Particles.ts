/**
 * Neural Node & Code - Particle bursts
 *
 * Glowing pixel cubes that burst outward, fall, bounce, and shrink away.
 * Used when a monitor is caught (it shatters into pixels), when the scientist
 * is caught, and for power orb pickups.
 *
 * Performance: every particle is a thin instance of ONE cube mesh, so the
 * whole system is a single draw call. Particles live in a fixed-size pool and
 * alive particles are kept packed at the front, so nothing is allocated
 * during play.
 */
import {
  Color3,
  Matrix,
  MeshBuilder,
  Quaternion,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { GlowLayer, Mesh, Scene } from '@babylonjs/core';
import { SeededRandom, easeInCubic } from '../utils/MathUtils';
import { color3 } from './SceneSetup';
import type { HexColor } from './Themes';

const MAX_PARTICLES = 600;
const GRAVITY = 22;
const FLOOR_Y = 0;
const BOUNCE = 0.35;
const FRICTION = 0.7;

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  spin: number;
  r: number;
  g: number;
  b: number;
}

export interface BurstOptions {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: HexColor;
  /** Number of pixels. */
  readonly count: number;
  /** Outward speed, in world units per second. */
  readonly speed: number;
  /** Extra upward speed added to every pixel. */
  readonly lift: number;
  /** Seconds each pixel lives (randomized slightly). */
  readonly life: number;
  /** Edge length of each pixel cube. */
  readonly size: number;
}

export class ParticleSystem {
  private readonly mesh: Mesh;
  private readonly material: StandardMaterial;
  private readonly particles: Particle[];
  private readonly matrixBuffer = new Float32Array(MAX_PARTICLES * 16);
  private readonly colorBuffer = new Float32Array(MAX_PARTICLES * 4);
  private readonly random = new SeededRandom(0x4e4e43);
  private alive = 0;

  // Reused math objects, so updates allocate nothing.
  private readonly tempMatrix = new Matrix();
  private readonly tempScale = new Vector3();
  private readonly tempPosition = new Vector3();
  private readonly tempRotation = new Quaternion();

  constructor(scene: Scene, glow: GlowLayer) {
    this.material = new StandardMaterial('particle-material', scene);
    this.material.disableLighting = true;
    this.material.diffuseColor = Color3.White();
    this.material.emissiveColor = Color3.Black();

    this.mesh = MeshBuilder.CreateBox('particles', { size: 1 }, scene);
    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    // Thin instances spread across the maze, so never cull by the base cube's bounds.
    this.mesh.alwaysSelectAsActiveMesh = true;
    this.mesh.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
    this.mesh.thinInstanceSetBuffer('color', this.colorBuffer, 4, false);
    this.mesh.thinInstanceCount = 0;

    // Particles glow in their own instance colors.
    glow.referenceMeshToUseItsOwnMaterial(this.mesh);

    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 1,
      size: 0,
      spin: 0,
      r: 1,
      g: 1,
      b: 1,
    }));
  }

  /** Number of particles currently on screen. */
  get count(): number {
    return this.alive;
  }

  /** Launches a burst of pixels. Extra pixels beyond the pool size are skipped. */
  burst(options: BurstOptions): void {
    const color = color3(options.color);
    for (let index = 0; index < options.count && this.alive < MAX_PARTICLES; index += 1) {
      const particle = this.particles[this.alive];
      if (particle === undefined) {
        break;
      }
      const angle = this.random.range(0, Math.PI * 2);
      const speed = options.speed * this.random.range(0.35, 1);
      // Slight color variation makes the burst shimmer.
      const tint = this.random.range(0.75, 1.15);

      particle.x = options.x;
      particle.y = options.y;
      particle.z = options.z;
      particle.vx = Math.cos(angle) * speed;
      particle.vz = Math.sin(angle) * speed;
      particle.vy = options.lift * this.random.range(0.5, 1.2);
      particle.maxLife = options.life * this.random.range(0.7, 1.15);
      particle.life = particle.maxLife;
      particle.size = options.size * this.random.range(0.6, 1.2);
      particle.spin = this.random.range(-8, 8);
      particle.r = Math.min(color.r * tint, 1);
      particle.g = Math.min(color.g * tint, 1);
      particle.b = Math.min(color.b * tint, 1);
      this.alive += 1;
    }
  }

  /** A caught monitor shattering into its screen color. */
  monitorShatter(x: number, z: number, color: HexColor): void {
    this.burst({ x, y: 0.55, z, color, count: 70, speed: 6, lift: 7, life: 1.1, size: 0.11 });
  }

  /** The scientist being caught: a wide, slow white burst. */
  scientistCaught(x: number, z: number): void {
    this.burst({
      x,
      y: 0.5,
      z,
      color: '#ffffff',
      count: 90,
      speed: 4,
      lift: 5,
      life: 1.6,
      size: 0.08,
    });
  }

  /** A quick sparkle when a power orb is collected. */
  powerSparkle(x: number, z: number, color: HexColor): void {
    this.burst({ x, y: 0.4, z, color, count: 28, speed: 3.5, lift: 6, life: 0.7, size: 0.07 });
  }

  /** Moves, bounces, and fades every particle, then uploads them to the GPU. */
  update(dt: number): void {
    let index = 0;
    while (index < this.alive) {
      const particle = this.particles[index];
      if (particle === undefined) {
        break;
      }

      particle.life -= dt;
      if (particle.life <= 0) {
        this.removeAt(index);
        continue;
      }

      particle.vy -= GRAVITY * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;

      const halfSize = particle.size / 2;
      if (particle.y < FLOOR_Y + halfSize) {
        particle.y = FLOOR_Y + halfSize;
        particle.vy = -particle.vy * BOUNCE;
        particle.vx *= FRICTION;
        particle.vz *= FRICTION;
      }

      this.writeInstance(index, particle);
      index += 1;
    }

    this.mesh.thinInstanceCount = this.alive;
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.thinInstanceBufferUpdated('color');
  }

  /** Removes every particle immediately. */
  clear(): void {
    this.alive = 0;
    this.mesh.thinInstanceCount = 0;
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
  }

  /** Writes one particle's transform and color into the GPU buffers. */
  private writeInstance(index: number, particle: Particle): void {
    const remaining = particle.life / particle.maxLife;
    // Shrink away during the final part of the particle's life.
    const scale = particle.size * (1 - easeInCubic(1 - remaining));
    const age = particle.maxLife - particle.life;

    this.tempScale.set(scale, scale, scale);
    this.tempPosition.set(particle.x, particle.y, particle.z);
    Quaternion.RotationYawPitchRollToRef(
      age * particle.spin,
      age * particle.spin * 0.6,
      0,
      this.tempRotation,
    );
    Matrix.ComposeToRef(this.tempScale, this.tempRotation, this.tempPosition, this.tempMatrix);
    this.tempMatrix.copyToArray(this.matrixBuffer, index * 16);

    const offset = index * 4;
    this.colorBuffer[offset] = particle.r;
    this.colorBuffer[offset + 1] = particle.g;
    this.colorBuffer[offset + 2] = particle.b;
    this.colorBuffer[offset + 3] = 1;
  }

  /** Swaps the last alive particle into this slot, keeping alive particles packed. */
  private removeAt(index: number): void {
    const last = this.alive - 1;
    const current = this.particles[index];
    const lastParticle = this.particles[last];
    if (current !== undefined && lastParticle !== undefined && index !== last) {
      this.particles[index] = lastParticle;
      this.particles[last] = current;
    }
    this.alive = last;
  }
}
