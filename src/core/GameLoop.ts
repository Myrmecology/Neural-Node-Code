/**
 * Neural Node & Code - Fixed-timestep game loop
 *
 * Game logic advances in exact, fixed steps (TIMING.fixedStep), so movement,
 * AI decisions, and collisions are identical on every machine. Rendering runs
 * once per display frame and receives `alpha` (0..1): how far time has moved
 * between the last two logic steps, used to interpolate smooth positions.
 *
 * The loop does not own requestAnimationFrame. Babylon's render loop calls
 * frame() each display frame, so there is exactly one frame scheduler.
 */
import { TIMING } from './Config';

export interface GameLoopCallbacks {
  /** Advances game logic by exactly `dt` seconds. May run several times per frame. */
  readonly update: (dt: number) => void;
  /**
   * Draws the current frame once per display frame.
   * @param alpha     0..1 blend between the previous and current logic step
   * @param frameTime real seconds since the previous display frame (capped)
   */
  readonly render: (alpha: number, frameTime: number) => void;
}

export class GameLoop {
  private readonly callbacks: GameLoopCallbacks;
  private readonly fixedStep: number;
  private readonly maxFrameTime: number;
  private readonly maxStepsPerFrame: number;

  private running = false;
  private lastTimeMs: number | null = null;
  private accumulator = 0;
  private simulationTime = 0;
  private smoothedFps = 0;

  /** Multiplies the speed of game time. 1 = normal, 0 = frozen. */
  timeScale = 1;

  constructor(
    callbacks: GameLoopCallbacks,
    fixedStep: number = TIMING.fixedStep,
    maxFrameTime: number = TIMING.maxFrameTime,
  ) {
    if (fixedStep <= 0 || maxFrameTime <= 0) {
      throw new RangeError('GameLoop: fixedStep and maxFrameTime must be positive.');
    }
    this.callbacks = callbacks;
    this.fixedStep = fixedStep;
    this.maxFrameTime = maxFrameTime;
    this.maxStepsPerFrame = Math.ceil(maxFrameTime / fixedStep) + 1;
  }

  /** Total simulated game time, in seconds. */
  get time(): number {
    return this.simulationTime;
  }

  /** Smoothed display frames per second, for the debug readout. */
  get fps(): number {
    return this.smoothedFps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    this.running = true;
    this.resetClock();
  }

  stop(): void {
    this.running = false;
  }

  /**
   * Forgets the previous frame time. Call after the tab regains focus so the
   * time spent hidden is not simulated all at once.
   */
  resetClock(): void {
    this.lastTimeMs = null;
    this.accumulator = 0;
  }

  /**
   * Processes one display frame.
   * @param nowMs current time in milliseconds (performance.now())
   */
  frame(nowMs: number): void {
    if (!this.running) {
      return;
    }

    if (this.lastTimeMs === null) {
      this.lastTimeMs = nowMs;
      this.callbacks.render(0, 0);
      return;
    }

    const rawFrameTime = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    const frameTime = Math.min(Math.max(rawFrameTime, 0), this.maxFrameTime);

    if (frameTime > 0) {
      const instantFps = 1 / frameTime;
      this.smoothedFps =
        this.smoothedFps === 0 ? instantFps : this.smoothedFps * 0.9 + instantFps * 0.1;
    }

    this.accumulator += frameTime * Math.max(this.timeScale, 0);

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < this.maxStepsPerFrame) {
      this.callbacks.update(this.fixedStep);
      this.simulationTime += this.fixedStep;
      this.accumulator -= this.fixedStep;
      steps += 1;
    }

    // If the machine could not keep up, drop the backlog instead of spiraling.
    if (steps >= this.maxStepsPerFrame) {
      this.accumulator = 0;
    }

    this.callbacks.render(this.accumulator / this.fixedStep, frameTime);
  }
}
