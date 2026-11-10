/**
 * Neural Node & Code - Power (invincibility) system
 *
 * Runs the invincibility timer started by a power orb and the catch chain:
 * each monitor caught during one power-up is worth more than the last
 * (SCORING.monitorChain). Another orb restarts both the timer and the chain.
 */
import { SCORING } from '../core/Config';
import type { EventBus } from '../core/EventBus';

export class PowerSystem {
  private readonly events: EventBus;
  private remainingTime = 0;
  private duration = 0;
  private chain = 0;

  constructor(events: EventBus) {
    this.events = events;
  }

  /** True while the scientist is invincible. */
  get active(): boolean {
    return this.remainingTime > 0;
  }

  /** Seconds of invincibility left (0 when inactive). */
  get remaining(): number {
    return this.remainingTime;
  }

  /** 0..1: how much of the current power-up is left. */
  get fraction(): number {
    return this.duration > 0 ? this.remainingTime / this.duration : 0;
  }

  /** Monitors caught during the current power-up. */
  get monitorsCaught(): number {
    return this.chain;
  }

  /**
   * Starts (or restarts) invincibility.
   * @param duration seconds; 0 means this level grants no invincibility
   */
  start(duration: number): void {
    this.duration = Math.max(0, duration);
    this.remainingTime = this.duration;
    this.chain = 0;
  }

  /**
   * Counts down. Announces `powerModeEnded` when time runs out.
   * @returns true on the step invincibility ends
   */
  update(dt: number): boolean {
    if (this.remainingTime <= 0) {
      return false;
    }
    this.remainingTime -= dt;
    if (this.remainingTime > 0) {
      return false;
    }
    this.remainingTime = 0;
    this.events.emit('powerModeEnded', { monitorsCaught: this.chain });
    return true;
  }

  /**
   * Records a caught monitor.
   * @returns points earned for this catch (200, 400, 800, 1600)
   */
  registerCatch(): number {
    const table = SCORING.monitorChain;
    const points = table[Math.min(this.chain, table.length - 1)] ?? 0;
    this.chain += 1;
    return points;
  }

  /** Cancels invincibility silently, for a new life or level. */
  reset(): void {
    this.remainingTime = 0;
    this.duration = 0;
    this.chain = 0;
  }
}
