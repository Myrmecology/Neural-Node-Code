/**
 * Neural Node & Code - Maze renderer
 *
 * Turns a Maze into the 3D world:
 * - Wall blocks (thin instances, slightly inset for a circuit-board look)
 * - Glowing edge caps on every wall that borders open space; the neural pulse
 *   ripples across these
 * - A dark floor with an etched tile grid
 * - A glowing bar for each monitor house door
 *
 * Level assembly: walls rise from the floor in a wave spreading out from the
 * center, with an overshoot "pop" (easeOutBack).
 */
import { Color3, DynamicTexture, MeshBuilder, StandardMaterial } from '@babylonjs/core';
import type { GlowLayer, Mesh, Scene } from '@babylonjs/core';
import { TILE_SIZE } from '../core/Config';
import { isBlinkOn } from '../rendering/Effects';
import type { PulseField } from '../rendering/Effects';
import { color3 } from '../rendering/SceneSetup';
import type { ThemePalette } from '../rendering/Themes';
import { Tile } from '../types';
import { gridToWorld } from '../utils/Grid';
import { clamp01, easeOutBack } from '../utils/MathUtils';
import type { Maze } from './Maze';

/** Height of a wall block, in world units. */
export const WALL_HEIGHT = 0.7;
/** Wall blocks are slightly smaller than a tile, leaving thin seams. */
const WALL_INSET = 0.94;
const CAP_INSET = 0.97;
const CAP_THICKNESS = 0.06;
/** Seconds between the first (center) and last (edge) wall starting to rise. */
const ASSEMBLY_SPREAD = 0.95;
/** Seconds for one wall to finish rising. */
const RISE_TIME = 0.55;
const ASSEMBLY_DURATION = ASSEMBLY_SPREAD + RISE_TIME;
/** Base brightness of the edge caps when no pulse is passing. */
const EDGE_BASE = 0.6;
const DOOR_HEIGHT = 0.12;
const GRID_PIXELS_PER_TILE = 32;

interface WallTile {
  readonly x: number;
  readonly z: number;
  readonly delay: number;
  readonly hasCap: boolean;
}

/** Writes a scale-then-translate matrix (no rotation) into a thin instance buffer. */
function writeTransform(
  buffer: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const offset = index * 16;
  buffer.fill(0, offset, offset + 16);
  buffer[offset] = sx;
  buffer[offset + 5] = sy;
  buffer[offset + 10] = sz;
  buffer[offset + 12] = x;
  buffer[offset + 13] = y;
  buffer[offset + 14] = z;
  buffer[offset + 15] = 1;
}

/** True when any of the 8 surrounding tiles is open (path, door, or house). */
function bordersOpenSpace(maze: Maze, col: number, row: number): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if ((dc !== 0 || dr !== 0) && maze.tileAt(col + dc, row + dr) !== Tile.Wall) {
        return true;
      }
    }
  }
  return false;
}

export class MazeRenderer {
  private readonly scene: Scene;
  private readonly glow: GlowLayer;
  private readonly disposables: { dispose: () => void }[] = [];

  private walls: WallTile[] = [];
  private body: Mesh | null = null;
  private caps: Mesh | null = null;
  private doors: Mesh[] = [];
  private bodyMatrices = new Float32Array(0);
  private capMatrices = new Float32Array(0);
  private capColors = new Float32Array(0);

  private edgeColor = Color3.White();
  private pulseColor = Color3.White();
  private assemblyTime = ASSEMBLY_DURATION;
  private flashing = false;
  private flashTime = 0;
  private colorsDirty = true;

  constructor(scene: Scene, glow: GlowLayer) {
    this.scene = scene;
    this.glow = glow;
  }

  /** True once every wall has finished rising. */
  get assemblyComplete(): boolean {
    return this.assemblyTime >= ASSEMBLY_DURATION;
  }

  /** Builds the 3D maze for a level, replacing any previous one. Walls start fully raised. */
  build(maze: Maze, theme: ThemePalette): void {
    this.disposeMeshes();
    this.edgeColor = color3(theme.wallEdge);
    this.pulseColor = color3(theme.pulse);

    const centerCol = (maze.width - 1) / 2;
    const centerRow = (maze.height - 1) / 2;
    const maxDistance = Math.hypot(centerCol, centerRow);

    const walls: WallTile[] = [];
    maze.forEachTile((tile, col, row) => {
      if (tile !== Tile.Wall) {
        return;
      }
      const world = gridToWorld(col, row, maze.width, maze.height, TILE_SIZE);
      const distance = Math.hypot(col - centerCol, row - centerRow);
      walls.push({
        x: world.x,
        z: world.z,
        delay: (distance / maxDistance) * ASSEMBLY_SPREAD,
        hasCap: bordersOpenSpace(maze, col, row),
      });
    });
    this.walls = walls;

    this.buildFloor(maze, theme);
    this.buildWalls(theme);
    this.buildDoors(maze, theme);

    this.assemblyTime = ASSEMBLY_DURATION;
    this.flashing = false;
    this.colorsDirty = true;
    this.writeMatrices();
  }

