/**
 * Neural Node & Code - Monitor
 *
 * Pairs one monitor's independent AI (logic) with its 3D model (visuals).
 * The AI decides where the monitor goes; this class hands that position and
 * mode to the model each frame.
 */
import type { Scene } from '@babylonjs/core';
import { MonitorAI } from '../ai/MonitorAI';
import type { MonitorWorld } from '../ai/MonitorAI';
import type { Maze } from '../maze/Maze';
import { MONITOR_IDS } from '../types';
import type { DifficultySettings, MonitorId } from '../types';
import { MonitorModel } from './MonitorModel';

export class Monitor {
  readonly ai: MonitorAI;
  readonly model: MonitorModel;

  constructor(
    scene: Scene,
    id: MonitorId,
    slot: number,
    maze: Maze,
    difficulty: DifficultySettings,
  ) {
    this.ai = new MonitorAI(id, slot, maze, difficulty);
    this.model = new MonitorModel(scene, id, slot);
  }

  get id(): MonitorId {
    return this.ai.id;
  }

  /** Sends the monitor back to the house for a new life or level. */
  reset(maze: Maze, difficulty: DifficultySettings): void {
    this.ai.reset(maze, difficulty);
  }

  /** Advances the AI by one simulation step. */
  update(dt: number, world: MonitorWorld): void {
    this.ai.update(dt, world);
  }

  /**
   * Updates the 3D model once per display frame.
   * @param alpha               blend between the last two simulation steps
   * @param frameTime           real seconds since the last display frame
   * @param time                game time in seconds
   * @param frightenedRemaining seconds of invincibility left (0 when none)
   * @param frightenedWarning   seconds before the end when flashing begins
   */
  render(
    alpha: number,
    frameTime: number,
    time: number,
    frightenedRemaining: number,
    frightenedWarning: number,
  ): void {
    const world = this.ai.worldPosition(alpha);
    this.model.update(frameTime, {
      x: world.x,
      z: world.z,
      mode: this.ai.mode,
      facing: this.ai.facing,
      time,
      frightenedRemaining,
      frightenedWarning,
    });
  }

  setVisible(visible: boolean): void {
    this.model.setVisible(visible);
  }

  dispose(): void {
    this.model.dispose();
  }
}

/** Creates all four monitors, in release order. */
export function createMonitors(
  scene: Scene,
  maze: Maze,
  difficulty: DifficultySettings,
): Monitor[] {
  return MONITOR_IDS.map((id, slot) => new Monitor(scene, id, slot, maze, difficulty));
}
