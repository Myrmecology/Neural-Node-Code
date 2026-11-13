/**
 * Neural Node & Code - Title screen
 *
 * Black screen, glowing gothic-green title, a block of white pixel-font
 * credits, and two options (EXTRA LIVES and GORE), in the style of a classic
 * console cartridge title screen. Styles live in src/styles/main.css.
 *
 * Options toggle with the L and G keys (handled by the game) or by clicking
 * or tapping their lines. Option taps are stopped here so they never reach
 * the window-level "tap to boot" input.
 *
 * All text is set with textContent (never innerHTML), so nothing shown on
 * screen can be interpreted as markup or code.
 */
import { SCORING } from '../core/Config';

/** The title screen options and their current values. */
export interface TitleOptions {
  readonly extraLives: boolean;
  readonly gore: boolean;
}

/** Called when an option line is clicked or tapped. */
export interface TitleScreenHandlers {
  readonly onToggleLives?: () => void;
  readonly onToggleGore?: () => void;
}

const OPTION_ON_COLOR = '#6bff4a';
const OPTION_OFF_COLOR = '#8a8a8a';

/** Pads a score to six digits, arcade style: 1234 -> "001234". */
export function formatScore(score: number): string {
  return Math.max(0, Math.floor(score)).toString().padStart(6, '0');
}

/** Creates an element with an optional class name and text. */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

/** A paragraph whose lines are separated by line breaks. */
function lines(...content: readonly string[]): HTMLParagraphElement {
  const paragraph = document.createElement('p');
  content.forEach((line, index) => {
    if (index > 0) {
      paragraph.append(document.createElement('br'));
    }
    paragraph.append(document.createTextNode(line));
  });
  return paragraph;
}

/** A clickable option line, activated only by pointer (never by keyboard focus). */
function optionButton(onActivate: () => void): HTMLButtonElement {
  const button = createElement('button', 'pixel-text');
  button.type = 'button';
  // Not reachable with Tab, so Enter and Space always mean "boot the game".
  button.tabIndex = -1;
  button.style.background = 'none';
  button.style.border = 'none';
  button.style.padding = '0.35em 0.6em';
  button.style.font = 'inherit';
  button.style.letterSpacing = 'inherit';
  button.style.cursor = 'pointer';
  button.addEventListener('pointerup', (event) => {
    // Keep this tap from also counting as "tap to boot".
    event.stopPropagation();
    onActivate();
  });
  return button;
}

export class TitleScreen {
  private readonly element: HTMLElement;
  private readonly highScoreLine: HTMLParagraphElement;
  private readonly livesOption: HTMLButtonElement;
  private readonly goreOption: HTMLButtonElement;

  constructor(root: HTMLElement, handlers: TitleScreenHandlers = {}) {
    this.element = createElement('section', 'screen screen--title is-hidden');
    this.element.setAttribute('aria-label', 'Neural Node & Code title screen');

    // ---- Title: "Neural Node & Code" with a deeper-green ampersand ----------
    const title = createElement('h1', 'title-logo');
    title.append(
      document.createTextNode('Neural Node '),
      createElement('span', 'title-logo__amp', '&'),
      document.createTextNode(' Code'),
    );

    // ---- Credits ------------------------------------------------------------
    const credits = createElement('div', 'credits');
    credits.append(
      lines('COMPUTER SCIENCE', 'RETRO GAME CREATION 2026'),
      lines(
        'ALL NODES RESERVED.',
        'COMPILED IN TYPESCRIPT.',
        'RENDERED WITH BABYLON.JS',
        'ON THE WEBGL PIPELINE.',
      ),
      lines('NO MONITORS WERE HARMED', 'IN THE DEBUGGING OF THIS SOFTWARE.'),
    );

    this.highScoreLine = createElement('p', 'pixel-text');
    credits.append(this.highScoreLine);

    // ---- Options ------------------------------------------------------------
    const options = createElement('div', 'credits');
    options.style.gap = '0.2em';
    options.style.alignItems = 'center';
    this.livesOption = optionButton(() => handlers.onToggleLives?.());
    this.goreOption = optionButton(() => handlers.onToggleGore?.());
    options.append(this.livesOption, this.goreOption);

    // ---- Prompt and controls ------------------------------------------------
    const prompt = createElement('p', 'prompt', 'PRESS ENTER OR TAP TO BOOT');
    const controls = createElement(
      'p',
      'credits hud__label',
      'ARROWS/WASD OR SWIPE TO MOVE   P PAUSE   M MUTE',
    );

    this.element.append(title, credits, options, prompt, controls);
    root.append(this.element);

    this.setOptions({ extraLives: false, gore: true });
  }

  get isVisible(): boolean {
    return !this.element.classList.contains('is-hidden');
  }

  /** Shows the title screen with the current high score and option values. */
  show(highScore: number, options?: TitleOptions): void {
    this.highScoreLine.textContent = `HIGH SCORE ${formatScore(highScore)}`;
    if (options !== undefined) {
      this.setOptions(options);
    }
    this.element.classList.remove('is-hidden');
  }

  /** Updates the option lines to match the current values. */
  setOptions(options: TitleOptions): void {
    this.livesOption.textContent = options.extraLives
      ? `EXTRA LIVES: ON (+${SCORING.bonusLives}) [L]`
      : 'EXTRA LIVES: OFF [L]';
    this.livesOption.style.color = options.extraLives ? OPTION_ON_COLOR : OPTION_OFF_COLOR;
    this.livesOption.setAttribute('aria-pressed', String(options.extraLives));

    this.goreOption.textContent = options.gore ? 'GORE: ON [G]' : 'GORE: OFF [G]';
    this.goreOption.style.color = options.gore ? OPTION_ON_COLOR : OPTION_OFF_COLOR;
    this.goreOption.setAttribute('aria-pressed', String(options.gore));
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
