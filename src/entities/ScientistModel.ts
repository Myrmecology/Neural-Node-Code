/**
 * Neural Node & Code - Scientist model
 *
 * The playable scientist, built entirely from code (no model files), with a
 * procedural walk cycle:
 * - hips swing the thighs; knees bend only during the forward swing
 * - arms swing opposite the legs, with a slight elbow bend
 * - the body bobs once per footstep and leans into movement
 * - the stride advances by distance traveled, so feet never slide
 *
 * Facing convention: rotation.y = 0 faces +Z (up on the grid).
 * Joint convention: positive rotation.x swings a hanging limb backward.
 */
import { Color3, MeshBuilder, StandardMaterial, TransformNode } from '@babylonjs/core';
import type { Mesh, Scene } from '@babylonjs/core';
import { color3 } from '../rendering/SceneSetup';
import { SCIENTIST_COLORS } from '../rendering/Themes';
import type { HexColor } from '../rendering/Themes';
import { TAU, clamp01, damp, dampAngle, easeInCubic, pulse } from '../utils/MathUtils';

/** World distance covered by one full stride cycle (two steps). */
const STRIDE_LENGTH = 0.95;
const HIP_SWING = 0.75;
const KNEE_BEND = 1.1;
const ARM_SWING = 0.65;
const ELBOW_BEND = 0.35;
const STEP_BOB = 0.035;
const RUN_LEAN = 0.16;
const TURN_RATE = 18;

export interface ScientistPose {
  /** True while the scientist is actually moving. */
  readonly moving: boolean;
  /** Current movement speed, in world units per second. */
  readonly speed: number;
  /** Facing angle (radians) to turn toward. */
  readonly yaw: number;
  /** True while invincible. */
  readonly powered: boolean;
  /** Game time in seconds, for idle breathing and the power aura. */
  readonly time: number;
}

interface Limb {
  /** Pivot at the hip or shoulder. */
  readonly upper: TransformNode;
  /** Pivot at the knee or elbow. */
  readonly lower: TransformNode;
}

export class ScientistModel {
  readonly root: TransformNode;

  private readonly scene: Scene;
  private readonly body: TransformNode;
  private readonly coatTail: TransformNode;
  private readonly head: TransformNode;
  private readonly leftLeg: Limb;
  private readonly rightLeg: Limb;
  private readonly leftArm: Limb;
  private readonly rightArm: Limb;
  private readonly aura: Mesh;
  private readonly auraMaterial: StandardMaterial;
  private readonly materials: StandardMaterial[] = [];

  private phase = 0;
  private walkBlend = 0;
  private yaw = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('scientist', scene);
    this.body = new TransformNode('scientist-body', scene);
    this.body.parent = this.root;

    const coat = this.material('lab-coat', SCIENTIST_COLORS.labCoat);
    const shirt = this.material('shirt', SCIENTIST_COLORS.shirt);
    const trousers = this.material('trousers', SCIENTIST_COLORS.trousers);
    const shoes = this.material('shoes', SCIENTIST_COLORS.shoes);
    const skin = this.material('skin', SCIENTIST_COLORS.skin);
    const hair = this.material('hair', SCIENTIST_COLORS.hair);
    const goggles = this.material('goggles', SCIENTIST_COLORS.goggles, true);

    // ---- Shadow blob grounds him on the floor ---------------------------------
    const shadowMaterial = new StandardMaterial('scientist-shadow', scene);
    shadowMaterial.diffuseColor = Color3.Black();
    shadowMaterial.specularColor = Color3.Black();
    shadowMaterial.disableLighting = true;
    shadowMaterial.alpha = 0.45;
    this.materials.push(shadowMaterial);
    const shadow = MeshBuilder.CreateDisc(
      'scientist-shadow',
      { radius: 0.22, tessellation: 24 },
      scene,
    );
    shadow.material = shadowMaterial;
    shadow.rotation.x = Math.PI / 2;
    shadow.position.y = 0.004;
    shadow.parent = this.root;
    shadow.isPickable = false;

    // ---- Torso ----------------------------------------------------------------
    this.box('pelvis', { width: 0.2, height: 0.08, depth: 0.13 }, trousers, this.body, 0, 0.33, 0);
    this.box('torso', { width: 0.27, height: 0.29, depth: 0.16 }, coat, this.body, 0, 0.5, 0);
    this.box(
      'shirt-front',
      { width: 0.08, height: 0.22, depth: 0.02 },
      shirt,
      this.body,
      0,
      0.53,
      0.08,
    );

    this.coatTail = new TransformNode('coat-tail', scene);
    this.coatTail.parent = this.body;
    this.coatTail.position.set(0, 0.36, 0);
    this.box(
      'coat-tail-mesh',
      { width: 0.28, height: 0.13, depth: 0.17 },
      coat,
      this.coatTail,
      0,
      -0.06,
      0,
    );

