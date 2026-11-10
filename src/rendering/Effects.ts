/**
 * Neural Node & Code - Visual effects
 *
 * Pure-math effect controllers, sampled by the renderers every frame:
 * - PulseField:  expanding rings of light that ripple across the maze walls
 *                when nodes are collected (the "neural pulse").
 * - CameraShake: trauma-based shake that eases out smoothly.
 * - isBlinkOn:   steady on/off blinking for flashing effects.
 *
 * No Babylon.js code lives here, so effects are cheap and easy to tune.
 */
import { clamp } from '../utils/MathUtils';

interface Ripple {
  readonly x: number;
  readonly z: number;
  readonly strength: number;
  age: number;
}

export interface PulseFieldOptions {
  /** How fast the ring expands, in world units per second. */
  readonly speed: number;
  /** Thickness of the glowing ring, in world units. */
  readonly width: number;
  /** Seconds before a ripple fully fades. */
  readonly lifetime: number;
  /** Most ripples alive at once; the oldest is dropped beyond this. */
  readonly maxRipples: number;
}

const DEFAULT_PULSE: PulseFieldOptions = {
  speed: 14,
  width: 1.4,
  lifetime: 1.4,
  maxRipples: 10,
};

/**
 * Expanding rings of light. Each collected node emits a ripple; any point in
 * the maze can be sampled for its current brightness.
 */
export class PulseField {
  private readonly ripples: Ripple[] = [];
  private readonly options: PulseFieldOptions;

  constructor(options: Partial<PulseFieldOptions> = {}) {
    this.options = { ...DEFAULT_PULSE, ...options };
  }

  /** True while at least one ripple is still visible. */
  get active(): boolean {
    return this.ripples.length > 0;
  }

  /** Starts a new ripple at a world position. */
  emit(x: number, z: number, strength = 1): void {
    if (this.ripples.length >= this.options.maxRipples) {
      this.ripples.shift();
    }
    this.ripples.push({ x, z, strength, age: 0 });
  }

  /** Ages every ripple and removes faded ones. */
  update(dt: number): void {
    for (let index = this.ripples.length - 1; index >= 0; index -= 1) {
      const ripple = this.ripples[index];
      if (ripple === undefined) {
        continue;
      }
      ripple.age += dt;
      if (ripple.age >= this.options.lifetime) {
        this.ripples.splice(index, 1);
      }
    }
  }

  /** Brightness (0 = none, up to about 1.5) at a world position right now. */
  sample(x: number, z: number): number {
    const { speed, width, lifetime } = this.options;
    let total = 0;
    for (const ripple of this.ripples) {
      const distance = Math.hypot(x - ripple.x, z - ripple.z);
      const front = ripple.age * speed;
      const offset = (distance - front) / width;
      const fade = 1 - ripple.age / lifetime;
      total += Math.exp(-offset * offset) * ripple.strength * fade;
    }
    return clamp(total, 0, 1.5);
  }

  /** Removes every ripple, for example when a level ends. */
  clear(): void {
    this.ripples.length = 0;
  }
}

/**
 * Smooth camera shake. Add "trauma" (0..1) for an impact; the shake is
 * strongest right away and eases out as trauma decays.
 */
export class CameraShake {
  private trauma = 0;
  private time = 0;
  private readonly maxOffset: number;
  private readonly decayPerSecond: number;

  constructor(maxOffset = 0.35, decayPerSecond = 1.6) {
    this.maxOffset = maxOffset;
    this.decayPerSecond = decayPerSecond;
  }

  /** Adds shake. 0.3 is a bump, 1.0 is a heavy hit. */
  add(amount: number): void {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - this.decayPerSecond * dt);
  }

  /** Current horizontal camera offset, in world units. */
  get offsetX(): number {
    return this.magnitude() * Math.sin(this.time * 47.3) * Math.cos(this.time * 13.1);
  }

  /** Current vertical camera offset, in world units. */
  get offsetY(): number {
    return this.magnitude() * Math.sin(this.time * 39.7 + 1.7) * Math.cos(this.time * 17.9);
  }

  reset(): void {
    this.trauma = 0;
  }

  /** Squaring trauma keeps small hits subtle and big hits dramatic. */
  private magnitude(): number {
    return this.trauma * this.trauma * this.maxOffset;
  }
}

/** True during the "on" half of a steady blink. */
export function isBlinkOn(time: number, blinksPerSecond: number): boolean {
  return Math.floor(time * blinksPerSecond * 2) % 2 === 0;
}
