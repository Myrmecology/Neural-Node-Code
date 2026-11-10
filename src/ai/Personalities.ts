/**
 * Neural Node & Code - Monitor personalities
 *
 * Each monitor has its own targeting rule. Because the four monitors aim at
 * four DIFFERENT target tiles at every intersection, they take different
 * routes and cannot collapse into a single cluster.
 *
 * Targets may lie outside the maze (scatter corners do); monitors only use
 * them to measure distance, never to move there directly.
 */
import { MonitorId } from '../types';
import { directionVector } from '../utils/Direction';
import type { MoveDirection } from '../utils/Direction';
import { distanceSquared, gridPoint, stepPoint } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';

/** Everything a monitor may consider when choosing its chase target. */
export interface ChaseContext {
  readonly self: GridPoint;
  readonly scientist: GridPoint;
  readonly scientistFacing: MoveDirection;
  /** The Virus's tile, used by the Glitch to flank. */
  readonly virus: GridPoint;
  readonly mazeWidth: number;
  readonly mazeHeight: number;
}

export interface Personality {
  readonly id: MonitorId;
  readonly displayName: string;
  readonly role: string;
  /** Multiplies the level's monitor speed, so no two monitors move in lockstep. */
  readonly speedFactor: number;
  /** The home corner this monitor retreats toward in scatter mode. */
  scatterTarget: (mazeWidth: number, mazeHeight: number) => GridPoint;
  /** The tile this monitor tries to reach in chase mode. */
  chaseTarget: (context: ChaseContext) => GridPoint;
}

/** Tiles ahead of the scientist the Worm aims for. */
const WORM_LOOKAHEAD = 4;
/** Tiles ahead of the scientist the Glitch uses as its pivot. */
const GLITCH_PIVOT = 2;
/** The Trojan retreats once it gets within this many tiles of the scientist. */
const TROJAN_COMFORT_RADIUS = 8;

const virus: Personality = {
  id: MonitorId.Virus,
  displayName: 'VIRUS',
  role: 'Hunter',
  speedFactor: 1,
  scatterTarget: (width) => gridPoint(width - 3, -3),
  chaseTarget: ({ scientist }) => scientist,
};

const worm: Personality = {
  id: MonitorId.Worm,
  displayName: 'WORM',
  role: 'Ambusher',
  speedFactor: 0.97,
  scatterTarget: () => gridPoint(2, -3),
  chaseTarget: ({ scientist, scientistFacing }) =>
    stepPoint(scientist, scientistFacing, WORM_LOOKAHEAD),
};

const glitch: Personality = {
  id: MonitorId.Glitch,
  displayName: 'GLITCH',
  role: 'Flanker',
  speedFactor: 0.98,
  scatterTarget: (width, height) => gridPoint(width - 1, height + 1),
  chaseTarget: ({ scientist, scientistFacing, virus: virusTile }) => {
    const pivot = stepPoint(scientist, scientistFacing, GLITCH_PIVOT);
    return gridPoint(2 * pivot.col - virusTile.col, 2 * pivot.row - virusTile.row);
  },
};

const trojan: Personality = {
  id: MonitorId.Trojan,
  displayName: 'TROJAN',
  role: 'Coward',
  speedFactor: 0.95,
  scatterTarget: (_width, height) => gridPoint(0, height + 1),
  chaseTarget: ({ self, scientist, mazeWidth, mazeHeight }) => {
    const radiusSquared = TROJAN_COMFORT_RADIUS * TROJAN_COMFORT_RADIUS;
    if (distanceSquared(self, scientist) > radiusSquared) {
      return scientist;
    }
    return trojan.scatterTarget(mazeWidth, mazeHeight);
  },
};

export const PERSONALITIES: Readonly<Record<MonitorId, Personality>> = {
  [MonitorId.Virus]: virus,
  [MonitorId.Worm]: worm,
  [MonitorId.Glitch]: glitch,
  [MonitorId.Trojan]: trojan,
};

/** The grid step the scientist is facing, exported for debugging overlays. */
export function facingStep(direction: MoveDirection): { col: number; row: number } {
  const step = directionVector(direction);
  return { col: step.col, row: step.row };
}
