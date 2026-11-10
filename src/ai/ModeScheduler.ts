/**
 * Neural Node & Code - Scatter/chase scheduler
 *
 * Tracks the level's scatter/chase rhythm (from Config.ts) and tells each
 * monitor which of the two modes it should currently be in.
 *
 * - The clock pauses while the scientist is invincible.
 * - Each monitor slot switches modes slightly later than the previous one,
 *   so phase changes (and the reversals they cause) ripple through the pack
 *   instead of happening in perfect unison.
 *
 * This only decides scatter versus chase. Each monitor still tracks its own
 * full mode (house, leaving, frightened, returning) independently.
 */
import { MonitorMode } from '../types';
import type { ModePhase } from '../types';

export type BaseMode = typeof MonitorMode.Scatter | typeof MonitorMode.Chase;

/** Default delay between consecutive monitors switching modes, in seconds. */
const DEFAULT_STAGGER = 0.35;

export class ModeScheduler {
  private schedule: readonly ModePhase[];
  private readonly stagger: number;
  private time = 0;

  constructor(schedule: readonly ModePhase[], stagger: number = DEFAULT_STAGGER) {
    if (schedule.length === 0) {
      throw new Error('ModeScheduler: the schedule must contain at least one phase.');
    }
    this.schedule = schedule;
    this.stagger = stagger;
  }

  /** Seconds of scatter/chase time elapsed (excluding paused time). */
  get elapsed(): number {
    return this.time;
  }

  /** Restarts the rhythm, optionally with a new schedule (for a new level). */
  reset(schedule?: readonly ModePhase[]): void {
    if (schedule !== undefined) {
      if (schedule.length === 0) {
        throw new Error('ModeScheduler: the schedule must contain at least one phase.');
      }
      this.schedule = schedule;
    }
    this.time = 0;
  }

  /**
   * Advances the clock.
   * @param paused true while the scientist is invincible
   */
  update(dt: number, paused: boolean): void {
    if (!paused) {
      this.time += dt;
    }
  }

  /**
   * The mode a monitor should be in right now.
   * @param slot the monitor's position in release order (0..3)
   */
  modeFor(slot: number): BaseMode {
    return this.modeAt(this.time - Math.max(slot, 0) * this.stagger);
  }

  /** The scheduled mode at a given time on the clock. */
  private modeAt(time: number): BaseMode {
    let phaseEnd = 0;
    let mode: BaseMode = MonitorMode.Scatter;
    for (const phase of this.schedule) {
      mode = phase.mode;
      phaseEnd += phase.duration;
      if (time < phaseEnd) {
        return mode;
      }
    }
    // Past the end of the schedule: stay in the final phase's mode.
    return mode;
  }
}
