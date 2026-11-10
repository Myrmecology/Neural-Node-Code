/**
 * Neural Node & Code - Chase cutscene (after level 4)
 *
 * The scientist sprints across a glowing runway, chased by a crowd of other
 * scientists who slowly gain on him.
 *
 * Also exports RunwayCutscene, a reusable stage with scripted runners, used by
 * both cutscenes. The stage sits far from the maze in the same scene, so the
 * camera just moves over to it.
 */
import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import type { FreeCamera, Scene } from '@babylonjs/core';
import { ScientistModel } from '../entities/ScientistModel';
import { color3 } from '../rendering/SceneSetup';
import type { HexColor } from '../rendering/Themes';
import { Direction, directionYaw } from '../utils/Direction';

/** Where the stage is built: well behind the camera's view of the maze. */
const STAGE_Z = 200;
const RUNWAY_LENGTH = 34;
const RUNWAY_WIDTH = 3.2;

/** A cutscene the game can start, update every frame, and dispose. */
export interface Cutscene {
  /** Caption shown while the cutscene plays. */
  readonly caption: string;
  readonly subtitle: string;
  /** Moves the camera to the stage and resets every runner. */
  start: () => void;
  /** Advances the cutscene. Returns true once it has finished. */
  update: (dt: number, time: number) => boolean;
  dispose: () => void;
}

export interface RunnerSpec {
  /** Seconds after the start before this runner sets off. */
  readonly delay: number;
  /** Running speed, in world units per second. */
  readonly speed: number;
  /** Offset across the runway, so the crowd does not overlap. */
  readonly lane: number;
  /** Size multiplier, for a varied crowd. */
  readonly scale: number;
  /** Shows the invincibility aura. */
  readonly powered: boolean;
}

export interface RunwayScript {
  readonly caption: string;
  readonly subtitle: string;
  /** +1 runs left to right, -1 runs right to left. */
  readonly direction: 1 | -1;
  readonly duration: number;
  readonly edgeColor: HexColor;
  readonly runners: readonly RunnerSpec[];
}

interface Runner {
  readonly spec: RunnerSpec;
  readonly model: ScientistModel;
}

export class RunwayCutscene implements Cutscene {
  readonly caption: string;
  readonly subtitle: string;

  private readonly camera: FreeCamera;
  private readonly script: RunwayScript;
  private readonly stage: TransformNode;
  private readonly runners: Runner[];
  private readonly materials: StandardMaterial[] = [];
  private elapsed = 0;

  constructor(scene: Scene, camera: FreeCamera, script: RunwayScript) {
    this.camera = camera;
    this.script = script;
    this.caption = script.caption;
    this.subtitle = script.subtitle;

    this.stage = new TransformNode('cutscene-stage', scene);
    this.stage.position.set(0, 0, STAGE_Z);

    const floorMaterial = new StandardMaterial('cutscene-floor', scene);
    floorMaterial.diffuseColor = new Color3(0.03, 0.03, 0.05);
    floorMaterial.specularColor = Color3.Black();
    const edgeMaterial = new StandardMaterial('cutscene-edge', scene);
    edgeMaterial.disableLighting = true;
    edgeMaterial.emissiveColor = color3(script.edgeColor);
    this.materials.push(floorMaterial, edgeMaterial);

    const floor = MeshBuilder.CreateGround(
      'cutscene-runway',
      { width: RUNWAY_LENGTH, height: RUNWAY_WIDTH },
      scene,
    );
    floor.material = floorMaterial;
    floor.parent = this.stage;

    for (const side of [-1, 1]) {
      const edge = MeshBuilder.CreateBox(
        'cutscene-runway-edge',
        { width: RUNWAY_LENGTH, height: 0.04, depth: 0.06 },
        scene,
      );
      edge.material = edgeMaterial;
      edge.parent = this.stage;
      edge.position.set(0, 0.02, (side * RUNWAY_WIDTH) / 2);
    }

    this.runners = script.runners.map((spec) => {
      const model = new ScientistModel(scene);
      model.root.parent = this.stage;
      model.root.scaling.set(spec.scale, spec.scale, spec.scale);
      return { spec, model };
    });

    this.stage.setEnabled(false);
  }

  start(): void {
    this.elapsed = 0;
    this.stage.setEnabled(true);
    this.camera.position.set(0, 3.2, STAGE_Z - 10.5);
    this.camera.setTarget(new Vector3(0, 0.6, STAGE_Z));

    const yaw = directionYaw(this.script.direction === 1 ? Direction.Right : Direction.Left);
    for (const runner of this.runners) {
      runner.model.reset(yaw);
      runner.model.setPosition(this.startX(), runner.spec.lane);
    }
  }

  update(dt: number, time: number): boolean {
    this.elapsed += dt;
    const yaw = directionYaw(this.script.direction === 1 ? Direction.Right : Direction.Left);

    for (const runner of this.runners) {
      const runTime = this.elapsed - runner.spec.delay;
      const moving = runTime > 0;
      const x = this.startX() + this.script.direction * runner.spec.speed * Math.max(runTime, 0);
      runner.model.setPosition(x, runner.spec.lane);
      runner.model.update(dt, {
        moving,
        // Scale stride speed down for bigger runners, so feet never slide.
        speed: runner.spec.speed / runner.spec.scale,
        yaw,
        powered: runner.spec.powered,
        time,
      });
    }

    if (this.elapsed >= this.script.duration) {
      this.stage.setEnabled(false);
      return true;
    }
    return false;
  }

  dispose(): void {
    for (const runner of this.runners) {
      runner.model.dispose();
    }
    this.stage.dispose(false, false);
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
  }

  /** Runners start just off-screen on the side they enter from. */
  private startX(): number {
    return (-this.script.direction * RUNWAY_LENGTH) / 2 - this.script.direction;
  }
}

/** Level 4 intermission: one scientist fleeing a crowd of scientists. */
export function createChaseCutscene(scene: Scene, camera: FreeCamera): Cutscene {
  return new RunwayCutscene(scene, camera, {
    caption: 'INTERMISSION',
    subtitle: 'PEER REVIEW',
    direction: 1,
    duration: 9,
    edgeColor: '#39ff14',
    runners: [
      // The hero.
      { delay: 0, speed: 5, lane: 0, scale: 1, powered: false },
      // The crowd, slightly faster, so they gain on him.
      { delay: 1.1, speed: 5.4, lane: -0.7, scale: 0.95, powered: false },
      { delay: 1.25, speed: 5.5, lane: 0.55, scale: 1.08, powered: false },
      { delay: 1.45, speed: 5.35, lane: -0.15, scale: 1, powered: false },
      { delay: 1.6, speed: 5.6, lane: 0.85, scale: 0.9, powered: false },
      { delay: 1.8, speed: 5.45, lane: -0.9, scale: 1.05, powered: false },
      { delay: 2.0, speed: 5.5, lane: 0.25, scale: 0.97, powered: false },
    ],
  });
}
