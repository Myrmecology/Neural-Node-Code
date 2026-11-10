/**
 * Neural Node & Code - Maze
 *
 * Parses a text-drawn level into tiles, pickups, and key positions, and
 * answers movement questions for every character.
 *
 * LEGEND (each character is one tile):
 *   #  wall
 *   .  path with a node
 *   o  path with a power orb
 *      (space) empty path
 *   =  tunnel path (monitors slow down here; no pickups)
 *   -  monitor house door
 *   _  monitor house interior
 *   1  virus start   (inside the house)
 *   2  worm start    (inside the house)
 *   3  glitch start  (inside the house)
 *   4  trojan start  (inside the house)
 *   S  scientist start (empty path)
 *   E  house exit: the path tile just outside the door (empty path)
 *
 * Containment rules:
 *   - Anything outside the grid is a wall, except columns on a wrap row,
 *     which wrap around to the other side (the side tunnels).
 *   - The scientist may only enter path tiles.
 *   - Roaming monitors may only enter path tiles.
 *   - Only monitors leaving, returning to, or inside the house may use the
 *     door and house tiles.
 */
import { MonitorId, Pickup, Tile } from '../types';
import type { LevelDefinition, ThemeId } from '../types';
import { Grid2D, gridPoint, wrapColumn } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';

/** Who is trying to move, which decides which tiles they may enter. */
export const Passage = {
  /** The scientist: path tiles only. */
  Scientist: 'scientist',
  /** A roaming monitor: path tiles only. */
  Monitor: 'monitor',
  /** A monitor leaving, returning to, or inside the house: path, door, and house tiles. */
  MonitorHouse: 'monitorHouse',
} as const;

export type Passage = (typeof Passage)[keyof typeof Passage];

const MONITOR_DIGITS: Readonly<Record<string, MonitorId>> = {
  '1': MonitorId.Virus,
  '2': MonitorId.Worm,
  '3': MonitorId.Glitch,
  '4': MonitorId.Trojan,
};

interface ParsedLayout {
  readonly width: number;
  readonly height: number;
  readonly tiles: Grid2D<Tile>;
  readonly tunnels: Grid2D<boolean>;
  readonly pickups: Grid2D<Pickup>;
  readonly scientistStart: GridPoint;
  readonly houseExit: GridPoint;
  readonly monitorStarts: Readonly<Record<MonitorId, GridPoint>>;
  readonly doors: readonly GridPoint[];
}

/** Converts a level's text layout into grids, throwing a clear error on any mistake. */
function parseLayout(level: LevelDefinition): ParsedLayout {
  const rows = level.layout;
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const where = `Level ${level.id} (${level.name})`;

  if (height === 0 || width === 0) {
    throw new Error(`${where}: layout is empty.`);
  }

  const tiles = new Grid2D<Tile>(width, height, () => Tile.Wall);
  const tunnels = new Grid2D<boolean>(width, height, () => false);
  const pickups = new Grid2D<Pickup>(width, height, () => Pickup.None);
  const doors: GridPoint[] = [];
  const starts: Partial<Record<MonitorId, GridPoint>> = {};
  let scientistStart: GridPoint | null = null;
  let houseExit: GridPoint | null = null;

  for (let row = 0; row < height; row += 1) {
    const line = rows[row] ?? '';
    if (line.length !== width) {
      throw new Error(
        `${where}: row ${row} has ${line.length} characters; every row must have ${width}.`,
      );
    }

    for (let col = 0; col < width; col += 1) {
      const symbol = line.charAt(col);
      switch (symbol) {
        case '#':
          break;
        case '.':
          tiles.set(col, row, Tile.Path);
          pickups.set(col, row, Pickup.Node);
          break;
        case 'o':
          tiles.set(col, row, Tile.Path);
          pickups.set(col, row, Pickup.PowerOrb);
          break;
        case ' ':
          tiles.set(col, row, Tile.Path);
          break;
        case '=':
          tiles.set(col, row, Tile.Path);
          tunnels.set(col, row, true);
          break;
        case '-':
          tiles.set(col, row, Tile.Door);
          doors.push(gridPoint(col, row));
          break;
        case '_':
          tiles.set(col, row, Tile.House);
          break;
        case 'S':
          if (scientistStart !== null) {
            throw new Error(`${where}: more than one scientist start (S).`);
          }
          tiles.set(col, row, Tile.Path);
          scientistStart = gridPoint(col, row);
          break;
        case 'E':
          if (houseExit !== null) {
            throw new Error(`${where}: more than one house exit (E).`);
          }
          tiles.set(col, row, Tile.Path);
          houseExit = gridPoint(col, row);
          break;
        case '1':
        case '2':
        case '3':
        case '4': {
          const id = MONITOR_DIGITS[symbol];
          if (id === undefined) {
            throw new Error(`${where}: unknown monitor digit "${symbol}".`);
          }
          if (starts[id] !== undefined) {
            throw new Error(`${where}: more than one start for monitor "${id}".`);
          }
          tiles.set(col, row, Tile.House);
          starts[id] = gridPoint(col, row);
          break;
        }
        default:
          throw new Error(`${where}: unknown symbol "${symbol}" at column ${col}, row ${row}.`);
      }
    }
  }

  if (scientistStart === null) {
    throw new Error(`${where}: missing scientist start (S).`);
  }
  if (houseExit === null) {
    throw new Error(`${where}: missing house exit (E).`);
  }
  if (doors.length === 0) {
    throw new Error(`${where}: missing monitor house door (-).`);
  }

  const requireStart = (id: MonitorId): GridPoint => {
    const start = starts[id];
    if (start === undefined) {
      throw new Error(`${where}: missing start for monitor "${id}".`);
    }
    return start;
  };

  return {
    width,
    height,
    tiles,
    tunnels,
    pickups,
    scientistStart,
    houseExit,
    doors,
    monitorStarts: {
      [MonitorId.Virus]: requireStart(MonitorId.Virus),
      [MonitorId.Worm]: requireStart(MonitorId.Worm),
      [MonitorId.Glitch]: requireStart(MonitorId.Glitch),
      [MonitorId.Trojan]: requireStart(MonitorId.Trojan),
    },
  };
}

