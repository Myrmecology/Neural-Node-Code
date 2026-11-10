/**
 * Neural Node & Code - Level registry
 *
 * All handcrafted levels in play order, plus a safe lookup by level number.
 */
import { LEVEL_COUNT } from '../../core/Config';
import type { LevelDefinition } from '../../types';
import { level01 } from './level01';
import { level02 } from './level02';
import { level03 } from './level03';
import { level04 } from './level04';
import { level05 } from './level05';
import { level06 } from './level06';
import { level07 } from './level07';
import { level08 } from './level08';

/** Every level, in play order. */
export const LEVELS: readonly LevelDefinition[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
];

if (LEVELS.length !== LEVEL_COUNT) {
  throw new Error(
    `Level registry has ${LEVELS.length} levels, but LEVEL_COUNT in Config.ts is ${LEVEL_COUNT}.`,
  );
}

LEVELS.forEach((level, index) => {
  if (level.id !== index + 1) {
    throw new Error(
      `Level at position ${index + 1} has id ${level.id}; ids must match play order.`,
    );
  }
});

/**
 * Looks up a level by its 1-based number.
 * Throws for a number outside 1..LEVEL_COUNT, so a bad level number can never
 * load an undefined maze.
 */
export function getLevel(levelNumber: number): LevelDefinition {
  const level = LEVELS[levelNumber - 1];
  if (level === undefined) {
    throw new RangeError(`Level ${levelNumber} does not exist (valid: 1 to ${LEVELS.length}).`);
  }
  return level;
}
