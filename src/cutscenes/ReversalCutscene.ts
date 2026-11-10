/**
 * Neural Node & Code - Reversal cutscene (after level 8)
 *
 * The tables turn: the crowd of scientists flees right to left, and the
 * scientist charges after them, glowing with invincibility and gaining fast.
 * Reuses the runway stage from ChaseCutscene.ts.
 */
import type { FreeCamera, Scene } from '@babylonjs/core';
import { RunwayCutscene } from './ChaseCutscene';
import type { Cutscene } from './ChaseCutscene';

/** Level 8 intermission: the scientist chasing the crowd. */
export function createReversalCutscene(scene: Scene, camera: FreeCamera): Cutscene {
  return new RunwayCutscene(scene, camera, {
    caption: 'INTERMISSION',
    subtitle: 'REVERSE ENGINEERING',
    direction: -1,
    duration: 9,
    edgeColor: '#ff1744',
    runners: [
      // The crowd flees first.
      { delay: 0, speed: 5.4, lane: -0.7, scale: 0.95, powered: false },
      { delay: 0.15, speed: 5.5, lane: 0.55, scale: 1.08, powered: false },
      { delay: 0.3, speed: 5.35, lane: -0.15, scale: 1, powered: false },
      { delay: 0.45, speed: 5.6, lane: 0.85, scale: 0.9, powered: false },
      { delay: 0.6, speed: 5.45, lane: -0.9, scale: 1.05, powered: false },
      { delay: 0.75, speed: 5.5, lane: 0.25, scale: 0.97, powered: false },
      // The scientist, powered up and faster than all of them.
      { delay: 1.6, speed: 6.6, lane: 0, scale: 1, powered: true },
    ],
  });
}
