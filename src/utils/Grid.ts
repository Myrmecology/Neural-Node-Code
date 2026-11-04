/**
 * Neural Node & Code - Grid utilities
 *
 * Tile positions, distances, tunnel wrapping, grid-to-world conversion, and a
 * bounds-checked 2D grid container.
 *
 * Grid convention: col increases to the right, row increases downward.
 * World convention: world X = col, world Z = -row, maze centered on the origin.
 * (See Direction.ts for the full explanation.)
 */
import { directionVector } from './Direction';
import type { Direction } from './Direction';

/** A tile position on the maze grid. */
export interface GridPoint {
  readonly col: number;
  readonly row: number;
}

/** A position on the 3D ground plane (Y is handled separately). */
export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/** Creates a grid point. */
export function gridPoint(col: number, row: number): GridPoint {
  return { col, row };
}

/** True when two grid points refer to the same tile. */
export function samePoint(a: GridPoint, b: GridPoint): boolean {
  return a.col === b.col && a.row === b.row;
}

/** The tile reached by moving `distance` tiles in `direction` (no wrapping). */
export function stepPoint(point: GridPoint, direction: Direction, distance = 1): GridPoint {
  const step = directionVector(direction);
  return { col: point.col + step.col * distance, row: point.row + step.row * distance };
}

/**
 * Wraps a column into the range 0..width-1.
 * Used for the side tunnels: leaving the left edge enters from the right.
 */
export function wrapColumn(col: number, width: number): number {
  return ((col % width) + width) % width;
}

/** Wraps a point horizontally for tunnel travel. Rows never wrap. */
export function wrapPoint(point: GridPoint, width: number): GridPoint {
  return { col: wrapColumn(point.col, width), row: point.row };
}

/** Squared straight-line distance. Used by monitor targeting (no square root needed). */
export function distanceSquared(a: GridPoint, b: GridPoint): number {
  const dc = a.col - b.col;
  const dr = a.row - b.row;
  return dc * dc + dr * dr;
}

/** Tile-count distance moving only horizontally and vertically. */
export function manhattanDistance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

/** A stable string key for a tile, for use in Sets and Maps. */
export function pointKey(point: GridPoint): string {
  return `${point.col},${point.row}`;
}

/**
 * Converts a grid position to a world position on the ground plane.
 * Accepts fractional values, so characters moving between tiles convert
 * smoothly. The maze is centered on the world origin.
 */
export function gridToWorld(
  col: number,
  row: number,
  mazeWidth: number,
  mazeHeight: number,
  tileSize: number,
): WorldPoint {
  return {
    x: (col - (mazeWidth - 1) / 2) * tileSize,
    z: -(row - (mazeHeight - 1) / 2) * tileSize,
  };
}

/**
 * A fixed-size, bounds-checked 2D grid.
 * Reading outside the grid returns `undefined` instead of crashing, and
 * writing outside the grid throws, so mistakes surface immediately.
 */
export class Grid2D<T> {
  readonly width: number;
  readonly height: number;
  private readonly cells: T[];

  constructor(width: number, height: number, init: (col: number, row: number) => T) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Grid2D size must be positive integers, got ${width}x${height}.`);
    }
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: width * height }, (_, index) =>
      init(index % width, Math.floor(index / width)),
    );
  }

  /** True when the position lies inside the grid. */
  inBounds(col: number, row: number): boolean {
    return (
      Number.isInteger(col) &&
      Number.isInteger(row) &&
      col >= 0 &&
      row >= 0 &&
      col < this.width &&
      row < this.height
    );
  }

  /** The value at a position, or `undefined` if the position is outside the grid. */
  get(col: number, row: number): T | undefined {
    if (!this.inBounds(col, row)) {
      return undefined;
    }
    return this.cells[row * this.width + col];
  }

  /** Sets the value at a position. Throws if the position is outside the grid. */
  set(col: number, row: number, value: T): void {
    if (!this.inBounds(col, row)) {
      throw new RangeError(
        `Grid2D position (${col}, ${row}) is outside ${this.width}x${this.height}.`,
      );
    }
    this.cells[row * this.width + col] = value;
  }

  /** Calls `callback` for every cell, row by row from the top-left. */
  forEach(callback: (value: T, col: number, row: number) => void): void {
    for (let index = 0; index < this.cells.length; index += 1) {
      const value = this.cells[index];
      if (value !== undefined) {
        callback(value, index % this.width, Math.floor(index / this.width));
      }
    }
  }

  /** Creates an independent copy of the grid (values are copied by reference). */
  clone(): Grid2D<T> {
    return new Grid2D(this.width, this.height, (col, row) => {
      const value = this.get(col, row);
      if (value === undefined) {
        throw new Error(`Grid2D clone failed at (${col}, ${row}).`);
      }
      return value;
    });
  }
}
