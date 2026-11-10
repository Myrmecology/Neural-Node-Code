/**
 * Neural Node & Code - Monitor model
 *
 * A hovering CRT monitor built from code, with a live face drawn on its
 * screen:
 * - normal:     angry eyes whose pupils look in the direction of travel
 * - frightened: blue screen with a worried face
 * - warning:    flashes white as frightened mode runs out
 * - returning:  the casing disappears; only the glowing screen eyes remain
 *
 * The screen always faces the camera (the camera looks toward +Z), so faces
 * stay readable; the body leans toward its direction of travel instead of
 * turning. Faces redraw only when their appearance actually changes.
 */
import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Texture,
  TransformNode,
} from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { isBlinkOn } from '../rendering/Effects';
import { color3 } from '../rendering/SceneSetup';
import { MONITOR_BODY, MONITOR_COLORS } from '../rendering/Themes';
import type { HexColor } from '../rendering/Themes';
import { MonitorMode } from '../types';
import type { MonitorId } from '../types';
import { Direction, directionVector } from '../utils/Direction';
import type { MoveDirection } from '../utils/Direction';
import { damp } from '../utils/MathUtils';

const SCREEN_PIXELS_WIDE = 128;
const SCREEN_PIXELS_TALL = 96;
const HOVER_HEIGHT = 0.5;
const HOVER_BOB = 0.04;
const LEAN = 0.18;

type FaceStyle = 'normal' | 'frightened' | 'flash' | 'returning';

export interface MonitorPose {
  readonly x: number;
  readonly z: number;
  readonly mode: MonitorMode;
  readonly facing: MoveDirection;
  readonly time: number;
  /** Seconds of invincibility left (0 when not frightened). */
  readonly frightenedRemaining: number;
  /** Seconds before the end of invincibility when flashing begins. */
  readonly frightenedWarning: number;
}

export class MonitorModel {
  readonly root: TransformNode;

  private readonly body: TransformNode;
  private readonly casingParts: Mesh[] = [];
  private readonly thruster: Mesh;
  private readonly screenTexture: DynamicTexture;
  private readonly materials: StandardMaterial[] = [];
  private readonly color: HexColor;
  private readonly hoverPhase: number;

  private leanX = 0;
  private leanZ = 0;
  private faceKey = '';

