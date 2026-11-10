/**
 * Neural Node & Code - Heads-up display
 *
 * Score (left), high score (center), level number and name (right), and
 * lives. Updates itself from game events and only writes to the page when a
 * value actually changes.
 */
import type { EventBus } from '../core/EventBus';
import type { HudSnapshot } from '../types';
import { createElement, formatScore } from './TitleScreen';

interface HudField {
  readonly value: HTMLSpanElement;
  current: string;
}

function setField(field: HudField, text: string): void {
  if (field.current !== text) {
    field.current = text;
    field.value.textContent = text;
  }
}

export class Hud {
  private readonly element: HTMLElement;
  private readonly score: HudField;
  private readonly highScore: HudField;
  private readonly lives: HudField;
  private readonly level: HudField;
  private readonly levelName: HudField;
  private readonly unsubscribers: (() => void)[] = [];

  constructor(root: HTMLElement, events: EventBus) {
    this.element = createElement('header', 'hud is-hidden');
    this.element.setAttribute('aria-label', 'Game status');

    const left = createElement('div', 'hud__item');
    this.score = this.field(left, 'SCORE');
    this.lives = this.field(left, 'LIVES');

    const center = createElement('div', 'hud__item hud__item--center');
    this.highScore = this.field(center, 'HIGH SCORE');

    const right = createElement('div', 'hud__item hud__item--right');
    this.level = this.field(right, 'LEVEL');
    this.levelName = this.field(right, null);

    this.element.append(left, center, right);
    root.append(this.element);

    this.unsubscribers.push(
      events.on('scoreChanged', ({ score, highScore }) => {
        setField(this.score, formatScore(score));
        setField(this.highScore, formatScore(highScore));
      }),
      events.on('livesChanged', ({ lives }) => {
        setField(this.lives, String(lives));
      }),
    );
  }

  /** Shows the HUD with a complete set of values. */
  show(snapshot: HudSnapshot): void {
    this.update(snapshot);
    this.element.classList.remove('is-hidden');
  }

  /** Writes every value at once, for example when a level starts. */
  update(snapshot: HudSnapshot): void {
    setField(this.score, formatScore(snapshot.score));
    setField(this.highScore, formatScore(snapshot.highScore));
    setField(this.lives, String(snapshot.lives));
    setField(this.level, String(snapshot.level));
    setField(this.levelName, snapshot.levelName.toUpperCase());
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;
    this.element.remove();
  }

  /** Adds a labeled value to a HUD column. Pass null for a value with no label. */
  private field(parent: HTMLElement, label: string | null): HudField {
    const row = createElement('div');
    if (label !== null) {
      row.append(createElement('span', 'hud__label', `${label} `));
    }
    const value = createElement('span', 'hud__value');
    row.append(value);
    parent.append(row);
    return { value, current: '' };
  }
}