    // ---- Head -----------------------------------------------------------------
    this.head = new TransformNode('head', scene);
    this.head.parent = this.body;
    this.head.position.set(0, 0.72, 0);
    this.box('neck', { width: 0.07, height: 0.06, depth: 0.07 }, skin, this.head, 0, -0.07, 0);
    this.sphere('skull', 0.19, skin, this.head, 0, 0.02, 0);
    const hairCap = this.sphere('hair', 0.2, hair, this.head, 0, 0.06, -0.015);
    hairCap.scaling.set(1, 0.65, 1.02);
    this.box('goggle-band', { width: 0.2, height: 0.035, depth: 0.2 }, hair, this.head, 0, 0.03, 0);
    this.box(
      'goggle-left',
      { width: 0.055, height: 0.045, depth: 0.03 },
      goggles,
      this.head,
      -0.045,
      0.03,
      0.095,
    );
    this.box(
      'goggle-right',
      { width: 0.055, height: 0.045, depth: 0.03 },
      goggles,
      this.head,
      0.045,
      0.03,
      0.095,
    );

    // ---- Limbs ----------------------------------------------------------------
    this.leftLeg = this.limb('left-leg', -0.065, 0.31, 0.09, 0.15, 0.14, trousers, shoes, true);
    this.rightLeg = this.limb('right-leg', 0.065, 0.31, 0.09, 0.15, 0.14, trousers, shoes, true);
    this.leftArm = this.limb('left-arm', -0.175, 0.62, 0.065, 0.15, 0.14, coat, skin, false);
    this.rightArm = this.limb('right-arm', 0.175, 0.62, 0.065, 0.15, 0.14, coat, skin, false);

