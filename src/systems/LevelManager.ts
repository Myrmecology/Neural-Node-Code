/**
 * Neural Node & Code - Level progression
 *
 * Tracks the current level (1..LEVEL_COUNT) and loop count, builds a fresh
 * Maze and DifficultySettings for each level, and reports which cutscene (if
 * any) follows a cleared level. After the last level, play loops back to
 * level 1 at a higher difficulty.
 *
 * In development builds every maze is also validated as it loads.
 */
import { CUTSCENE_AFTER_LEVELS, LEVEL_COUNT, getDifficulty } from '../core/Config';
import { Maze } from '../maze/Maze';
import { assertValidMaze } from '../maze/MazeValidator';
import { getLevel } from '../maze/levels';
import type { DifficultySettings, LevelDefinition } from '../types';

export type CutsceneId = 'chase' | 'reversal';

/** Cutscenes in the order they play within each loop. */
const CUTSCENE_ORDER: readonly CutsceneId[] = ['chase', 'reversal'];

export interface LevelInfo {
  /** Level within the current loop (1..LEVEL_COUNT). */
  readonly level: number;
  /** 0 on the first playthrough, then 1, 2, ... */
  readonly loop: number;
  /** Level number shown to the player, counting across loops (1, 2, ... 9, 10, ...). */
  readonly displayNumber: number;
  readonly definition: LevelDefinition;
  readonly maze: Maze;
  readonly difficulty: DifficultySettings;
}

export interface LevelAdvance {
  readonly next: LevelInfo;
  /** The cutscene to play before the next level, or null for none. */
  readonly cutscene: CutsceneId | null;
}

export class LevelManager {
  private level = 1;
  private loop = 0;
  private info: LevelInfo;

  constructor() {
    this.info = this.load();
  }

  /** The level currently being played. */
  get current(): LevelInfo {
    return this.info;
  }

  /** Starts a new game at level 1 of the first loop. */
  start(): LevelInfo {
    this.level = 1;
    this.loop = 0;
    this.info = this.load();
    return this.info;
  }

  /** Moves to the next level after the current one is cleared. */
  advance(): LevelAdvance {
    const cleared = this.level;
    const cutsceneIndex = CUTSCENE_AFTER_LEVELS.indexOf(cleared);
    const cutscene = cutsceneIndex === -1 ? null : (CUTSCENE_ORDER[cutsceneIndex] ?? null);

    if (this.level >= LEVEL_COUNT) {
      this.level = 1;
      this.loop += 1;
    } else {
      this.level += 1;
    }

    this.info = this.load();
    return { next: this.info, cutscene };
  }

  /** Builds the maze and difficulty for the current level and loop. */
  private load(): LevelInfo {
    const definition = getLevel(this.level);
    const maze = new Maze(definition);
    if (import.meta.env.DEV) {
      assertValidMaze(maze);
    }
    return {
      level: this.level,
      loop: this.loop,
      displayNumber: this.loop * LEVEL_COUNT + this.level,
      definition,
      maze,
      difficulty: getDifficulty(this.level, this.loop),
    };
  }
}
