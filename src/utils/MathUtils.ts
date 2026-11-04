/**
 * Neural Node & Code - Math utilities
 *
 * Interpolation, smoothing, angles, easing curves, pulses, and a seeded
 * random number generator. All smoothing helpers take a time step (seconds)
 * so animations look the same at any frame rate.
 */

/** A full circle in radians. */
export const TAU = Math.PI * 2;

/** Restricts a value to the range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Restricts a value to the range [0, 1]. */
export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

/** Linear interpolation from a to b. t = 0 gives a, t = 1 gives b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** The inverse of lerp: where value sits between a and b, as 0..1. */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) {
    return 0;
  }
  return clamp01((value - a) / (b - a));
}

/** Smooth S-curve between edge0 and edge1. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = inverseLerp(edge0, edge1, value);
  return t * t * (3 - 2 * t);
}

/**
 * Frame-rate independent smoothing toward a target.
 * Higher `lambda` reaches the target faster. Use this instead of lerp with a
 * fixed factor, which behaves differently at 60 FPS versus 144 FPS.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Moves a value toward a target by at most `maxDelta`, without overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(current + maxDelta, target);
  }
  return Math.max(current - maxDelta, target);
}

/** Wraps an angle (radians) into the range [-PI, PI). */
export function wrapAngle(angle: number): number {
  let wrapped = (angle + Math.PI) % TAU;
  if (wrapped < 0) {
    wrapped += TAU;
  }
  return wrapped - Math.PI;
}

/** Interpolates between two angles along the shortest way around the circle. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapAngle(b - a) * t;
}

/** Frame-rate independent smoothing between angles, always turning the short way. */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return lerpAngle(current, target, 1 - Math.exp(-lambda * dt));
}

/**
 * A smooth 0..1 pulse that repeats every `period` seconds.
 * Used for the breathing glow of the nodes and power orbs.
 * `phase` (0..1) offsets the pulse so many objects do not pulse in unison.
 */
export function pulse(time: number, period: number, phase = 0): number {
  return 0.5 - 0.5 * Math.cos(TAU * (time / period + phase));
}

// ---------------------------------------------------------------------------
//  Easing curves (input and output are both 0..1)
// ---------------------------------------------------------------------------

/** Starts fast, ends gently. */
export function easeOutCubic(t: number): number {
  const inv = 1 - clamp01(t);
  return 1 - inv * inv * inv;
}

/** Starts gently, ends fast. */
export function easeInCubic(t: number): number {
  const c = clamp01(t);
  return c * c * c;
}

/** Gentle at both ends. */
export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * clamp01(t)) - 1) / 2;
}

/** Overshoots slightly past 1, then settles. Used for "pop" animations. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = clamp01(t) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

// ---------------------------------------------------------------------------
//  Seeded random numbers
// ---------------------------------------------------------------------------

/**
 * A small, fast, repeatable random number generator (Mulberry32).
 * The same seed always produces the same sequence, which keeps visual
 * effects consistent and makes bugs reproducible.
 * Not for security purposes.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A number in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A number in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** A whole number in [min, max], inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** A random item from a non-empty list. */
  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) {
      throw new RangeError('SeededRandom.pick() requires a non-empty list.');
    }
    return item;
  }
}
