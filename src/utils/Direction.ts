/**
 * Neural Node & Code - Directions
 *
 * The four grid movement directions plus "none", and helpers for working
 * with them.
 *
 * Grid convention used throughout the game:
 *   - col increases to the RIGHT
 *   - row increases DOWNWARD (row 0 is the top of the maze)
 *
 * World convention (Babylon.js, left-handed, Y up):
 *   - world X = col
 *   - world Z = -row (the top of the maze is the far side from the camera)
 *   - a model with rotation.y = 0 faces +Z, which is "up" on the grid
 */

export const Direction = {
  None: 'none',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

/** Any real direction of travel (excludes "none"). */
export type MoveDirection = Exclude<Direction, typeof Direction.None>;

/** A step on the maze grid. */
export interface GridVector {
  readonly col: number;
  readonly row: number;
}

/**
 * The four travel directions in tie-break priority order.
 * When a monitor has two equally good choices at an intersection, the
 * earlier direction in this list wins (up, then left, then down, then right),
 * matching the classic arcade behavior.
 */
export const MOVE_DIRECTIONS: readonly MoveDirection[] = [
  Direction.Up,
  Direction.Left,
  Direction.Down,
  Direction.Right,
];

const VECTORS: Readonly<Record<Direction, GridVector>> = {
  [Direction.None]: { col: 0, row: 0 },
  [Direction.Up]: { col: 0, row: -1 },
  [Direction.Down]: { col: 0, row: 1 },
  [Direction.Left]: { col: -1, row: 0 },
  [Direction.Right]: { col: 1, row: 0 },
};

const OPPOSITES: Readonly<Record<Direction, Direction>> = {
  [Direction.None]: Direction.None,
  [Direction.Up]: Direction.Down,
  [Direction.Down]: Direction.Up,
  [Direction.Left]: Direction.Right,
  [Direction.Right]: Direction.Left,
};

/** Y-axis rotation (radians) that makes a +Z-facing model face each direction. */
const YAW: Readonly<Record<MoveDirection, number>> = {
  [Direction.Up]: 0,
  [Direction.Right]: Math.PI / 2,
  [Direction.Down]: Math.PI,
  [Direction.Left]: -Math.PI / 2,
};

/** The grid step for a direction. "none" returns a zero step. */
export function directionVector(direction: Direction): GridVector {
  return VECTORS[direction];
}

/** The direction pointing the opposite way. "none" stays "none". */
export function oppositeDirection(direction: Direction): Direction {
  return OPPOSITES[direction];
}

/** True for up, down, left, and right; false for "none". */
export function isMoveDirection(direction: Direction): direction is MoveDirection {
  return direction !== Direction.None;
}

/** True when two directions point exactly opposite ways. */
export function isOpposite(a: Direction, b: Direction): boolean {
  return a !== Direction.None && OPPOSITES[a] === b;
}

/** True for left and right. */
export function isHorizontal(direction: Direction): boolean {
  return direction === Direction.Left || direction === Direction.Right;
}

/** True for up and down. */
export function isVertical(direction: Direction): boolean {
  return direction === Direction.Up || direction === Direction.Down;
}

/** The Y-axis rotation (radians) a character model should use to face a direction. */
export function directionYaw(direction: MoveDirection): number {
  return YAW[direction];
}
