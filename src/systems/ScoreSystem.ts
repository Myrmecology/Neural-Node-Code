/**
 * Neural Node & Code - Score and lives
 *
 * Tracks score, high score, and lives, awards an extra life at
 * SCORING.extraLifeAt, and announces every change through the event bus.
 * A game may start with bonus lives (the title screen EXTRA LIVES option);
 * the life cap rises by the same amount so earned lives still count.
 *
 * The high score is stored in the browser. Stored data is treated as
 * untrusted: it is strictly validated on load, and any storage failure
 * (private browsing, blocked storage, quota) is ignored safely.
 */
import { SCORING, STORAGE_KEYS } from '../core/Config';
import type { EventBus } from '../core/EventBus';

/** Highest score the game will store or display. */
const MAX_SCORE = 99_999_999;

/** Reads the saved high score, rejecting anything that is not a sane whole number. */
function loadHighScore(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.highScore);
    if (raw === null || !/^\d{1,8}$/.test(raw)) {
      return 0;
    }
    const value = Number(raw);
    return Number.isSafeInteger(value) && value <= MAX_SCORE ? value : 0;
  } catch {
    return 0;
  }
}

function saveHighScore(value: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.highScore, String(value));
  } catch {
    // Storage unavailable: the high score simply is not persisted.
  }
}

export class ScoreSystem {
  private readonly events: EventBus;
  private currentScore = 0;
  private best: number;
  private currentLives: number = SCORING.startingLives;
  private lifeCap: number = SCORING.maxLives;
  private extraLifeAwarded = false;
  private beatBestThisGame = false;

  constructor(events: EventBus) {
    this.events = events;
    this.best = loadHighScore();
  }

  get score(): number {
    return this.currentScore;
  }

  get highScore(): number {
    return this.best;
  }

  get lives(): number {
    return this.currentLives;
  }

  /** True when this game's score has beaten the previous high score. */
  get isNewHighScore(): boolean {
    return this.beatBestThisGame;
  }

  /**
   * Starts a fresh game: score 0, full lives.
   * @param bonusLives extra lives to start with (0 for a normal game)
   */
  reset(bonusLives = 0): void {
    const bonus = Number.isInteger(bonusLives) && bonusLives > 0 ? bonusLives : 0;
    this.currentScore = 0;
    this.currentLives = SCORING.startingLives + bonus;
    this.lifeCap = SCORING.maxLives + bonus;
    this.extraLifeAwarded = false;
    this.beatBestThisGame = false;
    this.announceScore();
    this.events.emit('livesChanged', { lives: this.currentLives });
  }

  /** Adds points, updating the high score and awarding an extra life when earned. */
  add(points: number): void {
    if (!Number.isFinite(points) || points <= 0) {
      return;
    }
    this.currentScore = Math.min(this.currentScore + Math.floor(points), MAX_SCORE);

    if (this.currentScore > this.best) {
      this.best = this.currentScore;
      this.beatBestThisGame = true;
    }

    if (!this.extraLifeAwarded && this.currentScore >= SCORING.extraLifeAt) {
      this.extraLifeAwarded = true;
      if (this.currentLives < this.lifeCap) {
        this.currentLives += 1;
        this.events.emit('extraLife', { lives: this.currentLives });
        this.events.emit('livesChanged', { lives: this.currentLives });
      }
    }

    this.announceScore();
  }

  /**
   * Removes one life.
   * @returns the number of lives left
   */
  loseLife(): number {
    this.currentLives = Math.max(0, this.currentLives - 1);
    this.events.emit('livesChanged', { lives: this.currentLives });
    return this.currentLives;
  }

  /** Saves the high score to the browser. Called at game over. */
  persist(): void {
    saveHighScore(this.best);
  }

  private announceScore(): void {
    this.events.emit('scoreChanged', { score: this.currentScore, highScore: this.best });
  }
}
