/**
 * Neural Node & Code - Scene setup
 *
 * Creates the Babylon.js engine, scene, fixed angled camera, lights, and the
 * glow layer that makes emissive materials (walls, nodes, screens) radiate.
 *
 * Camera: fixed, tilted overhead view looking toward the top of the maze.
 * frameMaze() moves it back exactly far enough to fit the whole maze on
 * screen, and is called again on every resize.
 */
import {
  Color3,
  DirectionalLight,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  Scene,
  Vector3,
} from '@babylonjs/core';
import { TILE_SIZE } from '../core/Config';
import type { HexColor, ThemePalette } from './Themes';

/** Camera angle above the horizon. 90 would be straight down. */
const CAMERA_ELEVATION = (58 * Math.PI) / 180;
/** Vertical field of view, in radians. */
const CAMERA_FOV = 0.75;
/** Extra space around the maze, leaving room for the HUD. */
const FRAME_MARGIN = 1.14;
/** Caps rendering resolution on very high-density displays, for steady frame rates. */
const MAX_PIXEL_RATIO = 2;

export interface SceneContext {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: FreeCamera;
  readonly glow: GlowLayer;
  readonly keyLight: DirectionalLight;
  readonly fillLight: HemisphericLight;
}

/** Converts a #RRGGBB theme color into a Babylon.js color. */
export function color3(hex: HexColor): Color3 {
  return Color3.FromHexString(hex);
}

/** Creates the engine, scene, camera, lights, and glow layer. */
export function createSceneContext(canvas: HTMLCanvasElement): SceneContext {
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: false,
      stencil: true,
      powerPreference: 'high-performance',
    },
    false,
  );
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new Scene(engine);
  scene.clearColor = Color3.Black().toColor4(1);
  scene.ambientColor = new Color3(0.12, 0.12, 0.14);
  // Nothing in the game is clicked in 3D, so skip pointer picking work.
  scene.skipPointerMovePicking = true;

  const camera = new FreeCamera('camera', new Vector3(0, 30, -20), scene);
  camera.fov = CAMERA_FOV;
  camera.minZ = 0.1;
  camera.maxZ = 400;
  // The camera is fixed: remove all mouse and keyboard camera controls.
  camera.inputs.clear();
  camera.setTarget(Vector3.Zero());

  const fillLight = new HemisphericLight('fill-light', new Vector3(0, 1, 0), scene);
  fillLight.intensity = 0.55;
  fillLight.groundColor = new Color3(0.05, 0.05, 0.08);

  const keyLight = new DirectionalLight('key-light', new Vector3(-0.35, -1, 0.55), scene);
  keyLight.intensity = 0.85;

  const glow = new GlowLayer('glow', scene, {
    mainTextureSamples: 4,
    blurKernelSize: 48,
  });
  glow.intensity = 0.85;

  return { engine, scene, camera, glow, keyLight, fillLight };
}

/**
 * Positions the camera so a maze of the given size (in tiles) fits the
 * current window, accounting for the camera tilt and screen shape.
 */
export function frameMaze(context: SceneContext, widthTiles: number, heightTiles: number): void {
  const { camera, engine } = context;
  const width = widthTiles * TILE_SIZE;
  const depth = heightTiles * TILE_SIZE;
  const aspect = Math.max(engine.getAspectRatio(camera), 0.1);

  const halfFovV = camera.fov / 2;
  const halfFovH = Math.atan(Math.tan(halfFovV) * aspect);

  // The tilted maze appears shorter vertically (foreshortened) and has its
  // own height to clear; take the larger of the two fits.
  const visibleDepth = depth * Math.sin(CAMERA_ELEVATION) + 1.5 * Math.cos(CAMERA_ELEVATION);
  const distanceForDepth = visibleDepth / 2 / Math.tan(halfFovV);
  const distanceForWidth = width / 2 / Math.tan(halfFovH);
  const distance = Math.max(distanceForDepth, distanceForWidth) * FRAME_MARGIN;

  camera.position.set(
    0,
    distance * Math.sin(CAMERA_ELEVATION),
    -distance * Math.cos(CAMERA_ELEVATION),
  );
  camera.setTarget(Vector3.Zero());
}

/** Applies a level's background color to the scene. */
export function applySceneTheme(context: SceneContext, theme: ThemePalette): void {
  context.scene.clearColor = color3(theme.background).toColor4(1);
}

/** Resizes the render target to the window and re-frames the maze. */
export function resizeSceneContext(
  context: SceneContext,
  widthTiles: number,
  heightTiles: number,
): void {
  context.engine.resize();
  frameMaze(context, widthTiles, heightTiles);
}

/** Releases every GPU resource owned by the scene and engine. */
export function disposeSceneContext(context: SceneContext): void {
  context.scene.dispose();
  context.engine.dispose();
}
