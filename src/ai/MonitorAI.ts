/**
 * Neural Node & Code - Monitor AI
 *
 * One MonitorAI instance per monitor. Each owns its own mode, position,
 * timers, and random generator: nothing is shared that could make the
 * monitors move as a group.
 *
 * Lifecycle: house -> leaving -> scatter/chase (frightened when the scientist
 * is invincible) -> returning when caught -> entering -> leaving again.
 *
 * Movement rules (every step is checked with maze.canEnter):
 * - Decisions are made only at tile centers.
 * - A monitor never reverses on its own; reversal happens only when its
 *   scatter/chase mode changes or when it becomes frightened.
 * - Targeting modes pick the open direction whose next tile is closest to the
 *   monitor's own target; ties break up, left, down, right.
 * - Frightened monitors choose randomly, each from its own seeded generator.
 * - Roaming monitors may only use path tiles; only monitors leaving or
 *   returning to the house may use the door and house tiles.
 */
import { TILE_SIZE } from '../core/Config';
import { Passage } from '../maze/Maze';
import type { Maze } from '../maze/Maze';
import { MonitorMode, Tile } from '../types';
import type { DifficultySettings, MonitorId } from '../types';
import {
  Direction,
  MOVE_DIRECTIONS,
  directionVector,
  directionYaw,
  isMoveDirection,
  oppositeDirection,
} from '../utils/Direction';
import type { MoveDirection } from '../utils/Direction';
import { distanceSquared, gridToWorld, samePoint, stepPoint } from '../utils/Grid';
import type { GridPoint, WorldPoint } from '../utils/Grid';
import { SeededRandom, lerp } from '../utils/MathUtils';
import type { ModeScheduler } from './ModeScheduler';
import { PERSONALITIES } from './Personalities';
import type { Personality } from './Personalities';

const EPSILON = 1e-9;
const MAX_STEPS_PER_UPDATE = 8;
/** Monitors move at this fraction of their speed while leaving the house. */
const LEAVING_SPEED_FACTOR = 0.6;

/** What a monitor can see of the world when it updates. */
export interface MonitorWorld {
  readonly scheduler: ModeScheduler;
  readonly scientistTile: GridPoint;
  readonly scientistFacing: MoveDirection;
  readonly virusTile: GridPoint;
}

export class MonitorAI {
  readonly id: MonitorId;
  /** Release order (0..3). */
  readonly slot: number;
  readonly personality: Personality;

  private maze: Maze;
  private difficulty: DifficultySettings;
  private readonly random: SeededRandom;
  private readonly seed: number;

  private currentMode: MonitorMode = MonitorMode.House;
  private tile: GridPoint;
  private direction: Direction = Direction.None;
  private facingDirection: MoveDirection = Direction.Up;
  private progress = 0;
  private houseTimer = 0;
  /** Set when power starts while this monitor is home; it leaves frightened. */
  private scared = false;
  private reversePending = false;
  private lastTarget: GridPoint;

  private prevCol = 0;
  private prevRow = 0;
  private col = 0;
  private row = 0;

  constructor(id: MonitorId, slot: number, maze: Maze, difficulty: DifficultySettings) {
    this.id = id;
    this.slot = slot;
    this.personality = PERSONALITIES[id];
    this.maze = maze;
    this.difficulty = difficulty;
    this.seed = 0x6d6f6e + slot * 7919;
    this.random = new SeededRandom(this.seed);
    this.tile = maze.monitorStarts[id];
    this.lastTarget = this.tile;
    this.reset(maze, difficulty);
  }

  // ---------------------------------------------------------------------------
  //  State queries
  // ---------------------------------------------------------------------------

  get mode(): MonitorMode {
    return this.currentMode;
  }

  /** True while the scientist can catch this monitor. */
  get isVulnerable(): boolean {
    return this.currentMode === MonitorMode.Frightened;
  }

  /** True while touching this monitor costs the scientist a life. */
  get isDangerous(): boolean {
    return this.currentMode === MonitorMode.Scatter || this.currentMode === MonitorMode.Chase;
  }

  /** The tile used for collisions: whichever tile the monitor is closer to. */
  get currentTile(): GridPoint {
    if (this.progress < 0.5 || !isMoveDirection(this.direction)) {
      return this.tile;
    }
    return this.maze.normalize(stepPoint(this.tile, this.direction));
  }

  /** The direction the monitor is facing, for its 3D model. */
  get facing(): MoveDirection {
    return this.facingDirection;
  }

  /** The tile the monitor most recently aimed for (useful for debugging). */
  get target(): GridPoint {
    return this.lastTarget;
  }

  /** Facing angle for the 3D model. */
  get yaw(): number {
    return directionYaw(this.facingDirection);
  }

