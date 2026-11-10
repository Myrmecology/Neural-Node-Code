/**
 * Neural Node & Code - Maze validator
 *
 * Proves a maze is sealed, fully reachable, free of dead ends, and playable.
 * validateMaze() collects every problem it finds; assertValidMaze() throws
 * one error listing all of them. Used by the automated tests and at runtime
 * when a level loads during development.
 */
import { MONITOR_IDS, Pickup, Tile } from '../types';
import { MOVE_DIRECTIONS } from '../utils/Direction';
import { pointKey, samePoint, stepPoint } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';
import { Passage } from './Maze';
import type { Maze } from './Maze';

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/** The tiles a character can step to from `point`, including tunnel wraps. */
function neighbors(maze: Maze, point: GridPoint, passage: Passage): GridPoint[] {
  const result: GridPoint[] = [];
  for (const direction of MOVE_DIRECTIONS) {
    const next = maze.normalize(stepPoint(point, direction));
    if (maze.canEnter(next, passage)) {
      result.push(next);
    }
  }
  return result;
}

/** Every tile reachable from `start` using the given passage rules (breadth-first search). */
function reachableFrom(maze: Maze, start: GridPoint, passage: Passage): Set<string> {
  const visited = new Set<string>([pointKey(start)]);
  const queue: GridPoint[] = [start];
  // for...of keeps iterating as tiles are appended, visiting each one in order.
  for (const current of queue) {
    for (const next of neighbors(maze, current, passage)) {
      const key = pointKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return visited;
}

/** Checks a maze and returns every problem found. */
export function validateMaze(maze: Maze): ValidationResult {
  const issues: string[] = [];
  const at = (col: number, row: number): string => `(column ${col}, row ${row})`;

  // ---- 1. Sealed borders ------------------------------------------------------
  maze.forEachTile((tile, col, row) => {
    if (tile === Tile.Wall) {
      return;
    }
    const onTopOrBottom = row === 0 || row === maze.height - 1;
    const onLeftOrRight = col === 0 || col === maze.width - 1;
    if (onTopOrBottom) {
      issues.push(`Border gap on the top or bottom edge at ${at(col, row)}.`);
    } else if (onLeftOrRight && !maze.wrapRows.has(row)) {
      issues.push(`Border gap at ${at(col, row)} without a matching tunnel on the other side.`);
    }
    if (onLeftOrRight && tile !== Tile.Path) {
      issues.push(`Only path tiles may touch the side edge, found "${tile}" at ${at(col, row)}.`);
    }
  });

  // ---- 2. Everything reachable from the scientist's start ---------------------
  if (!maze.canEnter(maze.scientistStart, Passage.Scientist)) {
    issues.push('The scientist start is not on a path tile.');
  }
  const reachable = reachableFrom(maze, maze.scientistStart, Passage.Scientist);

  maze.forEachTile((tile, col, row) => {
    if (tile === Tile.Path && !reachable.has(pointKey({ col, row }))) {
      issues.push(`Path tile at ${at(col, row)} cannot be reached from the scientist start.`);
    }
  });

  // ---- 3. No dead ends -------------------------------------------------------
  maze.forEachTile((tile, col, row) => {
    if (tile !== Tile.Path) {
      return;
    }
    const exits = neighbors(maze, { col, row }, Passage.Scientist).length;
    if (exits < 2) {
      issues.push(`Dead end at ${at(col, row)}: only ${exits} exit(s).`);
    }
  });

  // ---- 4. A working monitor house --------------------------------------------
  if (!maze.canEnter(maze.houseExit, Passage.Scientist)) {
    issues.push('The house exit (E) is not on a path tile.');
  }
  const exitTouchesDoor = maze.doors.some((door) =>
    MOVE_DIRECTIONS.some((direction) => samePoint(stepPoint(door, direction), maze.houseExit)),
  );
  if (!exitTouchesDoor) {
    issues.push('The house exit (E) must be directly next to a door tile (-).');
  }
  for (const id of MONITOR_IDS) {
    const start = maze.monitorStarts[id];
    const houseReach = reachableFrom(maze, start, Passage.MonitorHouse);
    if (!houseReach.has(pointKey(maze.houseExit))) {
      issues.push(`Monitor "${id}" cannot get from its start to the house exit.`);
    }
  }

  // ---- 5. Playable contents --------------------------------------------------
  let nodes = 0;
  let orbs = 0;
  maze.forEachPickup((pickup, col, row) => {
    if (pickup === Pickup.Node) {
      nodes += 1;
    } else if (pickup === Pickup.PowerOrb) {
      orbs += 1;
    }
    if (!reachable.has(pointKey({ col, row }))) {
      issues.push(`Pickup at ${at(col, row)} cannot be collected.`);
    }
  });
  if (nodes === 0) {
    issues.push('The level has no nodes.');
  }
  if (orbs === 0) {
    issues.push('The level has no power orbs.');
  }

  return { valid: issues.length === 0, issues };
}

/** Throws a single error listing every problem, if the maze is invalid. */
export function assertValidMaze(maze: Maze): void {
  const result = validateMaze(maze);
  if (!result.valid) {
    const list = result.issues.map((issue) => `  - ${issue}`).join('\n');
    throw new Error(`Level ${maze.levelId} (${maze.name}) failed validation:\n${list}`);
  }
}
