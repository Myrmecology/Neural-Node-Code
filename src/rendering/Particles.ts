/**
 * Neural Node & Code - Particle bursts
 *
 * Glowing pixel cubes that burst outward, fall, bounce, and shrink away.
 * Used when a monitor is caught (it shatters into pixels), when the scientist
 * is caught (a white burst, or a cartoon blood explosion with GORE on), and
 * for power orb pickups. Also owns the floor splat left by the explosion.
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
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { GlowLayer, Mesh, Scene } from '@babylonjs/core';
import { SeededRandom, clamp01, easeInCubic, easeOutCubic } from '../utils/MathUtils';
import { color3 } from './SceneSetup';
import type { HexColor } from './Themes';

const MAX_PARTICLES = 800;
const GRAVITY = 22;
const FLOOR_Y = 0;
const BOUNCE = 0.35;
const FRICTION = 0.7;

/** Number of overlapping blobs that make up one floor splat. */
const SPLAT_BLOBS = 9;
/** Seconds for a splat to spread to full size. */
const SPLAT_GROW_TIME = 0.3;
const SPLAT_COLOR: HexColor = '#7a0008';

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

interface SplatBlob {
  readonly mesh: Mesh;
  radius: number;
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

  private readonly splatRoot: TransformNode;
  private readonly splatMaterial: StandardMaterial;
  private readonly splatBlobs: SplatBlob[] = [];
  private splatAge = 0;
  private splatVisible = false;

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

    // ---- Floor splat (hidden until the scientist explodes) -------------------
    this.splatMaterial = new StandardMaterial('splat-material', scene);
    this.splatMaterial.disableLighting = true;
    this.splatMaterial.diffuseColor = Color3.Black();
    this.splatMaterial.specularColor = Color3.Black();
    this.splatMaterial.emissiveColor = color3(SPLAT_COLOR);
    this.splatMaterial.alpha = 0.92;

    this.splatRoot = new TransformNode('splat', scene);
    for (let index = 0; index < SPLAT_BLOBS; index += 1) {
      const blob = MeshBuilder.CreateDisc(
        `splat-blob-${index}`,
        { radius: 1, tessellation: 20 },
        scene,
      );
      blob.material = this.splatMaterial;
      blob.parent = this.splatRoot;
      blob.rotation.x = Math.PI / 2;
      // Stack each blob a hair higher than the last to avoid flickering overlaps.
      blob.position.y = 0.006 + index * 0.0004;
      blob.isPickable = false;
      // The splat is dark and matte: keep it out of the glow.
      glow.addExcludedMesh(blob);
      this.splatBlobs.push({ mesh: blob, radius: 0 });
    }
    this.splatRoot.setEnabled(false);
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

  /** GORE on: the scientist bursts into a big cartoon shower of red chunks and lab coat scraps. */
  bloodExplosion(x: number, z: number): void {
    // Large red chunks.
    this.burst({
      x,
      y: 0.45,
      z,
      color: '#c4000c',
      count: 110,
      speed: 7,
      lift: 9,
      life: 1.9,
      size: 0.13,
    });
    // Darker gibs.
    this.burst({
      x,
      y: 0.4,
      z,
      color: '#6e0008',
      count: 60,
      speed: 5.5,
      lift: 7,
      life: 2.0,
      size: 0.1,
    });
    // Fine bright spray.
    this.burst({
      x,
      y: 0.5,
      z,
      color: '#ff2a2a',
      count: 55,
      speed: 9,
      lift: 6,
      life: 1.2,
      size: 0.05,
    });
    // Scraps of white lab coat.
    this.burst({
      x,
      y: 0.55,
      z,
      color: '#f4f6f8',
      count: 18,
      speed: 6,
      lift: 10,
      life: 2.0,
      size: 0.11,
    });
    // The two glowing goggle lenses.
    this.burst({
      x,
      y: 0.75,
      z,
      color: '#7df9ff',
      count: 2,
      speed: 4,
      lift: 12,
      life: 2.1,
      size: 0.09,
    });
  }

  /** Spreads a red splat on the floor at a world position. */
  showSplat(x: number, z: number): void {
    this.splatRoot.position.set(x, 0, z);
    this.splatBlobs.forEach((blob, index) => {
      // The first blob is the large center; the rest scatter around it.
      if (index === 0) {
        blob.radius = this.random.range(0.32, 0.4);
        blob.mesh.position.x = 0;
        blob.mesh.position.z = 0;
      } else {
        const angle = this.random.range(0, Math.PI * 2);
        const distance = this.random.range(0.2, 0.6);
        blob.radius = this.random.range(0.06, 0.2);
        blob.mesh.position.x = Math.cos(angle) * distance;
        blob.mesh.position.z = Math.sin(angle) * distance;
      }
      blob.mesh.scaling.set(0.001, 0.001, 1);
    });
    this.splatAge = 0;
    this.splatVisible = true;
    this.splatRoot.setEnabled(true);
  }

  /** Removes the floor splat. */
  clearSplat(): void {
    this.splatVisible = false;
    this.splatRoot.setEnabled(false);
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

    this.updateSplat(dt);
  }

  /** Removes every particle and the floor splat immediately. */
  clear(): void {
    this.alive = 0;
    this.mesh.thinInstanceCount = 0;
    this.clearSplat();
  }

  dispose(): void {
    this.mesh.dispose();
    this.material.dispose();
    this.splatRoot.dispose(false, false);
    this.splatMaterial.dispose();
  }

  /** Grows the splat outward quickly after it appears. */
  private updateSplat(dt: number): void {
    if (!this.splatVisible || this.splatAge >= SPLAT_GROW_TIME) {
      return;
    }
    this.splatAge = Math.min(this.splatAge + dt, SPLAT_GROW_TIME);
    const grow = easeOutCubic(clamp01(this.splatAge / SPLAT_GROW_TIME));
    for (const blob of this.splatBlobs) {
      const size = Math.max(blob.radius * grow, 0.001);
      blob.mesh.scaling.set(size, size, 1);
    }
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