export class Maze {
  readonly levelId: number;
  readonly name: string;
  readonly theme: ThemeId;
  readonly width: number;
  readonly height: number;
  readonly scientistStart: GridPoint;
  readonly houseExit: GridPoint;
  readonly monitorStarts: Readonly<Record<MonitorId, GridPoint>>;
  readonly doors: readonly GridPoint[];
  /** Rows whose left and right edges connect through a side tunnel. */
  readonly wrapRows: ReadonlySet<number>;
  /** Number of nodes plus power orbs when the level starts. */
  readonly totalPickups: number;

  private readonly tiles: Grid2D<Tile>;
  private readonly tunnels: Grid2D<boolean>;
  private readonly initialPickups: Grid2D<Pickup>;
  private pickups: Grid2D<Pickup>;
  private remaining: number;

  constructor(level: LevelDefinition) {
    const parsed = parseLayout(level);

    this.levelId = level.id;
    this.name = level.name;
    this.theme = level.theme;
    this.width = parsed.width;
    this.height = parsed.height;
    this.tiles = parsed.tiles;
    this.tunnels = parsed.tunnels;
    this.initialPickups = parsed.pickups;
    this.pickups = parsed.pickups.clone();
    this.scientistStart = parsed.scientistStart;
    this.houseExit = parsed.houseExit;
    this.monitorStarts = parsed.monitorStarts;
    this.doors = parsed.doors;

    const wrapRows = new Set<number>();
    for (let row = 0; row < this.height; row += 1) {
      const left = this.tiles.get(0, row);
      const right = this.tiles.get(this.width - 1, row);
      if (left === Tile.Path && right === Tile.Path) {
        wrapRows.add(row);
      }
    }
    this.wrapRows = wrapRows;

    let count = 0;
    this.initialPickups.forEach((pickup) => {
      if (pickup !== Pickup.None) {
        count += 1;
      }
    });
    this.totalPickups = count;
    this.remaining = count;
  }

  // ---------------------------------------------------------------------------
  //  Tiles and movement
  // ---------------------------------------------------------------------------

  /** Wraps a point through the side tunnels if it lies on a wrap row. */
  normalize(point: GridPoint): GridPoint {
    if (this.wrapRows.has(point.row)) {
      return gridPoint(wrapColumn(point.col, this.width), point.row);
    }
    return point;
  }

  /** The tile at a position. Anything outside the maze (except tunnels) is a wall. */
  tileAt(col: number, row: number): Tile {
    if (row < 0 || row >= this.height) {
      return Tile.Wall;
    }
    let safeCol = col;
    if (col < 0 || col >= this.width) {
      if (!this.wrapRows.has(row)) {
        return Tile.Wall;
      }
      safeCol = wrapColumn(col, this.width);
    }
    return this.tiles.get(safeCol, row) ?? Tile.Wall;
  }

  /** True when a character with the given passage rules may enter the tile. */
  canEnter(point: GridPoint, passage: Passage): boolean {
    const tile = this.tileAt(point.col, point.row);
    if (tile === Tile.Wall) {
      return false;
    }
    if (tile === Tile.Path) {
      return true;
    }
    // Door and house tiles: only monitors moving to or from the house.
    return passage === Passage.MonitorHouse;
  }

  /** True when the tile is part of a side tunnel. */
  isTunnel(point: GridPoint): boolean {
    const safe = this.normalize(point);
    return this.tunnels.get(safe.col, safe.row) ?? false;
  }

  // ---------------------------------------------------------------------------
  //  Pickups
  // ---------------------------------------------------------------------------

  /** Nodes and power orbs still in the maze. */
  get remainingPickups(): number {
    return this.remaining;
  }

  /** What is on a tile, without removing it. */
  pickupAt(point: GridPoint): Pickup {
    const safe = this.normalize(point);
    return this.pickups.get(safe.col, safe.row) ?? Pickup.None;
  }

  /** Removes and returns whatever is on a tile. Returns "none" if the tile is empty. */
  takePickup(point: GridPoint): Pickup {
    const safe = this.normalize(point);
    const pickup = this.pickups.get(safe.col, safe.row) ?? Pickup.None;
    if (pickup !== Pickup.None) {
      this.pickups.set(safe.col, safe.row, Pickup.None);
      this.remaining -= 1;
    }
    return pickup;
  }

  /** Restores every node and power orb, for replaying the level. */
  resetPickups(): void {
    this.pickups = this.initialPickups.clone();
    this.remaining = this.totalPickups;
  }

  /** Calls `callback` for every tile in the maze. */
  forEachTile(callback: (tile: Tile, col: number, row: number) => void): void {
    this.tiles.forEach(callback);
  }

  /** Calls `callback` for every pickup still in the maze. */
  forEachPickup(callback: (pickup: Pickup, col: number, row: number) => void): void {
    this.pickups.forEach((pickup, col, row) => {
      if (pickup !== Pickup.None) {
        callback(pickup, col, row);
      }
    });
  }
}
