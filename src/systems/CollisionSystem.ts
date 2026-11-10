/**
 * Neural Node & Code - Collisions
 *
 * Detects contact between the scientist and the monitors using real distance
 * rather than tile equality, so two characters moving toward each other can
 * never pass through one another between steps. Distance wraps across the
 * side tunnels.
 *
 * Results:
 * - caught: frightened monitors the scientist touched (he catches them)
 * - killer: a hunting monitor that touched him (he loses a life)
 *  * Every contact is reported: if the scientist touches a frightened monitor
 * and a hunting monitor in the same step, he catches the first and is still
 * caught by the second.
 */
import { TILE_SIZE } from '../core/Config';
import type { Monitor } from '../entities/Monitor';
import type { Scientist } from '../entities/Scientist';
import type { Maze } from '../maze/Maze';
import { gridToWorld } from '../utils/Grid';

/** Contact distance, in tiles. Slightly under one tile feels fair. */
const CONTACT_RADIUS = 0.62;

export interface CollisionReport {
  readonly caught: readonly Monitor[];
  readonly killer: Monitor | null;
}

/** Horizontal distance that accounts for wrapping through the side tunnels. */
function wrappedDeltaX(a: number, b: number, mazeWorldWidth: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, mazeWorldWidth - direct);
}

export function checkCollisions(
  scientist: Scientist,
  monitors: readonly Monitor[],
  maze: Maze,
): CollisionReport {
  const position = scientist.position;
  const scientistWorld = gridToWorld(
    position.col,
    position.row,
    maze.width,
    maze.height,
    TILE_SIZE,
  );
  const mazeWorldWidth = maze.width * TILE_SIZE;
  const radius = CONTACT_RADIUS * TILE_SIZE;

  const caught: Monitor[] = [];
  let killer: Monitor | null = null;

  for (const monitor of monitors) {
    const ai = monitor.ai;
    if (!ai.isVulnerable && !ai.isDangerous) {
      continue;
    }
    const monitorWorld = ai.worldPosition(1);
    const dx = wrappedDeltaX(scientistWorld.x, monitorWorld.x, mazeWorldWidth);
    const dz = scientistWorld.z - monitorWorld.z;
    if (dx * dx + dz * dz > radius * radius) {
      continue;
    }
    if (ai.isVulnerable) {
      caught.push(monitor);
    } else {
      killer ??= monitor;
    }
  }

  return { caught, killer };
}
