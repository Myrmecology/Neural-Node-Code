/**
 * Neural Node & Code - Maze tests
 *
 * Proves that every level is sealed, fully reachable, free of dead ends, and
 * playable, and that the containment rules keep every character inside the
 * maze. Also proves the validator catches broken layouts.
 */
import { describe, expect, it } from 'vitest';
import { Maze, Passage } from '../src/maze/Maze';
import { validateMaze } from '../src/maze/MazeValidator';
import { LEVELS, getLevel } from '../src/maze/levels';
import { MONITOR_IDS, Pickup, Tile } from '../src/types';
import type { LevelDefinition } from '../src/types';

/** A tiny valid maze used to test the validator against known mistakes. */
const TINY_LAYOUT: readonly string[] = [
  '##########',
  '#o..E.S.o#',
  '#.##-###.#',
  '#.#1234#.#',
  '#.######.#',
  '#........#',
  '##########',
];

function tinyLevel(layout: readonly string[]): LevelDefinition {
  return { id: 99, name: 'Test Maze', theme: 'synapse', layout };
}

function withRow(layout: readonly string[], row: number, replacement: string): string[] {
  return layout.map((line, index) => (index === row ? replacement : line));
}

// =============================================================================
//  Every real level
// =============================================================================

describe.each(LEVELS)('Level $id: $name', (level) => {
  const maze = new Maze(level);

  it('passes every validation check', () => {
    expect(validateMaze(maze).issues).toEqual([]);
  });

  it('is 28 columns by 31 rows', () => {
    expect(maze.width).toBe(28);
    expect(maze.height).toBe(31);
  });

  it('has at least one side tunnel', () => {
    expect(maze.wrapRows.size).toBeGreaterThan(0);
  });

  it('keeps the scientist out of the monitor house', () => {
    for (const door of maze.doors) {
      expect(maze.canEnter(door, Passage.Scientist)).toBe(false);
      expect(maze.canEnter(door, Passage.Monitor)).toBe(false);
      expect(maze.canEnter(door, Passage.MonitorHouse)).toBe(true);
    }
    for (const id of MONITOR_IDS) {
      const start = maze.monitorStarts[id];
      expect(maze.canEnter(start, Passage.Scientist)).toBe(false);
      expect(maze.canEnter(start, Passage.MonitorHouse)).toBe(true);
    }
  });

  it('treats everything above and below the maze as wall', () => {
    for (let col = -2; col < maze.width + 2; col += 1) {
      expect(maze.tileAt(col, -1)).toBe(Tile.Wall);
      expect(maze.tileAt(col, maze.height)).toBe(Tile.Wall);
    }
  });

  it('treats everything beside the maze as wall, except tunnel rows', () => {
    for (let row = 0; row < maze.height; row += 1) {
      const outsideLeft = maze.tileAt(-1, row);
      const outsideRight = maze.tileAt(maze.width, row);
      if (maze.wrapRows.has(row)) {
        expect(outsideLeft).toBe(Tile.Path);
        expect(outsideRight).toBe(Tile.Path);
      } else {
        expect(outsideLeft).toBe(Tile.Wall);
        expect(outsideRight).toBe(Tile.Wall);
      }
    }
  });
});

describe('Level registry', () => {
  it('contains 8 levels with unique names and themes', () => {
    expect(LEVELS).toHaveLength(8);
    expect(new Set(LEVELS.map((level) => level.name)).size).toBe(8);
    expect(new Set(LEVELS.map((level) => level.theme)).size).toBe(8);
  });

  it('looks levels up by number and rejects invalid numbers', () => {
    expect(getLevel(1).name).toBe('Synapse');
    expect(getLevel(8).name).toBe('Singularity');
    expect(() => getLevel(0)).toThrow(RangeError);
    expect(() => getLevel(9)).toThrow(RangeError);
  });
});

// =============================================================================
//  Tunnels and pickups (using level 1)
// =============================================================================

describe('Maze behavior', () => {
  it('wraps through the side tunnel to the opposite edge', () => {
    const maze = new Maze(getLevel(1));
    expect(maze.wrapRows.has(14)).toBe(true);
    expect(maze.normalize({ col: -1, row: 14 })).toEqual({ col: 27, row: 14 });
    expect(maze.normalize({ col: 28, row: 14 })).toEqual({ col: 0, row: 14 });
    expect(maze.canEnter({ col: -1, row: 14 }, Passage.Scientist)).toBe(true);
    expect(maze.isTunnel({ col: 0, row: 14 })).toBe(true);
  });

  it('never wraps on a row without a tunnel', () => {
    const maze = new Maze(getLevel(1));
    expect(maze.normalize({ col: -1, row: 1 })).toEqual({ col: -1, row: 1 });
    expect(maze.canEnter({ col: -1, row: 1 }, Passage.Scientist)).toBe(false);
  });

  it('collects each pickup once and restores them on reset', () => {
    const maze = new Maze(getLevel(1));
    const total = maze.totalPickups;
    expect(total).toBe(306);

    expect(maze.takePickup({ col: 1, row: 1 })).toBe(Pickup.Node);
    expect(maze.takePickup({ col: 1, row: 1 })).toBe(Pickup.None);
    expect(maze.remainingPickups).toBe(total - 1);

    expect(maze.takePickup({ col: 1, row: 3 })).toBe(Pickup.PowerOrb);
    expect(maze.remainingPickups).toBe(total - 2);

    maze.resetPickups();
    expect(maze.remainingPickups).toBe(total);
    expect(maze.pickupAt({ col: 1, row: 1 })).toBe(Pickup.Node);
  });
});

// =============================================================================
//  The validator catches broken layouts
// =============================================================================

describe('Maze validator', () => {
  it('accepts a correct maze', () => {
    expect(validateMaze(new Maze(tinyLevel(TINY_LAYOUT))).valid).toBe(true);
  });

  it('detects dead ends', () => {
    const broken = withRow(TINY_LAYOUT, 5, '#.......##');
    const result = validateMaze(new Maze(tinyLevel(broken)));
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.startsWith('Dead end'))).toBe(true);
  });

  it('detects a gap in the outer wall', () => {
    const broken = withRow(TINY_LAYOUT, 0, '#####.####');
    const result = validateMaze(new Maze(tinyLevel(broken)));
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.startsWith('Border gap'))).toBe(true);
  });

  it('detects a level with no power orbs', () => {
    const broken = TINY_LAYOUT.map((line) => line.replaceAll('o', '.'));
    const result = validateMaze(new Maze(tinyLevel(broken)));
    expect(result.issues).toContain('The level has no power orbs.');
  });

  it('rejects unknown symbols and missing starts while parsing', () => {
    expect(() => new Maze(tinyLevel(withRow(TINY_LAYOUT, 5, '#....X...#')))).toThrow(
      /unknown symbol/,
    );
    expect(() => new Maze(tinyLevel(withRow(TINY_LAYOUT, 1, '#o..E...o#')))).toThrow(
      /missing scientist start/,
    );
    expect(() => new Maze(tinyLevel(withRow(TINY_LAYOUT, 2, '#.##.###.#')))).toThrow(
      /missing monitor house door/,
    );
  });
});