  /** Lowers every wall into the floor and starts the rising wave. */
  startAssembly(): void {
    this.assemblyTime = 0;
    this.writeMatrices();
  }

  /** Flashes the edge caps on and off, used when a level is cleared. */
  setFlashing(on: boolean): void {
    this.flashing = on;
    this.flashTime = 0;
    this.colorsDirty = true;
  }

  /** Advances the assembly animation and refreshes edge colors. Call every frame. */
  update(dt: number, pulse: PulseField): void {
    if (!this.assemblyComplete) {
      this.assemblyTime = Math.min(this.assemblyTime + dt, ASSEMBLY_DURATION);
      this.writeMatrices();
    }
    if (this.flashing) {
      this.flashTime += dt;
    }
    if (this.colorsDirty || pulse.active || this.flashing) {
      this.writeCapColors(pulse);
      // Keep refreshing while something is animating, plus one final frame after.
      this.colorsDirty = pulse.active || this.flashing;
    }
  }

  dispose(): void {
    this.disposeMeshes();
  }

  // ---------------------------------------------------------------------------
  //  Building
  // ---------------------------------------------------------------------------

  private buildFloor(maze: Maze, theme: ThemePalette): void {
    const width = maze.width * TILE_SIZE;
    const depth = maze.height * TILE_SIZE;

    const texture = new DynamicTexture(
      'floor-grid',
      { width: maze.width * GRID_PIXELS_PER_TILE, height: maze.height * GRID_PIXELS_PER_TILE },
      this.scene,
      true,
    );
    const context = texture.getContext();
    const pixelWidth = maze.width * GRID_PIXELS_PER_TILE;
    const pixelHeight = maze.height * GRID_PIXELS_PER_TILE;
    context.fillStyle = theme.floor;
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    context.strokeStyle = theme.floorGrid;
    context.lineWidth = 2;
    context.beginPath();
    for (let col = 0; col <= maze.width; col += 1) {
      context.moveTo(col * GRID_PIXELS_PER_TILE, 0);
      context.lineTo(col * GRID_PIXELS_PER_TILE, pixelHeight);
    }
    for (let row = 0; row <= maze.height; row += 1) {
      context.moveTo(0, row * GRID_PIXELS_PER_TILE);
      context.lineTo(pixelWidth, row * GRID_PIXELS_PER_TILE);
    }
    context.stroke();
    texture.update();

    const material = new StandardMaterial('floor-material', this.scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.Black();
    material.specularColor = Color3.Black();
    material.emissiveTexture = texture;

    const floor = MeshBuilder.CreateGround('floor', { width, height: depth }, this.scene);
    floor.material = material;
    floor.position.y = -0.002;
    floor.isPickable = false;
    floor.freezeWorldMatrix();
    this.glow.addExcludedMesh(floor);

    this.disposables.push(floor, material, texture);
  }

  private buildWalls(theme: ThemePalette): void {
    const wallBody = color3(theme.wallBody);

    const bodyMaterial = new StandardMaterial('wall-body-material', this.scene);
    bodyMaterial.diffuseColor = wallBody;
    bodyMaterial.emissiveColor = wallBody.scale(0.6);
    bodyMaterial.specularColor = new Color3(0.15, 0.15, 0.15);

    const body = MeshBuilder.CreateBox('wall-bodies', { size: 1 }, this.scene);
    body.material = bodyMaterial;
    body.isPickable = false;
    body.alwaysSelectAsActiveMesh = true;
    this.bodyMatrices = new Float32Array(this.walls.length * 16);
    body.thinInstanceSetBuffer('matrix', this.bodyMatrices, 16, false);
    this.glow.addExcludedMesh(body);

    const capCount = this.walls.filter((wall) => wall.hasCap).length;
    const capMaterial = new StandardMaterial('wall-cap-material', this.scene);
    capMaterial.disableLighting = true;
    capMaterial.diffuseColor = Color3.White();
    capMaterial.emissiveColor = Color3.Black();

    const caps = MeshBuilder.CreateBox('wall-caps', { size: 1 }, this.scene);
    caps.material = capMaterial;
    caps.isPickable = false;
    caps.alwaysSelectAsActiveMesh = true;
    this.capMatrices = new Float32Array(capCount * 16);
    this.capColors = new Float32Array(capCount * 4);
    caps.thinInstanceSetBuffer('matrix', this.capMatrices, 16, false);
    caps.thinInstanceSetBuffer('color', this.capColors, 4, false);
    this.glow.referenceMeshToUseItsOwnMaterial(caps);

    this.body = body;
    this.caps = caps;
    this.disposables.push(body, bodyMaterial, caps, capMaterial);
  }

  private buildDoors(maze: Maze, theme: ThemePalette): void {
    const material = new StandardMaterial('door-material', this.scene);
    material.disableLighting = true;
    material.emissiveColor = color3(theme.door);
    this.disposables.push(material);

    for (const door of maze.doors) {
      const world = gridToWorld(door.col, door.row, maze.width, maze.height, TILE_SIZE);
      const mesh = MeshBuilder.CreateBox(
        'door',
        { width: TILE_SIZE, height: DOOR_HEIGHT, depth: TILE_SIZE * 0.2 },
        this.scene,
      );
      mesh.material = material;
      mesh.position.set(world.x, WALL_HEIGHT * 0.5, world.z);
      mesh.isPickable = false;
      this.doors.push(mesh);
      this.disposables.push(mesh);
    }
  }

  // ---------------------------------------------------------------------------
  //  Per-frame updates
  // ---------------------------------------------------------------------------

  /** Writes every wall and cap transform for the current assembly progress. */
  private writeMatrices(): void {
    const body = this.body;
    const caps = this.caps;
    if (body === null || caps === null) {
      return;
    }

    let capIndex = 0;
    this.walls.forEach((wall, index) => {
      const t = clamp01((this.assemblyTime - wall.delay) / RISE_TIME);
      const rise = t <= 0 ? 0 : easeOutBack(t);
      const height = Math.max(WALL_HEIGHT * rise, 0.001);

      writeTransform(
        this.bodyMatrices,
        index,
        wall.x,
        height / 2,
        wall.z,
        TILE_SIZE * WALL_INSET,
        height,
        TILE_SIZE * WALL_INSET,
      );

      if (wall.hasCap) {
        writeTransform(
          this.capMatrices,
          capIndex,
          wall.x,
          height + CAP_THICKNESS / 2,
          wall.z,
          TILE_SIZE * CAP_INSET,
          CAP_THICKNESS,
          TILE_SIZE * CAP_INSET,
        );
        capIndex += 1;
      }
    });

    const doorScale = Math.max(clamp01(this.assemblyTime / ASSEMBLY_DURATION), 0.001);
    for (const door of this.doors) {
      door.scaling.y = doorScale;
    }

    body.thinInstanceBufferUpdated('matrix');
    caps.thinInstanceBufferUpdated('matrix');
  }

  /** Colors every edge cap: base glow, plus any passing pulse, or the clear flash. */
  private writeCapColors(pulse: PulseField): void {
    const caps = this.caps;
    if (caps === null) {
      return;
    }

    const flashOn = this.flashing && isBlinkOn(this.flashTime, 4);
    let capIndex = 0;
    for (const wall of this.walls) {
      if (!wall.hasCap) {
        continue;
      }
      const offset = capIndex * 4;
      if (flashOn) {
        this.capColors[offset] = 1;
        this.capColors[offset + 1] = 1;
        this.capColors[offset + 2] = 1;
      } else {
        const boost = pulse.sample(wall.x, wall.z);
        this.capColors[offset] = Math.min(
          1,
          this.edgeColor.r * EDGE_BASE + this.pulseColor.r * boost,
        );
        this.capColors[offset + 1] = Math.min(
          1,
          this.edgeColor.g * EDGE_BASE + this.pulseColor.g * boost,
        );
        this.capColors[offset + 2] = Math.min(
          1,
          this.edgeColor.b * EDGE_BASE + this.pulseColor.b * boost,
        );
      }
      this.capColors[offset + 3] = 1;
      capIndex += 1;
    }
    caps.thinInstanceBufferUpdated('color');
  }

  private disposeMeshes(): void {
    for (const item of this.disposables) {
      item.dispose();
    }
    this.disposables.length = 0;
    this.walls = [];
    this.doors = [];
    this.body = null;
    this.caps = null;
  }
}
