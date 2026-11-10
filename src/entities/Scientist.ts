/**
 * Neural Node & Code - Scientist movement
 *
 * Grid-exact movement logic for the player, with no 3D code. Every step is
 * checked with maze.canEnter(), so the scientist can never pass through a wall
 * or enter the monitor house.
 *
 * Movement rules (classic maze-chase feel):
 * - At a tile center, take the requested direction if it is open; otherwise
 *   keep going straight; if that is blocked too, stop against the wall.
 * - Reversing is allowed at any moment, even between tiles.
 * - Leaving through a side tunnel wraps to the opposite edge.
 *
 * Position is stored as (previous, current) per simulation step so the
 * renderer can blend between them with the game loop's alpha.
 */
import { TILE_SIZE } from '../core/Config';
import { Passage } from '../maze/Maze';
import type { Maze } from '../maze/Maze';
import {
  Direction,
  directionVector,
  directionYaw,
  isMoveDirection,
  isOpposite,
} from '../utils/Direction';
import type { MoveDirection } from '../utils/Direction';
import { gridToWorld, stepPoint } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';
import { lerp } from '../utils/MathUtils';
import type { ScientistModel } from './ScientistModel';

const EPSILON = 1e-9;
/** Safety cap on tile arrivals per step; real speeds need at most one. */
const MAX_STEPS_PER_UPDATE = 8;

export class Scientist {
  private maze: Maze;
  private tile: GridPoint;
  private direction: Direction = Direction.None;
  private facingDirection: MoveDirection = Direction.Left;
  private progress = 0;
  private lastSpeed = 0;

  private prevCol = 0;
  private prevRow = 0;
  private col = 0;
  private row = 0;

  private readonly arrivals: GridPoint[] = [];

  constructor(maze: Maze) {
    this.maze = maze;
    this.tile = maze.scientistStart;
    this.reset(maze);
  }

  /** The direction he last moved or is facing. */
  get facing(): MoveDirection {
    return this.facingDirection;
  }

  /** True if he moved during the last simulation step. */
  get isMoving(): boolean {
    return this.lastSpeed > 0;
  }

  /** Exact grid position (fractional while between tiles). */
  get position(): { readonly col: number; readonly row: number } {
    return { col: this.col, row: this.row };
  }

  /** The tile he occupies for collisions: whichever tile he is closer to. */
  get currentTile(): GridPoint {
    if (this.progress < 0.5 || !isMoveDirection(this.direction)) {
      return this.tile;
    }
    return this.maze.normalize(stepPoint(this.tile, this.direction));
  }

  /** Places him on his start tile for a new life or level. */
  reset(maze: Maze): void {
    this.maze = maze;
    this.tile = maze.scientistStart;
    this.direction = Direction.None;
    this.facingDirection = Direction.Left;
    this.progress = 0;
    this.lastSpeed = 0;
    this.syncPosition();
    this.prevCol = this.col;
    this.prevRow = this.row;
  }

  /** Spawn facing angle, for the model. */
  get spawnYaw(): number {
    return directionYaw(this.facingDirection);
  }

  /**
   * Advances movement by one simulation step.
   * @param dt     seconds
   * @param wanted direction requested by the player ("none" to keep going)
   * @param speed  tiles per second
   * @returns tiles he arrived at during this step (for collecting pickups)
   */
  update(dt: number, wanted: Direction, speed: number): readonly GridPoint[] {
    this.prevCol = this.col;
    this.prevRow = this.row;
    this.arrivals.length = 0;

    let teleported = false;
    let moved = false;

    // Instant reversal, even between tiles.
    if (
      this.progress > 0 &&
      isMoveDirection(this.direction) &&
      isMoveDirection(wanted) &&
      isOpposite(this.direction, wanted)
    ) {
      const ahead = stepPoint(this.tile, this.direction);
      const wrapped = this.maze.normalize(ahead);
      teleported = wrapped.col !== ahead.col;
      this.tile = wrapped;
      this.direction = wanted;
      this.progress = 1 - this.progress;
    }

    let distance = speed * dt;
    let steps = 0;
    while (distance > EPSILON && steps < MAX_STEPS_PER_UPDATE) {
      steps += 1;

      // At a tile center: choose the next direction.
      if (this.progress <= EPSILON) {
        this.progress = 0;
        if (isMoveDirection(wanted) && this.canMove(wanted)) {
          this.direction = wanted;
        } else if (!isMoveDirection(this.direction) || !this.canMove(this.direction)) {
          this.direction = Direction.None;
          break;
        }
      }

      const direction = this.direction;
      if (!isMoveDirection(direction)) {
        break;
      }

      const advance = Math.min(distance, 1 - this.progress);
      this.progress += advance;
      distance -= advance;
      moved = true;

      if (this.progress >= 1 - EPSILON) {
        const next = stepPoint(this.tile, direction);
        const wrapped = this.maze.normalize(next);
        if (wrapped.col !== next.col) {
          teleported = true;
        }
        this.tile = wrapped;
        this.progress = 0;
        this.arrivals.push(wrapped);
      }
    }

    if (isMoveDirection(this.direction)) {
      this.facingDirection = this.direction;
    } else if (isMoveDirection(wanted)) {
      // Standing against a wall: still turn to face where the player pushes.
      this.facingDirection = wanted;
    }

    this.lastSpeed = moved ? speed : 0;
    this.syncPosition();
    if (teleported) {
      this.prevCol = this.col;
      this.prevRow = this.row;
    }
    return this.arrivals;
  }

  /**
   * Moves and animates the 3D model.
   * @param alpha     blend between the previous and current simulation step
   * @param frameTime real seconds since the last display frame
   * @param time      game time in seconds
   * @param powered   true while invincible
   */
  renderTo(
    model: ScientistModel,
    alpha: number,
    frameTime: number,
    time: number,
    powered: boolean,
  ): void {
    const col = lerp(this.prevCol, this.col, alpha);
    const row = lerp(this.prevRow, this.row, alpha);
    const world = gridToWorld(col, row, this.maze.width, this.maze.height, TILE_SIZE);
    model.setPosition(world.x, world.z);
    model.update(frameTime, {
      moving: this.isMoving,
      speed: this.lastSpeed * TILE_SIZE,
      yaw: directionYaw(this.facingDirection),
      powered,
      time,
    });
  }

  /** True when the tile one step in `direction` is open to the scientist. */
  private canMove(direction: MoveDirection): boolean {
    return this.maze.canEnter(stepPoint(this.tile, direction), Passage.Scientist);
  }

  /** Recomputes the exact grid position from tile, direction, and progress. */
  private syncPosition(): void {
    const step = directionVector(this.direction);
    this.col = this.tile.col + step.col * this.progress;
    this.row = this.tile.row + step.row * this.progress;
  }
}
