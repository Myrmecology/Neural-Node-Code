/**
 * Neural Node & Code - Game
 *
 * Connects every system and runs the game flow:
 *
 *   title -> levelIntro -> playing -> levelComplete -> (cutscene) -> levelIntro ...
 *                            |  ^
 *                            v  |
 *                           paused
 *            playing -> dying -> levelIntro (respawn) or gameOver -> title
 *
 * Simulation runs in fixed steps (GameLoop.update); visuals are refreshed once
 * per display frame (GameLoop.render) with interpolation for smooth motion.
 */
import { Matrix, Vector3 } from '@babylonjs/core';
import type { Monitor } from '../entities/Monitor';
import type { MonitorWorld } from '../ai/MonitorAI';
import { ModeScheduler } from '../ai/ModeScheduler';
import { AudioEngine } from '../audio/AudioEngine';
import { SoundEffects } from '../audio/SoundEffects';
import { createChaseCutscene } from '../cutscenes/ChaseCutscene';
import type { Cutscene } from '../cutscenes/ChaseCutscene';
import { createReversalCutscene } from '../cutscenes/ReversalCutscene';
import { DataNodeField } from '../entities/DataNodeField';
import { createMonitors } from '../entities/Monitor';
import { Scientist } from '../entities/Scientist';
import { ScientistModel } from '../entities/ScientistModel';
import { InputAction, InputManager } from '../input/InputManager';
import { MazeRenderer } from '../maze/MazeRenderer';
import { CameraShake, PulseField } from '../rendering/Effects';
import { ParticleSystem } from '../rendering/Particles';
import {
  applySceneTheme,
  createSceneContext,
  disposeSceneContext,
  frameMaze,
} from '../rendering/SceneSetup';
import type { SceneContext } from '../rendering/SceneSetup';
import { MONITOR_COLORS, getTheme } from '../rendering/Themes';
import { checkCollisions } from '../systems/CollisionSystem';
import { LevelManager } from '../systems/LevelManager';
import type { CutsceneId, LevelInfo } from '../systems/LevelManager';
import { PowerSystem } from '../systems/PowerSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { GameState, MonitorId, Pickup } from '../types';
import type { HudSnapshot } from '../types';
import { Hud } from '../ui/Hud';
import { Screens } from '../ui/Screens';
import { TitleScreen } from '../ui/TitleScreen';
import { gridToWorld } from '../utils/Grid';
import type { GridPoint } from '../utils/Grid';
import { clamp01 } from '../utils/MathUtils';
import { SCORING, TILE_SIZE, TIMING } from './Config';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { StateMachine } from './StateMachine';

/** Which states may follow each state. Anything else throws immediately. */
const TRANSITIONS: Readonly<Record<GameState, readonly GameState[]>> = {
  [GameState.Title]: [GameState.LevelIntro],
  [GameState.LevelIntro]: [GameState.Playing],
  [GameState.Playing]: [GameState.Paused, GameState.Dying, GameState.LevelComplete],
  [GameState.Paused]: [GameState.Playing],
  [GameState.Dying]: [GameState.LevelIntro, GameState.GameOver],
  [GameState.LevelComplete]: [GameState.Cutscene, GameState.LevelIntro],
  [GameState.Cutscene]: [GameState.LevelIntro],
  [GameState.GameOver]: [GameState.Title],
};

