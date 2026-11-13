/**
 * Neural Node & Code - Input manager
 *
 * Keyboard and touch input with:
 * - Direction priority: the most recently pressed held key wins, and releasing
 *   it falls back to any key still held.
 * - Input buffering: a direction tapped just before a turn is remembered for
 *   TIMING.inputBuffer seconds so the turn still happens.
 * - Touch swipes: a swipe sets a direction that persists until the next one.
 * - One-shot actions (confirm, pause, mute, title screen toggles) that are
 *   read once per press.
 *
 * Keys are matched by physical position (event.code), so WASD works on any
 * keyboard layout. Every listener is removed together by dispose().
 */
import { TIMING } from '../core/Config';
import { Direction } from '../utils/Direction';
import type { MoveDirection } from '../utils/Direction';

export const InputAction = {
  Confirm: 'confirm',
  Pause: 'pause',
  Mute: 'mute',
  /** Title screen: toggle the EXTRA LIVES option. */
  ToggleLives: 'toggleLives',
  /** Title screen: toggle the GORE option. */
  ToggleGore: 'toggleGore',
} as const;

export type InputAction = (typeof InputAction)[keyof typeof InputAction];

const DIRECTION_KEYS: Readonly<Record<string, MoveDirection>> = {
  ArrowUp: Direction.Up,
  ArrowDown: Direction.Down,
  ArrowLeft: Direction.Left,
  ArrowRight: Direction.Right,
  KeyW: Direction.Up,
  KeyS: Direction.Down,
  KeyA: Direction.Left,
  KeyD: Direction.Right,
};

const ACTION_KEYS: Readonly<Record<string, InputAction>> = {
  Enter: InputAction.Confirm,
  NumpadEnter: InputAction.Confirm,
  Space: InputAction.Confirm,
  Escape: InputAction.Pause,
  KeyP: InputAction.Pause,
  KeyM: InputAction.Mute,
  KeyL: InputAction.ToggleLives,
  KeyG: InputAction.ToggleGore,
};

/** Minimum finger travel, in pixels, for a touch to count as a swipe. */
const SWIPE_THRESHOLD = 24;

interface PointerStart {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export class InputManager {
  /** Held direction keys, oldest first. The last entry is the newest. */
  private readonly held: MoveDirection[] = [];
  private buffered: Direction = Direction.None;
  private bufferTimer = 0;
  private swipeDirection: Direction = Direction.None;
  private pointerStart: PointerStart | null = null;
  private readonly pressed = new Set<InputAction>();
  private readonly abort = new AbortController();

  constructor(target: Window = window) {
    const options = { signal: this.abort.signal };
    target.addEventListener('keydown', this.onKeyDown, options);
    target.addEventListener('keyup', this.onKeyUp, options);
    target.addEventListener('blur', this.onBlur, options);
    target.addEventListener('pointerdown', this.onPointerDown, options);
    target.addEventListener('pointerup', this.onPointerUp, options);
    target.addEventListener('pointercancel', this.onPointerCancel, options);
  }

  /**
   * The direction the player currently wants to travel.
   * Priority: newest held key, then the active swipe, then a recently
   * buffered tap. Returns "none" when nothing is requested.
   */
  get direction(): Direction {
    const newestHeld = this.held.at(-1);
    if (newestHeld !== undefined) {
      return newestHeld;
    }
    if (this.swipeDirection !== Direction.None) {
      return this.swipeDirection;
    }
    return this.bufferTimer > 0 ? this.buffered : Direction.None;
  }

  /** Advances the buffer timer. Call once per simulation step. */
  update(dt: number): void {
    this.bufferTimer = Math.max(0, this.bufferTimer - dt);
  }

  /** True once per press of an action. Reading it consumes the press. */
  wasPressed(action: InputAction): boolean {
    return this.pressed.delete(action);
  }

  /** Discards unread action presses. Call at the end of each simulation step. */
  endUpdate(): void {
    this.pressed.clear();
  }

  /** Forgets all input, for example when a new life or level starts. */
  clear(): void {
    this.held.length = 0;
    this.buffered = Direction.None;
    this.bufferTimer = 0;
    this.swipeDirection = Direction.None;
    this.pointerStart = null;
    this.pressed.clear();
  }

  /** Removes every event listener. */
  dispose(): void {
    this.abort.abort();
    this.clear();
  }

  // ---------------------------------------------------------------------------
  //  Keyboard
  // ---------------------------------------------------------------------------

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    // Leave browser shortcuts such as Ctrl+R or Alt+Tab alone.
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const direction = DIRECTION_KEYS[event.code];
    if (direction !== undefined) {
      event.preventDefault();
      if (!event.repeat) {
        this.removeHeld(direction);
        this.held.push(direction);
        this.setBuffered(direction);
        this.swipeDirection = Direction.None;
      }
      return;
    }

    const action = ACTION_KEYS[event.code];
    if (action !== undefined) {
      event.preventDefault();
      if (!event.repeat) {
        this.pressed.add(action);
      }
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const direction = DIRECTION_KEYS[event.code];
    if (direction !== undefined) {
      this.removeHeld(direction);
      // Keep a quick tap alive briefly so an early press still turns.
      this.setBuffered(direction);
    }
  };

  /** Releases all keys when the window loses focus, preventing stuck keys. */
  private readonly onBlur = (): void => {
    this.held.length = 0;
    this.pointerStart = null;
  };

  // ---------------------------------------------------------------------------
  //  Touch and pointer (swipe to steer, tap to confirm)
  // ---------------------------------------------------------------------------

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }
    this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const start = this.pointerStart;
    if (start?.id !== event.pointerId) {
      return;
    }
    this.pointerStart = null;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) {
      this.pressed.add(InputAction.Confirm);
      return;
    }

    let swipe: MoveDirection;
    if (Math.abs(dx) > Math.abs(dy)) {
      swipe = dx > 0 ? Direction.Right : Direction.Left;
    } else {
      swipe = dy > 0 ? Direction.Down : Direction.Up;
    }
    this.swipeDirection = swipe;
    this.setBuffered(swipe);
  };

  private readonly onPointerCancel = (): void => {
    this.pointerStart = null;
  };

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------

  private setBuffered(direction: MoveDirection): void {
    this.buffered = direction;
    this.bufferTimer = TIMING.inputBuffer;
  }

  private removeHeld(direction: MoveDirection): void {
    const index = this.held.indexOf(direction);
    if (index !== -1) {
      this.held.splice(index, 1);
    }
  }
}
