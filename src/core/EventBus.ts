/**
 * Neural Node & Code - Event bus
 *
 * A small, fully typed publish/subscribe hub. Systems announce events with
 * emit() and react to them with on(), without referencing each other.
 * Event names and payloads are defined by GameEvents in types/index.ts.
 */
import type { GameEventName, GameEvents } from '../types';

/** A listener for one specific event. */
export type EventListener<K extends GameEventName> = (payload: GameEvents[K]) => void;

/** Storage type able to hold a listener for any event. */
type StoredListener = (payload: never) => void;

export class EventBus {
  private readonly listeners = new Map<GameEventName, Set<StoredListener>>();

  /**
   * Subscribes to an event.
   * @returns A function that unsubscribes this listener when called.
   */
  on<K extends GameEventName>(event: K, listener: EventListener<K>): () => void {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set<StoredListener>();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      this.off(event, listener);
    };
  }

  /** Subscribes to an event for a single occurrence only. */
  once<K extends GameEventName>(event: K, listener: EventListener<K>): () => void {
    const wrapper: EventListener<K> = (payload) => {
      this.off(event, wrapper);
      listener(payload);
    };
    return this.on(event, wrapper);
  }

  /** Removes a previously added listener. */
  off<K extends GameEventName>(event: K, listener: EventListener<K>): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Announces an event to every listener.
   * Listeners run on a snapshot of the list, so a listener may safely
   * unsubscribe while the event is being delivered. An error in one listener
   * is reported and does not stop the others or crash the game loop.
   */
  emit<K extends GameEventName>(event: K, payload: GameEvents[K]): void {
    const set = this.listeners.get(event);
    if (set === undefined) {
      return;
    }
    for (const stored of Array.from(set)) {
      const listener = stored as EventListener<K>;
      try {
        listener(payload);
      } catch (error) {
        console.error(`EventBus: listener for "${event}" failed.`, error);
      }
    }
  }

  /** Removes every listener for every event. Used when a game session ends. */
  clear(): void {
    this.listeners.clear();
  }
}