    // ---- Power aura -----------------------------------------------------------
    this.auraMaterial = new StandardMaterial('scientist-aura', scene);
    this.auraMaterial.disableLighting = true;
    this.auraMaterial.emissiveColor = color3(SCIENTIST_COLORS.powerGlow);
    this.materials.push(this.auraMaterial);
    this.aura = MeshBuilder.CreateTorus(
      'scientist-aura',
      { diameter: 0.62, thickness: 0.035, tessellation: 40 },
      scene,
    );
    this.aura.material = this.auraMaterial;
    this.aura.parent = this.root;
    this.aura.position.y = 0.03;
    this.aura.isPickable = false;
    this.aura.setEnabled(false);
  }

  /** Places the scientist on the floor at a world position. */
  setPosition(x: number, z: number): void {
    this.root.position.set(x, 0, z);
  }

  /** Snaps to a facing angle instantly (for spawning). */
  setYaw(yaw: number): void {
    this.yaw = yaw;
    this.root.rotation.y = yaw;
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  /** Animates walking, idling, turning, and the power aura. */
  update(dt: number, pose: ScientistPose): void {
    this.yaw = dampAngle(this.yaw, pose.yaw, TURN_RATE, dt);
    this.root.rotation.y = this.yaw;

    this.walkBlend = damp(this.walkBlend, pose.moving ? 1 : 0, 10, dt);
    if (pose.moving) {
      this.phase = (this.phase + (pose.speed * dt * TAU) / STRIDE_LENGTH) % TAU;
    }

    this.applyPose(this.phase, this.walkBlend, pose.time);

    this.aura.setEnabled(pose.powered);
    if (pose.powered) {
      const glow = pulse(pose.time, 0.5);
      const scale = 1 + glow * 0.18;
      this.aura.scaling.set(scale, 1, scale);
      this.auraMaterial.emissiveColor = color3(SCIENTIST_COLORS.powerGlow).scale(0.6 + glow * 0.4);
    }
  }

  /**
   * Poses the caught animation: he spins faster and faster, then collapses.
   * @param progress 0 at the moment of capture, 1 when the animation ends
   */
  poseCaught(progress: number): void {
    const p = clamp01(progress);
    this.aura.setEnabled(false);
    this.applyPose(this.phase, 0, 0);
    this.body.rotation.y = easeInCubic(p) * TAU * 4;
    const shrink = 1 - easeInCubic(Math.max(0, (p - 0.45) / 0.55));
    this.body.scaling.set(shrink, shrink, shrink);
    this.body.position.y = Math.sin(p * Math.PI) * 0.12;
  }

  /** Restores the standing pose for a new life or level. */
  reset(yaw: number): void {
    this.phase = 0;
    this.walkBlend = 0;
    this.body.rotation.set(0, 0, 0);
    this.body.scaling.set(1, 1, 1);
    this.body.position.set(0, 0, 0);
    this.aura.setEnabled(false);
    this.setYaw(yaw);
    this.applyPose(0, 0, 0);
  }

  dispose(): void {
    this.root.dispose(false, false);
    for (const material of this.materials) {
      material.dispose();
    }
    this.materials.length = 0;
  }

  // ---------------------------------------------------------------------------
  //  Posing
  // ---------------------------------------------------------------------------

  private applyPose(phase: number, walk: number, time: number): void {
    const swing = Math.sin(phase);
    // Knees bend only while each leg swings forward.
    const leftKnee = Math.max(0, -Math.cos(phase)) * KNEE_BEND;
    const rightKnee = Math.max(0, Math.cos(phase)) * KNEE_BEND;

    this.leftLeg.upper.rotation.x = -swing * HIP_SWING * walk;
    this.leftLeg.lower.rotation.x = leftKnee * walk;
    this.rightLeg.upper.rotation.x = swing * HIP_SWING * walk;
    this.rightLeg.lower.rotation.x = rightKnee * walk;

    this.leftArm.upper.rotation.x = swing * ARM_SWING * walk;
    this.leftArm.lower.rotation.x = -ELBOW_BEND * (0.4 + 0.6 * walk);
    this.rightArm.upper.rotation.x = -swing * ARM_SWING * walk;
    this.rightArm.lower.rotation.x = -ELBOW_BEND * (0.4 + 0.6 * walk);

    // Bob once per footstep, lean into the stride, breathe when idle.
    const breathe = Math.sin(time * 2.2) * 0.008 * (1 - walk);
    this.body.position.y = Math.abs(Math.sin(phase)) * STEP_BOB * walk + breathe;
    this.body.rotation.x = -RUN_LEAN * walk;
    this.coatTail.rotation.x = (0.25 + Math.sin(phase * 2) * 0.08) * walk;
    this.head.rotation.x = RUN_LEAN * 0.6 * walk;
  }

  // ---------------------------------------------------------------------------
  //  Construction helpers
  // ---------------------------------------------------------------------------

  private material(name: string, hex: HexColor, glows = false): StandardMaterial {
    const material = new StandardMaterial(`scientist-${name}`, this.scene);
    material.diffuseColor = color3(hex);
    material.specularColor = new Color3(0.08, 0.08, 0.08);
    if (glows) {
      material.emissiveColor = color3(hex);
    }
    this.materials.push(material);
    return material;
  }

  private box(
    name: string,
    size: { width: number; height: number; depth: number },
    material: StandardMaterial,
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(`scientist-${name}`, size, this.scene);
    mesh.material = material;
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    return mesh;
  }

  private sphere(
    name: string,
    diameter: number,
    material: StandardMaterial,
    parent: TransformNode,
    x: number,
    y: number,
    z: number,
  ): Mesh {
    const mesh = MeshBuilder.CreateSphere(
      `scientist-${name}`,
      { diameter, segments: 12 },
      this.scene,
    );
    mesh.material = material;
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.isPickable = false;
    return mesh;
  }

  /** Builds a two-segment limb hanging down from a pivot (hip or shoulder). */
  private limb(
    name: string,
    x: number,
    y: number,
    thickness: number,
    upperLength: number,
    lowerLength: number,
    upperMaterial: StandardMaterial,
    endMaterial: StandardMaterial,
    isLeg: boolean,
  ): Limb {
    const upper = new TransformNode(`${name}-upper`, this.scene);
    upper.parent = this.body;
    upper.position.set(x, y, 0);
    this.box(
      `${name}-upper-mesh`,
      { width: thickness, height: upperLength, depth: thickness },
      upperMaterial,
      upper,
      0,
      -upperLength / 2,
      0,
    );

    const lower = new TransformNode(`${name}-lower`, this.scene);
    lower.parent = upper;
    lower.position.set(0, -upperLength, 0);

    if (isLeg) {
      this.box(
        `${name}-shin`,
        { width: thickness * 0.9, height: lowerLength, depth: thickness * 0.9 },
        upperMaterial,
        lower,
        0,
        -lowerLength / 2,
        0,
      );
      this.box(
        `${name}-shoe`,
        { width: thickness * 1.05, height: 0.035, depth: thickness * 1.6 },
        endMaterial,
        lower,
        0,
        -lowerLength - 0.005,
        thickness * 0.3,
      );
    } else {
      this.box(
        `${name}-forearm`,
        { width: thickness * 0.9, height: lowerLength, depth: thickness * 0.9 },
        upperMaterial,
        lower,
        0,
        -lowerLength / 2,
        0,
      );
      this.sphere(`${name}-hand`, thickness * 0.95, endMaterial, lower, 0, -lowerLength - 0.02, 0);
    }

    return { upper, lower };
  }
}