  constructor(scene: Scene, id: MonitorId, slot: number) {
    this.color = MONITOR_COLORS[id];
    this.hoverPhase = slot * 1.7;

    this.root = new TransformNode(`monitor-${id}`, scene);
    this.body = new TransformNode(`monitor-${id}-body`, scene);
    this.body.parent = this.root;

    // ---- Materials ------------------------------------------------------------
    const casing = new StandardMaterial(`monitor-${id}-casing`, scene);
    casing.diffuseColor = color3(MONITOR_BODY.casing);
    casing.specularColor = new Color3(0.2, 0.2, 0.2);

    const casingDark = new StandardMaterial(`monitor-${id}-casing-dark`, scene);
    casingDark.diffuseColor = color3(MONITOR_BODY.casingDark);
    casingDark.specularColor = new Color3(0.1, 0.1, 0.1);

    const bezel = new StandardMaterial(`monitor-${id}-bezel`, scene);
    bezel.diffuseColor = color3(MONITOR_BODY.bezel);
    bezel.specularColor = Color3.Black();

    this.screenTexture = new DynamicTexture(
      `monitor-${id}-screen-texture`,
      { width: SCREEN_PIXELS_WIDE, height: SCREEN_PIXELS_TALL },
      scene,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    const screen = new StandardMaterial(`monitor-${id}-screen`, scene);
    screen.disableLighting = true;
    screen.diffuseColor = Color3.Black();
    screen.emissiveTexture = this.screenTexture;

    const thrusterMaterial = new StandardMaterial(`monitor-${id}-thruster`, scene);
    thrusterMaterial.disableLighting = true;
    thrusterMaterial.emissiveColor = color3(this.color);

    this.materials.push(casing, casingDark, bezel, screen, thrusterMaterial);

    // ---- Geometry (front of the screen faces the camera, toward -Z) ----------
    const front = MeshBuilder.CreateBox(
      `monitor-${id}-front`,
      { width: 0.5, height: 0.42, depth: 0.3 },
      scene,
    );
    front.material = casing;
    front.parent = this.body;

    const back = MeshBuilder.CreateBox(
      `monitor-${id}-back`,
      { width: 0.36, height: 0.3, depth: 0.2 },
      scene,
    );
    back.material = casingDark;
    back.parent = this.body;
    back.position.z = 0.24;

    const frame = MeshBuilder.CreateBox(
      `monitor-${id}-bezel`,
      { width: 0.44, height: 0.35, depth: 0.02 },
      scene,
    );
    frame.material = bezel;
    frame.parent = this.body;
    frame.position.z = -0.155;

    const glass = MeshBuilder.CreatePlane(
      `monitor-${id}-screen`,
      { width: 0.4, height: 0.3 },
      scene,
    );
    glass.material = screen;
    glass.parent = this.body;
    glass.position.z = -0.167;

    const led = MeshBuilder.CreateBox(
      `monitor-${id}-led`,
      { width: 0.03, height: 0.015, depth: 0.01 },
      scene,
    );
    led.material = thrusterMaterial;
    led.parent = this.body;
    led.position.set(0.17, -0.185, -0.152);

    this.casingParts.push(front, back, frame, led);

    this.thruster = MeshBuilder.CreateTorus(
      `monitor-${id}-thruster`,
      { diameter: 0.34, thickness: 0.03, tessellation: 32 },
      scene,
    );
    this.thruster.material = thrusterMaterial;
    this.thruster.parent = this.root;
    this.thruster.position.y = 0.05;

    for (const mesh of [front, back, frame, glass, led, this.thruster]) {
      mesh.isPickable = false;
    }

    this.drawFace('normal', Direction.Down);
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  /** Moves, hovers, leans, and refreshes the screen face. Call every frame. */
  update(dt: number, pose: MonitorPose): void {
    this.root.position.set(pose.x, 0, pose.z);

    const style = this.faceStyle(pose);
    const returning = style === 'returning';
    for (const part of this.casingParts) {
      part.setEnabled(!returning);
    }
    this.thruster.setEnabled(!returning && pose.mode !== MonitorMode.House);

    // Hover and lean toward the direction of travel.
    const step = directionVector(pose.facing);
    this.leanX = damp(this.leanX, step.row * LEAN, 8, dt);
    this.leanZ = damp(this.leanZ, step.col * LEAN, 8, dt);
    this.body.rotation.x = this.leanX;
    this.body.rotation.z = -this.leanZ;
    this.body.position.y = HOVER_HEIGHT + Math.sin(pose.time * 3 + this.hoverPhase) * HOVER_BOB;

    const pulseScale = 1 + Math.sin(pose.time * 8 + this.hoverPhase) * 0.08;
    this.thruster.scaling.set(pulseScale, 1, pulseScale);

    const key = `${style}:${pose.facing}`;
    if (key !== this.faceKey) {
      this.drawFace(style, pose.facing);
    }
  }

  dispose(): void {
    this.root.dispose(false, false);
    this.screenTexture.dispose();
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
  }

  // ---------------------------------------------------------------------------
  //  Screen faces
  // ---------------------------------------------------------------------------

  private faceStyle(pose: MonitorPose): FaceStyle {
    switch (pose.mode) {
      case MonitorMode.Frightened: {
        const warning =
          pose.frightenedRemaining <= pose.frightenedWarning && isBlinkOn(pose.time, 4);
        return warning ? 'flash' : 'frightened';
      }
      case MonitorMode.Returning:
      case MonitorMode.Entering:
        return 'returning';
      case MonitorMode.House:
      case MonitorMode.Leaving:
      case MonitorMode.Scatter:
      case MonitorMode.Chase:
        return 'normal';
    }
  }

  private drawFace(style: FaceStyle, facing: MoveDirection): void {
    this.faceKey = `${style}:${facing}`;
    const ctx = this.screenTexture.getContext();
    const w = SCREEN_PIXELS_WIDE;
    const h = SCREEN_PIXELS_TALL;
    const look = directionVector(facing);
    const lookX = look.col * 6;
    const lookY = look.row * 5;

    switch (style) {
      case 'normal': {
        ctx.fillStyle = '#05080a';
        ctx.fillRect(0, 0, w, h);
        // Angry brows.
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(22, 22);
        ctx.lineTo(54, 34);
        ctx.moveTo(106, 22);
        ctx.lineTo(74, 34);
        ctx.stroke();
        // Eyes with pupils looking toward the direction of travel.
        this.drawEye(ctx, 40, 50, '#f2f2f2', this.color, lookX, lookY);
        this.drawEye(ctx, 88, 50, '#f2f2f2', this.color, lookX, lookY);
        // Jagged mouth.
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(34, 80);
        for (let i = 1; i <= 6; i += 1) {
          ctx.lineTo(34 + i * 10, i % 2 === 0 ? 80 : 72);
        }
        ctx.stroke();
        break;
      }
      case 'frightened':
      case 'flash': {
        const background =
          style === 'flash' ? MONITOR_BODY.frightenedFlash : MONITOR_BODY.frightened;
        const ink = style === 'flash' ? MONITOR_BODY.frightened : MONITOR_BODY.frightenedFlash;
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = ink;
        ctx.fillRect(34, 32, 12, 12);
        ctx.fillRect(82, 32, 12, 12);
        // Worried wavy mouth.
        ctx.strokeStyle = ink;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(30, 74);
        for (let i = 1; i <= 8; i += 1) {
          ctx.lineTo(30 + i * 8.5, i % 2 === 0 ? 74 : 66);
        }
        ctx.stroke();
        break;
      }
      case 'returning': {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        this.drawEye(ctx, 40, 48, MONITOR_BODY.returning, '#ffffff', lookX, lookY);
        this.drawEye(ctx, 88, 48, MONITOR_BODY.returning, '#ffffff', lookX, lookY);
        break;
      }
    }

    // CRT scanlines over every face.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
    this.screenTexture.update();
  }

  private drawEye(
    ctx: ReturnType<DynamicTexture['getContext']>,
    cx: number,
    cy: number,
    white: string,
    pupil: string,
    lookX: number,
    lookY: number,
  ): void {
    ctx.fillStyle = white;
    ctx.fillRect(cx - 14, cy - 12, 28, 24);
    ctx.fillStyle = pupil;
    ctx.fillRect(cx - 6 + lookX, cy - 6 + lookY, 12, 12);
  }
}