  /** World position blended between the last two simulation steps. */
  worldPosition(alpha: number): WorldPoint {
    const col = lerp(this.prevCol, this.col, alpha);
    const row = lerp(this.prevRow, this.row, alpha);
    return gridToWorld(col, row, this.maze.width, this.maze.height, TILE_SIZE);
  }

  // ---------------------------------------------------------------------------
  //  Commands
  // ---------------------------------------------------------------------------

  /** Returns the monitor to its house for a new life or level. */
  reset(maze: Maze, difficulty: DifficultySettings): void {
    this.maze = maze;
    this.difficulty = difficulty;
    this.currentMode = MonitorMode.House;
    this.tile = maze.monitorStarts[this.id];
    this.direction = Direction.None;
    this.facingDirection = Direction.Up;
    this.progress = 0;
    this.houseTimer = difficulty.releaseDelays[this.slot] ?? 0;
    this.scared = false;
    this.reversePending = false;
    this.lastTarget = this.tile;
    this.syncPosition();
    this.prevCol = this.col;
    this.prevRow = this.row;
  }

  /** The scientist became invincible. */
  startFrightened(): void {
    if (this.currentMode === MonitorMode.Returning || this.currentMode === MonitorMode.Entering) {
      return;
    }
    if (this.difficulty.frightenedDuration <= 0) {
      return;
    }
    this.scared = true;
    if (this.currentMode === MonitorMode.Scatter || this.currentMode === MonitorMode.Chase) {
      this.currentMode = MonitorMode.Frightened;
      this.reversePending = true;
    } else if (this.currentMode === MonitorMode.Frightened) {
      // A second power orb while already frightened: reverse again.
      this.reversePending = true;
    }
  }

  /** Invincibility ran out. */
  endFrightened(baseMode: typeof MonitorMode.Scatter | typeof MonitorMode.Chase): void {
    this.scared = false;
    if (this.currentMode === MonitorMode.Frightened) {
      this.currentMode = baseMode;
    }
  }

  /** The scientist caught this monitor: race back to the house. */
  caught(): void {
    this.scared = false;
    this.reversePending = false;
    this.currentMode = MonitorMode.Returning;
  }

  // ---------------------------------------------------------------------------
  //  Simulation
  // ---------------------------------------------------------------------------

  update(dt: number, world: MonitorWorld): void {
    this.prevCol = this.col;
    this.prevRow = this.row;

    if (this.currentMode === MonitorMode.House) {
      this.houseTimer -= dt;
      if (this.houseTimer <= 0) {
        this.currentMode = MonitorMode.Leaving;
      }
      return;
    }

    // Follow the scatter/chase rhythm, reversing whenever it changes.
    if (this.currentMode === MonitorMode.Scatter || this.currentMode === MonitorMode.Chase) {
      const base = world.scheduler.modeFor(this.slot);
      if (base !== this.currentMode) {
        this.currentMode = base;
        this.reversePending = true;
      }
    }

    if (this.reversePending) {
      this.reversePending = false;
      this.reverse();
    }

    this.move(dt, world);

    if (isMoveDirection(this.direction)) {
      this.facingDirection = this.direction;
    }
  }

  /** Advances along the grid, deciding at tile centers. */
  private move(dt: number, world: MonitorWorld): void {
    let distance = this.speed() * dt;
    let teleported = false;
    let steps = 0;

    while (distance > EPSILON && steps < MAX_STEPS_PER_UPDATE) {
      steps += 1;

      if (this.progress <= EPSILON) {
        this.progress = 0;
        const choice = this.chooseDirection(world);
        if (choice === null) {
          this.direction = Direction.None;
          break;
        }
        this.direction = choice;
      }

      const direction = this.direction;
      if (!isMoveDirection(direction)) {
        break;
      }

      const advance = Math.min(distance, 1 - this.progress);
      this.progress += advance;
      distance -= advance;

      if (this.progress >= 1 - EPSILON) {
        const next = stepPoint(this.tile, direction);
        const wrapped = this.maze.normalize(next);
        if (wrapped.col !== next.col) {
          teleported = true;
        }
        this.tile = wrapped;
        this.progress = 0;
        if (this.handleArrival(world)) {
          // Mode changed on arrival; resume next step with the new rules.
          break;
        }
      }
    }

    this.syncPosition();
    if (teleported) {
      this.prevCol = this.col;
      this.prevRow = this.row;
    }
  }

