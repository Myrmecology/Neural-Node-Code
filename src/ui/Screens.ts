/**
 * Neural Node & Code - Overlay screens
 *
 * Center messages (level intro, READY, SYSTEM CLEAR, cutscene captions),
 * the pause screen, the game over screen, and floating score popups.
 * All text is set with textContent. Styles live in src/styles/main.css.
 */
import { createElement, formatScore } from './TitleScreen';

const POPUP_DURATION_MS = 900;

export class Screens {
  private readonly root: HTMLElement;
  private readonly message: HTMLElement;
  private readonly messageTitle: HTMLParagraphElement;
  private readonly messageSubtitle: HTMLParagraphElement;
  private readonly pause: HTMLElement;
  private readonly gameOver: HTMLElement;
  private readonly gameOverScore: HTMLParagraphElement;
  private readonly gameOverBanner: HTMLParagraphElement;
  private readonly popups = new Set<HTMLElement>();

  constructor(root: HTMLElement) {
    this.root = root;

    // ---- Center message -----------------------------------------------------
    this.message = createElement('div', 'overlay-message is-hidden');
    this.message.setAttribute('role', 'status');
    this.message.style.textAlign = 'center';
    this.message.style.lineHeight = '2';
    this.messageTitle = createElement('p');
    this.messageSubtitle = createElement('p', 'hud__value');
    this.message.append(this.messageTitle, this.messageSubtitle);

    // ---- Pause --------------------------------------------------------------
    this.pause = createElement('section', 'screen screen--dim is-hidden');
    this.pause.setAttribute('aria-label', 'Paused');
    this.pause.append(
      createElement('p', 'title-logo', 'Paused'),
      createElement('p', 'prompt', 'PRESS P OR ESC TO RESUME'),
    );

    // ---- Game over ----------------------------------------------------------
    this.gameOver = createElement('section', 'screen screen--dim is-hidden');
    this.gameOver.setAttribute('aria-label', 'Game over');
    this.gameOverScore = createElement('p', 'credits');
    this.gameOverBanner = createElement('p', 'prompt', 'NEW HIGH SCORE!');
    this.gameOver.append(
      createElement('p', 'title-logo', 'System Failure'),
      createElement('p', 'credits', 'GAME OVER'),
      this.gameOverScore,
      this.gameOverBanner,
      createElement('p', 'credits hud__label', 'PRESS ENTER OR TAP TO CONTINUE'),
    );

    root.append(this.message, this.pause, this.gameOver);
  }

  /** Shows a centered message with an optional second line. */
  showMessage(title: string, subtitle = ''): void {
    this.messageTitle.textContent = title;
    this.messageSubtitle.textContent = subtitle;
    this.messageSubtitle.classList.toggle('is-hidden', subtitle === '');
    this.message.classList.remove('is-hidden');
  }

  hideMessage(): void {
    this.message.classList.add('is-hidden');
  }

  showPause(): void {
    this.pause.classList.remove('is-hidden');
  }

  hidePause(): void {
    this.pause.classList.add('is-hidden');
  }

  showGameOver(score: number, isHighScore: boolean): void {
    this.gameOverScore.textContent = `FINAL SCORE ${formatScore(score)}`;
    this.gameOverBanner.classList.toggle('is-hidden', !isHighScore);
    this.gameOver.classList.remove('is-hidden');
  }

  hideGameOver(): void {
    this.gameOver.classList.add('is-hidden');
  }

  /**
   * Floats a short text (like "400") up from a screen position, then removes it.
   * @param x pixels from the left edge of the game view
   * @param y pixels from the top edge of the game view
   */
  popup(text: string, x: number, y: number): void {
    const element = createElement('div', 'pixel-text', text);
    element.style.position = 'absolute';
    element.style.left = `${Math.round(x)}px`;
    element.style.top = `${Math.round(y)}px`;
    element.style.transform = 'translate(-50%, -50%)';
    element.style.fontSize = 'clamp(10px, 1.6vw, 16px)';
    element.style.color = '#ffffff';
    element.style.textShadow = '0 0 8px rgb(255 255 255 / 70%)';
    element.style.pointerEvents = 'none';
    this.root.append(element);
    this.popups.add(element);

    const animation = element.animate(
      [
        { opacity: 1, transform: 'translate(-50%, -50%)' },
        { opacity: 1, transform: 'translate(-50%, -130%)', offset: 0.6 },
        { opacity: 0, transform: 'translate(-50%, -180%)' },
      ],
      { duration: POPUP_DURATION_MS, easing: 'ease-out' },
    );
    animation.onfinish = () => {
      element.remove();
      this.popups.delete(element);
    };
  }

  /** Hides every overlay and removes any floating popups. */
  hideAll(): void {
    this.hideMessage();
    this.hidePause();
    this.hideGameOver();
    for (const popup of this.popups) {
      popup.remove();
    }
    this.popups.clear();
  }

  dispose(): void {
    this.hideAll();
    this.message.remove();
    this.pause.remove();
    this.gameOver.remove();
  }
}