/** Respawn intros are shorter than new-level intros (no maze assembly). */
const RESPAWN_INTRO = 1.8;
/** Seconds before the game over screen accepts input. */
const GAME_OVER_INPUT_DELAY = 1.2;
/** Seconds after a node during which the next node continues the chime chain. */
const NODE_CHAIN_WINDOW = 0.45;
/** Distance per footstep sound (half of the model's stride). */
const FOOTSTEP_DISTANCE = 0.475;
/** When the maze finishes rising during the intro, nodes pop in over this time. */
const NODE_REVEAL_START = 1.5;
const NODE_REVEAL_TIME = 0.5;

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly events = new EventBus();
  private readonly listeners = new AbortController();
  private readonly context: SceneContext;
  private readonly loop: GameLoop;
  private readonly machine: StateMachine<GameState>;
  private readonly input: InputManager;

  private readonly audio = new AudioEngine();
  private readonly sfx: SoundEffects;
  private readonly score: ScoreSystem;
  private readonly power: PowerSystem;
  private readonly levels = new LevelManager();

  private readonly mazeRenderer: MazeRenderer;
  private readonly nodeField: DataNodeField;
  private readonly particles: ParticleSystem;
  private readonly pulse = new PulseField();
  private readonly shake = new CameraShake();
  private readonly cameraBase = new Vector3();

  private readonly scheduler: ModeScheduler;
  private readonly scientist: Scientist;
  private readonly scientistModel: ScientistModel;
  private readonly monitors: Monitor[];
  private readonly virus: Monitor;

  private readonly titleScreen: TitleScreen;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly cutscenes: Readonly<Record<CutsceneId, Cutscene>>;
  private activeCutscene: Cutscene | null = null;

  private level: LevelInfo;
  private time = 0;
  private introAssembles = true;
  private freezeTimer = 0;
  private nodeChain = 0;
  private nodeChainTimer = 0;
  private footstepDistance = 0;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.canvas = canvas;
    this.context = createSceneContext(canvas);
    const { scene, glow, camera } = this.context;

    this.input = new InputManager();
    this.sfx = new SoundEffects(this.audio, this.events);
    this.score = new ScoreSystem(this.events);
    this.power = new PowerSystem(this.events);

    this.level = this.levels.current;
    const { maze, difficulty } = this.level;

    this.mazeRenderer = new MazeRenderer(scene, glow);
    this.nodeField = new DataNodeField(scene);
    this.particles = new ParticleSystem(scene, glow);

    this.scheduler = new ModeScheduler(difficulty.modeSchedule);
    this.scientist = new Scientist(maze);
    this.scientistModel = new ScientistModel(scene);
    this.monitors = createMonitors(scene, maze, difficulty);
    const virus = this.monitors.find((monitor) => monitor.id === MonitorId.Virus);
    if (virus === undefined) {
      throw new Error('Game: the Virus monitor is missing.');
    }
    this.virus = virus;

    this.titleScreen = new TitleScreen(uiRoot);
    this.hud = new Hud(uiRoot, this.events);
    this.screens = new Screens(uiRoot);
    this.cutscenes = {
      chase: createChaseCutscene(scene, camera),
      reversal: createReversalCutscene(scene, camera),
    };

    this.machine = new StateMachine<GameState>({
      initial: GameState.Title,
      transitions: TRANSITIONS,
      onChange: (from, to) => {
        this.events.emit('stateChanged', { from, to });
      },
    });
    this.registerStates();

    this.loop = new GameLoop({
      update: (dt) => {
        this.update(dt);
      },
      render: (alpha, frameTime) => {
        this.render(alpha, frameTime);
      },
    });

    this.loadLevel(this.level);
    this.attachWindowListeners();
  }

  /** Starts the state machine and the render loop. */
  start(): void {
    this.machine.start();
    this.loop.start();
    this.context.engine.runRenderLoop(() => {
      this.loop.frame(performance.now());
    });
  }

  /** Unlocks audio. Call from the first key press or click (browser requirement). */
  unlockAudio(): void {
    this.audio.unlock();
  }

  /** Stops the game and releases every resource. */
  dispose(): void {
    this.loop.stop();
    this.context.engine.stopRenderLoop();
    this.listeners.abort();
    this.input.dispose();
    this.sfx.dispose();
    this.titleScreen.dispose();
    this.hud.dispose();
    this.screens.dispose();
    this.cutscenes.chase.dispose();
    this.cutscenes.reversal.dispose();
    for (const monitor of this.monitors) {
      monitor.dispose();
    }
    this.scientistModel.dispose();
    this.particles.dispose();
    this.nodeField.dispose();
    this.mazeRenderer.dispose();
    this.events.clear();
    disposeSceneContext(this.context);
  }

  // ===========================================================================
  //  State flow
  // ===========================================================================

  private registerStates(): void {
    const m = this.machine;

    m.register(GameState.Title, {
      enter: () => {
        this.hud.hide();
        this.screens.hideAll();
        this.titleScreen.show(this.score.highScore);
      },
      update: () => {
        if (this.input.wasPressed(InputAction.Confirm)) {
          this.sfx.menuConfirm();
          this.titleScreen.hide();
          this.score.reset();
          this.loadLevel(this.levels.start());
          this.introAssembles = true;
          m.transition(GameState.LevelIntro);
        }
      },
    });

    m.register(GameState.LevelIntro, {
      enter: () => {
        this.resetActors();
        this.hud.show(this.hudSnapshot());
        if (this.introAssembles) {
          this.mazeRenderer.startAssembly();
          this.nodeField.setReveal(0);
          this.screens.showMessage(
            `LEVEL ${this.level.displayNumber}`,
            this.level.definition.name.toUpperCase(),
          );
          this.events.emit('levelStarted', {
            level: this.level.displayNumber,
            loop: this.level.loop,
            name: this.level.definition.name,
          });
        } else {
          this.screens.showMessage('READY!');
        }
      },
      update: () => {
        const t = m.timeInState;
        const duration = this.introAssembles ? TIMING.levelIntro : RESPAWN_INTRO;
        if (this.introAssembles) {
          this.nodeField.setReveal((t - NODE_REVEAL_START) / NODE_REVEAL_TIME);
          if (t >= duration * 0.6) {
            this.screens.showMessage('READY!');
          }
        }
        if (t >= duration) {
          this.nodeField.setReveal(1);
          this.introAssembles = false;
          m.transition(GameState.Playing);
        }
      },
      exit: () => {
        this.screens.hideMessage();
      },
    });

    m.register(GameState.Playing, {
      update: (dt) => {
        if (this.input.wasPressed(InputAction.Pause)) {
          m.transition(GameState.Paused);
          return;
        }
        this.updatePlaying(dt);
      },
    });

    m.register(GameState.Paused, {
      enter: () => {
        this.screens.showPause();
        this.audio.suspend();
      },
      update: () => {
        if (
          this.input.wasPressed(InputAction.Pause) ||
          this.input.wasPressed(InputAction.Confirm)
        ) {
          m.transition(GameState.Playing);
        }
      },
      exit: () => {
        this.screens.hidePause();
        this.audio.resume();
        this.sfx.pauseToggle(false);
        this.loop.resetClock();
      },
    });

    m.register(GameState.Dying, {
      enter: () => {
        this.setMonitorsVisible(false);
        const position = this.scientistWorld();
        this.particles.scientistCaught(position.x, position.z);
        this.shake.add(0.7);
        this.power.reset();
      },
      update: () => {
        const t = m.timeInState;
        this.scientistModel.poseCaught(t / TIMING.dying);
        if (t >= TIMING.dying) {
          const livesLeft = this.score.loseLife();
          if (livesLeft > 0) {
            this.introAssembles = false;
            m.transition(GameState.LevelIntro);
          } else {
            m.transition(GameState.GameOver);
          }
        }
      },
    });

    m.register(GameState.LevelComplete, {
      enter: () => {
        this.power.reset();
        this.setMonitorsVisible(false);
        this.mazeRenderer.setFlashing(true);
        this.screens.showMessage('SYSTEM CLEAR');
        this.events.emit('levelCompleted', { level: this.level.displayNumber });
      },
      update: () => {
        if (m.timeInState < TIMING.levelComplete) {
          return;
        }
        this.mazeRenderer.setFlashing(false);
        this.screens.hideMessage();
        const { next, cutscene } = this.levels.advance();
        this.level = next;
        if (cutscene !== null) {
          this.activeCutscene = this.cutscenes[cutscene];
          m.transition(GameState.Cutscene);
        } else {
          this.loadLevel(next);
          this.introAssembles = true;
          m.transition(GameState.LevelIntro);
        }
      },
    });

    m.register(GameState.Cutscene, {
      enter: () => {
        this.scientistModel.setVisible(false);
        this.setMonitorsVisible(false);
        this.shake.reset();
        this.activeCutscene?.start();
        if (this.activeCutscene !== null) {
          this.screens.showMessage(this.activeCutscene.caption, this.activeCutscene.subtitle);
        }
        this.sfx.cutsceneTheme();
      },
      update: (dt) => {
        const cutscene = this.activeCutscene;
        const skipped = this.input.wasPressed(InputAction.Confirm);
        const finished = cutscene === null || cutscene.update(dt, this.time);
        if (finished || skipped) {
          this.activeCutscene = null;
          this.screens.hideMessage();
          this.loadLevel(this.level);
          this.introAssembles = true;
          m.transition(GameState.LevelIntro);
        }
      },
    });

    m.register(GameState.GameOver, {
      enter: () => {
        this.score.persist();
        this.events.emit('gameOver', {
          score: this.score.score,
          isHighScore: this.score.isNewHighScore,
        });
        this.screens.showGameOver(this.score.score, this.score.isNewHighScore);
      },
      update: () => {
        if (m.timeInState >= GAME_OVER_INPUT_DELAY && this.input.wasPressed(InputAction.Confirm)) {
          this.sfx.menuConfirm();
          m.transition(GameState.Title);
        }
      },
    });
  }

  // ===========================================================================
  //  Simulation (fixed steps)
  // ===========================================================================

  private update(dt: number): void {
    this.input.update(dt);
    if (this.input.wasPressed(InputAction.Mute)) {
      this.audio.toggleMute();
    }
    if (!this.machine.is(GameState.Paused)) {
      this.time += dt;
    }
    this.machine.update(dt);
    this.input.endUpdate();
  }

  /** One step of active gameplay. */
  private updatePlaying(dt: number): void {
    // Brief freeze after catching a monitor, so the moment lands.
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      return;
    }

    const { maze, difficulty } = this.level;
    const speed = this.power.active ? difficulty.scientistPowerSpeed : difficulty.scientistSpeed;

    // ---- Scientist --------------------------------------------------------------
    const arrivals = this.scientist.update(dt, this.input.direction, speed);
    for (const tile of arrivals) {
      this.collect(tile);
    }
    if (maze.remainingPickups === 0) {
      this.machine.transition(GameState.LevelComplete);
      return;
    }

    if (this.scientist.isMoving) {
      this.footstepDistance += speed * dt;
      while (this.footstepDistance >= FOOTSTEP_DISTANCE) {
        this.footstepDistance -= FOOTSTEP_DISTANCE;
        this.sfx.footstep();
      }
    }

    this.nodeChainTimer -= dt;
    if (this.nodeChainTimer <= 0) {
      this.nodeChain = 0;
    }

    // ---- Invincibility and scatter/chase rhythm ---------------------------------
    if (this.power.update(dt)) {
      for (const monitor of this.monitors) {
        monitor.ai.endFrightened(this.scheduler.modeFor(monitor.ai.slot));
      }
    }
    this.scheduler.update(dt, this.power.active);

    // ---- Monitors (each decides independently) ----------------------------------
    const world: MonitorWorld = {
      scheduler: this.scheduler,
      scientistTile: this.scientist.currentTile,
      scientistFacing: this.scientist.facing,
      virusTile: this.virus.ai.currentTile,
    };
    for (const monitor of this.monitors) {
      monitor.update(dt, world);
    }

    // ---- Collisions -------------------------------------------------------------
    const report = checkCollisions(this.scientist, this.monitors, maze);
    for (const monitor of report.caught) {
      this.catchMonitor(monitor);
    }
    if (report.killer !== null) {
      this.events.emit('scientistCaught', { by: report.killer.id });
      this.machine.transition(GameState.Dying);
    }
  }

  /** Collects whatever is on a tile the scientist just reached. */
  private collect(tile: GridPoint): void {
    const { maze, difficulty } = this.level;
    const pickup = maze.takePickup(tile);
    if (pickup === Pickup.None) {
      return;
    }

    this.nodeField.collect(tile);
    const world = gridToWorld(tile.col, tile.row, maze.width, maze.height, TILE_SIZE);

    if (pickup === Pickup.Node) {
      this.score.add(SCORING.node);
      this.nodeChain += 1;
      this.nodeChainTimer = NODE_CHAIN_WINDOW;
      this.pulse.emit(world.x, world.z, 0.8);
      this.events.emit('nodeCollected', {
        point: tile,
        remaining: maze.remainingPickups,
        chain: this.nodeChain,
      });
      return;
    }

    this.score.add(SCORING.powerOrb);
    this.pulse.emit(world.x, world.z, 1.4);
    this.particles.powerSparkle(world.x, world.z, getTheme(maze.theme).powerOrb);
    this.power.start(difficulty.frightenedDuration);
    for (const monitor of this.monitors) {
      monitor.ai.startFrightened();
    }
    this.events.emit('powerOrbCollected', {
      point: tile,
      duration: difficulty.frightenedDuration,
    });
  }

  private catchMonitor(monitor: Monitor): void {
    const points = this.power.registerCatch();
    this.score.add(points);
    const position = monitor.ai.worldPosition(1);
    monitor.ai.caught();

    this.particles.monitorShatter(position.x, position.z, MONITOR_COLORS[monitor.id]);
    this.shake.add(0.3);
    this.freezeTimer = TIMING.monitorCaughtFreeze;

    const screen = this.projectToScreen(position.x, 0.9, position.z);
    this.screens.popup(String(points), screen.x, screen.y);

    this.events.emit('monitorCaught', {
      id: monitor.id,
      point: monitor.ai.currentTile,
      points,
    });
  }

  // ===========================================================================
  //  Rendering (once per display frame)
  // ===========================================================================

  private render(alpha: number, frameTime: number): void {
    const state = this.machine.state;
    const paused = state === GameState.Paused;
    const dt = paused ? 0 : frameTime;
    const inMaze = state === GameState.LevelIntro || state === GameState.Playing || paused;

    if (inMaze) {
      this.scientist.renderTo(this.scientistModel, alpha, dt, this.time, this.power.active);
      for (const monitor of this.monitors) {
        monitor.render(
          alpha,
          dt,
          this.time,
          this.power.remaining,
          this.level.difficulty.frightenedWarning,
        );
      }
    }

    this.pulse.update(dt);
    this.mazeRenderer.update(dt, this.pulse);
    this.nodeField.update(this.time);
    this.particles.update(dt);
    this.sfx.update(this.time);

    if (state !== GameState.Cutscene) {
      this.shake.update(dt);
      const camera = this.context.camera;
      camera.position.set(
        this.cameraBase.x + this.shake.offsetX,
        this.cameraBase.y + this.shake.offsetY,
        this.cameraBase.z,
      );
    }

    this.context.scene.render();
  }

  // ===========================================================================
  //  Helpers
  // ===========================================================================

  /** Builds the visuals for a level and frames the camera on it. */
  private loadLevel(info: LevelInfo): void {
    this.level = info;
    const theme = getTheme(info.maze.theme);
    applySceneTheme(this.context, theme);
    this.mazeRenderer.build(info.maze, theme);
    this.nodeField.build(info.maze, theme);
    this.pulse.clear();
    this.particles.clear();
    this.frameCamera();
  }

  /** Puts the scientist and monitors back at their starts for a new life or level. */
  private resetActors(): void {
    const { maze, difficulty } = this.level;
    this.scientist.reset(maze);
    this.scientistModel.reset(this.scientist.spawnYaw);
    this.scientistModel.setVisible(true);
    for (const monitor of this.monitors) {
      monitor.reset(maze, difficulty);
    }
    this.setMonitorsVisible(true);
    this.scheduler.reset(difficulty.modeSchedule);
    this.power.reset();
    this.sfx.stopAll();
    this.input.clear();
    this.shake.reset();
    this.freezeTimer = 0;
    this.nodeChain = 0;
    this.nodeChainTimer = 0;
    this.footstepDistance = 0;
  }

  private setMonitorsVisible(visible: boolean): void {
    for (const monitor of this.monitors) {
      monitor.setVisible(visible);
    }
  }

  private frameCamera(): void {
    frameMaze(this.context, this.level.maze.width, this.level.maze.height);
    this.cameraBase.copyFrom(this.context.camera.position);
  }

  private hudSnapshot(): HudSnapshot {
    return {
      score: this.score.score,
      highScore: this.score.highScore,
      lives: this.score.lives,
      level: this.level.displayNumber,
      levelName: this.level.definition.name,
    };
  }

  private scientistWorld(): { x: number; z: number } {
    const { maze } = this.level;
    const position = this.scientist.position;
    return gridToWorld(position.col, position.row, maze.width, maze.height, TILE_SIZE);
  }

  /** Converts a world position to CSS pixels within the game view. */
  private projectToScreen(x: number, y: number, z: number): { x: number; y: number } {
    const { engine, scene, camera } = this.context;
    const renderWidth = engine.getRenderWidth();
    const renderHeight = engine.getRenderHeight();
    const projected = Vector3.Project(
      new Vector3(x, y, z),
      Matrix.IdentityReadOnly,
      scene.getTransformMatrix(),
      camera.viewport.toGlobal(renderWidth, renderHeight),
    );
    return {
      x: (projected.x * this.canvas.clientWidth) / Math.max(renderWidth, 1),
      y: (projected.y * this.canvas.clientHeight) / Math.max(renderHeight, 1),
    };
  }

  private attachWindowListeners(): void {
    const options = { signal: this.listeners.signal };

    window.addEventListener(
      'resize',
      () => {
        this.context.engine.resize();
        if (!this.machine.is(GameState.Cutscene)) {
          this.frameCamera();
        }
      },
      options,
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          if (this.machine.is(GameState.Playing)) {
            this.machine.transition(GameState.Paused);
          }
          this.audio.suspend();
        } else {
          this.loop.resetClock();
          if (!this.machine.is(GameState.Paused)) {
            this.audio.resume();
          }
        }
      },
      options,
    );
  }

  /** Fraction (0..1) of the current state's time elapsed, for debugging overlays. */
  get stateProgress(): number {
    return clamp01(this.machine.timeInState);
  }
}