  /** Checks for mode transitions on reaching a tile center. Returns true if the mode changed. */
  private handleArrival(world: MonitorWorld): boolean {
    switch (this.currentMode) {
      case MonitorMode.Leaving:
        // Outside the house once standing on an ordinary path tile.
        if (this.maze.tileAt(this.tile.col, this.tile.row) === Tile.Path) {
          this.currentMode = this.scared
            ? MonitorMode.Frightened
            : world.scheduler.modeFor(this.slot);
          return true;
        }
        return false;
      case MonitorMode.Returning:
        if (samePoint(this.tile, this.maze.houseExit)) {
          this.currentMode = MonitorMode.Entering;
          return true;
        }
        return false;
      case MonitorMode.Entering:
        if (samePoint(this.tile, this.maze.monitorStarts[this.id])) {
          // Rebooted: head straight back out.
          this.currentMode = MonitorMode.Leaving;
          this.direction = Direction.None;
          return true;
        }
        return false;
      case MonitorMode.House:
      case MonitorMode.Scatter:
      case MonitorMode.Chase:
      case MonitorMode.Frightened:
        return false;
    }
  }

  /** Picks the next direction at a tile center, or null if completely boxed in. */
  private chooseDirection(world: MonitorWorld): MoveDirection | null {
    const passage = this.passage();
    const reverse = isMoveDirection(this.direction) ? oppositeDirection(this.direction) : null;

    let options = MOVE_DIRECTIONS.filter(
      (direction) =>
        direction !== reverse && this.maze.canEnter(stepPoint(this.tile, direction), passage),
    );
    if (options.length === 0 && reverse !== null && isMoveDirection(reverse)) {
      // Only allowed as a last resort (should never happen in a validated maze).
      options = this.maze.canEnter(stepPoint(this.tile, reverse), passage) ? [reverse] : [];
    }
    if (options.length === 0) {
      return null;
    }

    if (this.currentMode === MonitorMode.Frightened) {
      return this.random.pick(options);
    }

    const target = this.targetTile(world);
    this.lastTarget = target;
    let best: MoveDirection | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    // MOVE_DIRECTIONS order (up, left, down, right) breaks ties.
    for (const direction of options) {
      const candidate = this.maze.normalize(stepPoint(this.tile, direction));
      const distance = distanceSquared(candidate, target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = direction;
      }
    }
    return best;
  }

  /** The tile this monitor is trying to reach in its current mode. */
  private targetTile(world: MonitorWorld): GridPoint {
    switch (this.currentMode) {
      case MonitorMode.Scatter:
        return this.personality.scatterTarget(this.maze.width, this.maze.height);
      case MonitorMode.Chase:
        return this.personality.chaseTarget({
          self: this.tile,
          scientist: world.scientistTile,
          scientistFacing: world.scientistFacing,
          virus: world.virusTile,
          mazeWidth: this.maze.width,
          mazeHeight: this.maze.height,
        });
      case MonitorMode.Leaving:
      case MonitorMode.Returning:
        return this.maze.houseExit;
      case MonitorMode.Entering:
      case MonitorMode.House:
        return this.maze.monitorStarts[this.id];
      case MonitorMode.Frightened:
        return this.tile;
    }
  }

  /** Which tiles this monitor may enter in its current mode. */
  private passage(): Passage {
    switch (this.currentMode) {
      case MonitorMode.House:
      case MonitorMode.Leaving:
      case MonitorMode.Entering:
        return Passage.MonitorHouse;
      case MonitorMode.Scatter:
      case MonitorMode.Chase:
      case MonitorMode.Frightened:
      case MonitorMode.Returning:
        return Passage.Monitor;
    }
  }

  /** Speed in tiles per second for the current mode and location. */
  private speed(): number {
    const d = this.difficulty;
    const inTunnel = this.maze.isTunnel(this.tile);
    switch (this.currentMode) {
      case MonitorMode.House:
        return 0;
      case MonitorMode.Leaving:
        return d.monitorSpeed * LEAVING_SPEED_FACTOR;
      case MonitorMode.Scatter:
      case MonitorMode.Chase:
        return inTunnel ? d.monitorTunnelSpeed : d.monitorSpeed * this.personality.speedFactor;
      case MonitorMode.Frightened:
        return inTunnel ? d.monitorTunnelSpeed : d.monitorFrightenedSpeed;
      case MonitorMode.Returning:
      case MonitorMode.Entering:
        return d.monitorReturnSpeed;
    }
  }

  /** Turns around immediately, even between tiles. */
  private reverse(): void {
    if (!isMoveDirection(this.direction)) {
      return;
    }
    const back = oppositeDirection(this.direction);
    if (this.progress > 0) {
      this.tile = this.maze.normalize(stepPoint(this.tile, this.direction));
      this.progress = 1 - this.progress;
      this.direction = back;
    } else if (
      isMoveDirection(back) &&
      this.maze.canEnter(stepPoint(this.tile, back), this.passage())
    ) {
      this.direction = back;
    }
  }

  private syncPosition(): void {
    const step = directionVector(this.direction);
    this.col = this.tile.col + step.col * this.progress;
    this.row = this.tile.row + step.row * this.progress;
  }
}
