/**
 * Neural Node & Code - Data nodes and power orbs
 *
 * Renders every collectible as breathing, rotating wireframe geometry:
 * - Nodes:      small wireframe icosahedrons with a glowing core
 * - Power orbs: larger wireframe dodecahedrons that pulse faster and brighter
 *
 * Each node's breathing is phase-offset by its position, so a slow wave of
 * light rolls diagonally across the maze. Everything is drawn with thin
 * instances: four draw calls no matter how many nodes the level has.
 */
import { Matrix, MeshBuilder, Quaternion, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { TILE_SIZE } from '../core/Config';
import type { Maze } from '../maze/Maze';
import { color3 } from '../rendering/SceneSetup';
import type { HexColor, ThemePalette } from '../rendering/Themes';
import { Pickup } from '../types';
import { gridToWorld, pointKey } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';
import { TAU, clamp01, easeOutBack, pulse } from '../utils/MathUtils';

/** Babylon polyhedron type numbers. */
const ICOSAHEDRON = 3;
const DODECAHEDRON = 2;

interface GroupStyle {
  /** Polyhedron type for the wireframe shell. */
  readonly shape: number;
  /** Shell size, in world units. */
  readonly shellSize: number;
  /** Glowing core diameter, in world units. */
  readonly coreSize: number;
  /** Height above the floor. */
  readonly height: number;
  /** Seconds per breath. */
  readonly period: number;
  /** How much the scale swells on each breath (0.25 = 25%). */
  readonly swell: number;
  /** Rotation speed, in radians per second. */
  readonly spin: number;
}

const NODE_STYLE: GroupStyle = {
  shape: ICOSAHEDRON,
  shellSize: 0.11,
  coreSize: 0.07,
  height: 0.35,
  period: 2.6,
  swell: 0.22,
  spin: 0.7,
};

const ORB_STYLE: GroupStyle = {
  shape: DODECAHEDRON,
  shellSize: 0.24,
  coreSize: 0.16,
  height: 0.42,
  period: 0.9,
  swell: 0.32,
  spin: 1.4,
};

interface Instance {
  readonly x: number;
  readonly z: number;
  /** 0..1 offset into the breathing cycle. */
  readonly phase: number;
  visible: boolean;
}

interface InstanceGroup {
  readonly style: GroupStyle;
  readonly shell: Mesh;
  readonly core: Mesh;
  readonly matrices: Float32Array;
  readonly instances: Instance[];
}

export class DataNodeField {
  private readonly scene: Scene;
  private readonly materials: StandardMaterial[] = [];
  private nodes: InstanceGroup | null = null;
  private orbs: InstanceGroup | null = null;
  private readonly lookup = new Map<string, Instance>();
  private reveal = 1;

  // Reused math objects, so updates allocate nothing.
  private readonly tempMatrix = new Matrix();
  private readonly tempScale = new Vector3();
  private readonly tempPosition = new Vector3();
  private readonly tempRotation = new Quaternion();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /** Creates instances for every node and power orb still in the maze. */
  build(maze: Maze, theme: ThemePalette): void {
    this.disposeGroups();

    const nodeInstances: Instance[] = [];
    const orbInstances: Instance[] = [];

    maze.forEachPickup((pickup, col, row) => {
      const world = gridToWorld(col, row, maze.width, maze.height, TILE_SIZE);
      const instance: Instance = {
        x: world.x,
        z: world.z,
        // Diagonal offset makes the breathing roll across the maze as a wave.
        phase: ((col + row) * 0.045) % 1,
        visible: true,
      };
      this.lookup.set(pointKey({ col, row }), instance);
      if (pickup === Pickup.PowerOrb) {
        orbInstances.push(instance);
      } else {
        nodeInstances.push(instance);
      }
    });

    this.nodes = this.createGroup('node', NODE_STYLE, theme.node, nodeInstances);
    this.orbs = this.createGroup('orb', ORB_STYLE, theme.powerOrb, orbInstances);
  }

  /** Hides the node or orb on a tile once it is collected. */
  collect(point: GridPoint): void {
    const instance = this.lookup.get(pointKey(point));
    if (instance !== undefined) {
      instance.visible = false;
    }
  }

  /**
   * Scales every collectible in or out, used during level assembly.
   * 0 = hidden, 1 = fully shown.
   */
  setReveal(amount: number): void {
    this.reveal = clamp01(amount);
  }

  /** Animates breathing and rotation. Call every frame. */
  update(time: number): void {
    const reveal = this.reveal <= 0 ? 0 : easeOutBack(this.reveal);
    if (this.nodes !== null) {
      this.writeGroup(this.nodes, time, reveal);
    }
    if (this.orbs !== null) {
      this.writeGroup(this.orbs, time, reveal);
    }
  }

  dispose(): void {
    this.disposeGroups();
  }

  // ---------------------------------------------------------------------------
  //  Internals
  // ---------------------------------------------------------------------------

  private createGroup(
    name: string,
    style: GroupStyle,
    hex: HexColor,
    instances: Instance[],
  ): InstanceGroup {
    const color = color3(hex);

    const shellMaterial = new StandardMaterial(`${name}-shell-material`, this.scene);
    shellMaterial.disableLighting = true;
    shellMaterial.wireframe = true;
    shellMaterial.emissiveColor = color;

    const coreMaterial = new StandardMaterial(`${name}-core-material`, this.scene);
    coreMaterial.disableLighting = true;
    coreMaterial.emissiveColor = color.scale(1.15);

    this.materials.push(shellMaterial, coreMaterial);

    const shell = MeshBuilder.CreatePolyhedron(
      `${name}-shells`,
      { type: style.shape, size: style.shellSize },
      this.scene,
    );
    const core = MeshBuilder.CreateSphere(
      `${name}-cores`,
      { diameter: style.coreSize, segments: 8 },
      this.scene,
    );
    shell.material = shellMaterial;
    core.material = coreMaterial;

    // One shared transform buffer drives both the shell and its core.
    const matrices = new Float32Array(Math.max(instances.length, 1) * 16);
    for (const mesh of [shell, core]) {
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.thinInstanceCount = instances.length;
    }

    return { style, shell, core, matrices, instances };
  }

  private writeGroup(group: InstanceGroup, time: number, reveal: number): void {
    const { style } = group;
    group.instances.forEach((instance, index) => {
      const breath = pulse(time, style.period, instance.phase);
      const scale = instance.visible ? (1 - style.swell / 2 + breath * style.swell) * reveal : 0;
      const angle = time * style.spin + instance.phase * TAU;
      const bob = Math.sin((time / style.period + instance.phase) * TAU) * 0.025;

      this.tempScale.set(scale, scale, scale);
      this.tempPosition.set(instance.x, style.height + bob, instance.z);
      Quaternion.RotationYawPitchRollToRef(angle, angle * 0.5, 0, this.tempRotation);
      Matrix.ComposeToRef(this.tempScale, this.tempRotation, this.tempPosition, this.tempMatrix);
      this.tempMatrix.copyToArray(group.matrices, index * 16);
    });
    group.shell.thinInstanceBufferUpdated('matrix');
    group.core.thinInstanceBufferUpdated('matrix');
  }

  private disposeGroups(): void {
    for (const group of [this.nodes, this.orbs]) {
      if (group !== null) {
        group.shell.dispose();
        group.core.dispose();
      }
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
    this.lookup.clear();
    this.nodes = null;
    this.orbs = null;
  }
}
