/**
 * Neural Node & Code - Shared types
 *
 * The common vocabulary used across the game: tiles, pickups, monitors,
 * game states, level definitions, difficulty settings, and game events.
 *
 * Constant objects (instead of TypeScript enums) are used for any value that
 * exists at runtime, as required by the project's strict compiler settings.
 */
import type { MoveDirection } from '../utils/Direction';
import type { GridPoint } from '../utils/Grid';

// =============================================================================
//  Maze tiles and pickups
// =============================================================================

/** What a maze tile is made of. */
export const Tile = {
  /** Solid wall. Nothing can enter. */
  Wall: 'wall',
  /** Open corridor. Everyone can walk here. */
  Path: 'path',
  /** Monitor house door. Only monitors leaving or returning may pass. */
  Door: 'door',
  /** Inside the monitor house. Only monitors may be here. */
  House: 'house',
} as const;

export type Tile = (typeof Tile)[keyof typeof Tile];

/** What sits on a path tile for the scientist to collect. */
export const Pickup = {
  None: 'none',
  /** A small breathing wireframe node. */
  Node: 'node',
  /** A large wireframe orb that grants temporary invincibility. */
  PowerOrb: 'powerOrb',
} as const;

export type Pickup = (typeof Pickup)[keyof typeof Pickup];

// =============================================================================
//  Monitors
// =============================================================================

/**
 * The four rogue monitors. Each has its own targeting personality:
 * - virus:  chases the scientist directly
 * - worm:   aims ahead of the scientist to cut him off
 * - glitch: flanks, using both the scientist's and the virus's positions
 * - trojan: chases from afar, but retreats to its corner when close
 */
export const MonitorId = {
  Virus: 'virus',
  Worm: 'worm',
  Glitch: 'glitch',
  Trojan: 'trojan',
} as const;

export type MonitorId = (typeof MonitorId)[keyof typeof MonitorId];

/** All monitors, in the order they leave the monitor house. */
export const MONITOR_IDS: readonly MonitorId[] = [
  MonitorId.Virus,
  MonitorId.Worm,
  MonitorId.Glitch,
  MonitorId.Trojan,
];

/** What a monitor is currently doing. Each monitor tracks its own mode. */
export const MonitorMode = {
  /** Waiting inside the monitor house. */
  House: 'house',
  /** Moving out through the door into the maze. */
  Leaving: 'leaving',
  /** Heading to its own home corner. */
  Scatter: 'scatter',
  /** Hunting the scientist using its personality. */
  Chase: 'chase',
  /** Blue-screened and fleeing during the scientist's invincibility. */
  Frightened: 'frightened',
  /** Caught; racing back to the house to reboot. */
  Returning: 'returning',
  /** Passing back through the door into the house. */
  Entering: 'entering',
} as const;

export type MonitorMode = (typeof MonitorMode)[keyof typeof MonitorMode];

// =============================================================================
//  Game states
// =============================================================================

export const GameState = {
  Title: 'title',
  LevelIntro: 'levelIntro',
  Playing: 'playing',
  Paused: 'paused',
  Dying: 'dying',
  LevelComplete: 'levelComplete',
  Cutscene: 'cutscene',
  GameOver: 'gameOver',
} as const;

export type GameState = (typeof GameState)[keyof typeof GameState];

// =============================================================================
//  Levels and themes
// =============================================================================

/** One color theme per level. Palettes are defined in rendering/Themes.ts. */
export type ThemeId =
  'synapse' | 'cortex' | 'axon' | 'dendrite' | 'myelin' | 'plasma' | 'quantum' | 'singularity';

/** A handcrafted level: its name, color theme, and text-drawn layout. */
export interface LevelDefinition {
  /** Level number, starting at 1. */
  readonly id: number;
  /** Display name shown in the level intro. */
  readonly name: string;
  readonly theme: ThemeId;
  /** The maze drawn as rows of characters. The legend lives in maze/Maze.ts. */
  readonly layout: readonly string[];
}

// =============================================================================
//  Difficulty
// =============================================================================

/** One phase of the scatter/chase rhythm. */
export interface ModePhase {
  readonly mode: typeof MonitorMode.Scatter | typeof MonitorMode.Chase;
  /** Length in seconds. Use Infinity for "until the level ends". */
  readonly duration: number;
}

/** Tuning values for a level. Speeds are in tiles per second. */
export interface DifficultySettings {
  readonly scientistSpeed: number;
  readonly scientistPowerSpeed: number;
  readonly monitorSpeed: number;
  readonly monitorTunnelSpeed: number;
  readonly monitorFrightenedSpeed: number;
  readonly monitorReturnSpeed: number;
  /** How long invincibility lasts, in seconds. 0 disables frightening. */
  readonly frightenedDuration: number;
  /** Seconds before invincibility ends that frightened monitors start flashing. */
  readonly frightenedWarning: number;
  /** Seconds each monitor waits in the house, in MONITOR_IDS order. */
  readonly releaseDelays: readonly number[];
  readonly modeSchedule: readonly ModePhase[];
}

// =============================================================================
//  Events (sent through core/EventBus.ts)
// =============================================================================

/** Every game event and the data it carries. */
export interface GameEvents {
  stateChanged: { readonly from: GameState; readonly to: GameState };
  levelStarted: { readonly level: number; readonly loop: number; readonly name: string };
  levelCompleted: { readonly level: number };
  nodeCollected: { readonly point: GridPoint; readonly remaining: number; readonly chain: number };
  powerOrbCollected: { readonly point: GridPoint; readonly duration: number };
  powerModeEnded: { readonly monitorsCaught: number };
  monitorCaught: { readonly id: MonitorId; readonly point: GridPoint; readonly points: number };
  scientistCaught: { readonly by: MonitorId };
  scientistTurned: { readonly direction: MoveDirection };
  scoreChanged: { readonly score: number; readonly highScore: number };
  livesChanged: { readonly lives: number };
  extraLife: { readonly lives: number };
  gameOver: { readonly score: number; readonly isHighScore: boolean };
}

export type GameEventName = keyof GameEvents;

// =============================================================================
//  HUD
// =============================================================================

/** Everything the HUD displays. */
export interface HudSnapshot {
  readonly score: number;
  readonly highScore: number;
  readonly lives: number;
  readonly level: number;
  readonly levelName: string;
}
