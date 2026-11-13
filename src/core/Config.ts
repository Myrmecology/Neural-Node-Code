/**
 * Neural Node & Code - Game configuration
 *
 * All tuning values in one place: timing, scoring, lives, title screen
 * options, storage keys, and the per-level difficulty curve.
 * Speeds are in tiles per second.
 */
import { MonitorMode } from '../types';
import type { DifficultySettings, ModePhase } from '../types';
import { clamp } from '../utils/MathUtils';

export const GAME_TITLE = 'Neural Node & Code';

/** Number of handcrafted levels before the game loops at higher difficulty. */
export const LEVEL_COUNT = 8;

/** Cutscenes play after completing these levels (on every loop). */
export const CUTSCENE_AFTER_LEVELS: readonly number[] = [4, 8];

/** Timing values, in seconds. */
export const TIMING = {
  /** Fixed simulation step: game logic runs exactly 120 times per second. */
  fixedStep: 1 / 120,
  /** Longest frame the loop will simulate, so a stalled tab cannot explode. */
  maxFrameTime: 0.25,
  /** Maze assembly animation plus the "READY" message. */
  levelIntro: 3.2,
  /** The scientist's caught animation before respawning. */
  dying: 2.2,
  /** Pause after the last node is collected, while the maze flashes. */
  levelComplete: 2.0,
  /** Brief freeze when a monitor is caught, so the moment lands. */
  monitorCaughtFreeze: 0.5,
  /** How long a pressed direction is remembered while waiting for an opening. */
  inputBuffer: 0.35,
} as const;

export const SCORING = {
  node: 10,
  powerOrb: 50,
  /** Points for catching 1st, 2nd, 3rd, and 4th monitor in one power-up. */
  monitorChain: [200, 400, 800, 1600],
  extraLifeAt: 10_000,
  startingLives: 3,
  maxLives: 5,
  /** Lives added at the start of a game when the EXTRA LIVES option is on. */
  bonusLives: 20,
} as const;

/** Title screen options and the values they start with each time the game opens. */
export const DEFAULT_OPTIONS = {
  /** Start with SCORING.bonusLives additional lives. */
  extraLives: false,
  /** The scientist explodes when caught (otherwise he spins and collapses). */
  gore: true,
} as const;

/** Browser storage keys. Versioned so a future format change cannot misread old data. */
export const STORAGE_KEYS = {
  highScore: 'neural-node-and-code:high-score:v1',
  muted: 'neural-node-and-code:muted:v1',
} as const;

/** Size of one maze tile in world units. */
export const TILE_SIZE = 1;

// =============================================================================
//  Difficulty curve
// =============================================================================

/** 100% speed, in tiles per second. Every other speed is a fraction of this. */
const BASE_SPEED = 7.5;

/** Per-level values for levels 1 through 8. */
const SCIENTIST_SPEED = [0.8, 0.84, 0.87, 0.9, 0.92, 0.94, 0.97, 1.0];
const MONITOR_SPEED = [0.75, 0.79, 0.83, 0.86, 0.89, 0.91, 0.93, 0.95];
const FRIGHTENED_SECONDS = [6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5];

const SCATTER = MonitorMode.Scatter;
const CHASE = MonitorMode.Chase;

/** Scatter/chase rhythm. Later levels give fewer, shorter breathers. */
function modeScheduleFor(level: number): readonly ModePhase[] {
  if (level <= 2) {
    return [
      { mode: SCATTER, duration: 7 },
      { mode: CHASE, duration: 20 },
      { mode: SCATTER, duration: 7 },
      { mode: CHASE, duration: 20 },
      { mode: SCATTER, duration: 5 },
      { mode: CHASE, duration: 20 },
      { mode: SCATTER, duration: 5 },
      { mode: CHASE, duration: Infinity },
    ];
  }
  if (level <= 5) {
    return [
      { mode: SCATTER, duration: 6 },
      { mode: CHASE, duration: 22 },
      { mode: SCATTER, duration: 5 },
      { mode: CHASE, duration: 25 },
      { mode: SCATTER, duration: 4 },
      { mode: CHASE, duration: Infinity },
    ];
  }
  return [
    { mode: SCATTER, duration: 5 },
    { mode: CHASE, duration: 25 },
    { mode: SCATTER, duration: 3 },
    { mode: CHASE, duration: Infinity },
  ];
}

/** Seconds each monitor waits in the house, in release order. */
function releaseDelaysFor(level: number): readonly number[] {
  if (level <= 2) {
    return [0, 2, 6, 10];
  }
  if (level <= 5) {
    return [0, 1.5, 4.5, 8];
  }
  return [0, 1, 3, 5];
}

/**
 * Builds the difficulty for a level.
 * @param level 1-based level number within the current loop (1..LEVEL_COUNT)
 * @param loop  0 on the first playthrough, 1 after the first full loop, and so on
 */
export function getDifficulty(level: number, loop: number): DifficultySettings {
  const safeLevel = clamp(Math.floor(level), 1, LEVEL_COUNT);
  const safeLoop = clamp(Math.floor(loop), 0, 3);
  const index = safeLevel - 1;

  // Each completed loop adds 5% speed (up to 15%) and shortens invincibility.
  const loopBoost = 1 + safeLoop * 0.05;
  const scientist = (SCIENTIST_SPEED[index] ?? 1) * BASE_SPEED * loopBoost;
  const monitor = (MONITOR_SPEED[index] ?? 0.95) * BASE_SPEED * loopBoost;
  const frightened = Math.max(1.5, (FRIGHTENED_SECONDS[index] ?? 2.5) * (1 - safeLoop * 0.15));

  return {
    scientistSpeed: scientist,
    scientistPowerSpeed: scientist * 1.1,
    monitorSpeed: monitor,
    monitorTunnelSpeed: BASE_SPEED * 0.45,
    monitorFrightenedSpeed: BASE_SPEED * 0.55,
    monitorReturnSpeed: BASE_SPEED * 1.8,
    frightenedDuration: frightened,
    frightenedWarning: Math.min(2, frightened * 0.4),
    releaseDelays: releaseDelaysFor(safeLevel),
    modeSchedule: modeScheduleFor(safeLevel),
  };
}
