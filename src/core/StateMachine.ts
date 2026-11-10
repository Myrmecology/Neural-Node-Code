/**
 * Neural Node & Code - State machine
 *
 * A small, generic finite state machine with:
 * - enter/exit/update handlers per state
 * - an explicit table of allowed transitions (illegal jumps throw immediately)
 * - safe queuing when a transition is requested from inside enter/exit
 * - a timer tracking how long the current state has been active
 */

/** Optional callbacks for one state. */
export interface StateHandlers<S extends string> {
  /** Runs when this state becomes active. `from` is null for the initial state. */
  enter?: (from: S | null) => void;
  /** Runs just before leaving this state. */
  exit?: (to: S) => void;
  /** Runs every simulation step while this state is active. */
  update?: (dt: number) => void;
}

export interface StateMachineOptions<S extends string> {
  readonly initial: S;
  /** For every state, the states it may move to next. */
  readonly transitions: Readonly<Record<S, readonly S[]>>;
  /** Called after every completed transition. */
  readonly onChange?: (from: S, to: S) => void;
}

export class StateMachine<S extends string> {
  private current: S;
  private elapsed = 0;
  private started = false;
  private changing = false;
  private pending: S | null = null;
  private readonly transitions: Readonly<Record<S, readonly S[]>>;
  private readonly handlers: Partial<Record<S, StateHandlers<S>>> = {};
  private readonly onChange: ((from: S, to: S) => void) | undefined;

  constructor(options: StateMachineOptions<S>) {
    this.current = options.initial;
    this.transitions = options.transitions;
    this.onChange = options.onChange;
  }

  /** The active state. */
  get state(): S {
    return this.current;
  }

  /** Seconds spent in the active state. */
  get timeInState(): number {
    return this.elapsed;
  }

  /** Attaches handlers to a state. Call before start(). */
  register(state: S, handlers: StateHandlers<S>): void {
    this.handlers[state] = handlers;
  }

  /** Enters the initial state. Safe to call only once. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.elapsed = 0;
    this.handlers[this.current]?.enter?.(null);
  }

  /** True when moving from the active state to `to` is allowed. */
  can(to: S): boolean {
    return this.transitions[this.current].includes(to);
  }

  /** True when the machine is in any of the given states. */
  is(...states: readonly S[]): boolean {
    return states.includes(this.current);
  }

  /**
   * Moves to another state.
   * Throws if the transition is not in the table. If called while another
   * transition is running (from inside enter or exit), it is queued and
   * applied immediately afterward.
   */
  transition(to: S): void {
    if (this.changing) {
      this.pending = to;
      return;
    }
    if (!this.can(to)) {
      throw new Error(`StateMachine: illegal transition "${this.current}" -> "${to}".`);
    }

    const from = this.current;
    this.changing = true;
    try {
      this.handlers[from]?.exit?.(to);
      this.current = to;
      this.elapsed = 0;
      this.onChange?.(from, to);
      this.handlers[to]?.enter?.(from);
    } finally {
      this.changing = false;
    }

    const queued = this.pending;
    if (queued !== null) {
      this.pending = null;
      this.transition(queued);
    }
  }

  /** Advances the active state by one simulation step. */
  update(dt: number): void {
    if (!this.started) {
      return;
    }
    this.elapsed += dt;
    this.handlers[this.current]?.update?.(dt);
  }
}
