/**
 * Neural Node & Code - Title screen
 *
 * Black screen, glowing gothic-green title, and a block of white pixel-font
 * credits, in the style of a classic console cartridge title screen.
 * Styles live in src/styles/main.css.
 *
 * All text is set with textContent (never innerHTML), so nothing shown on
 * screen can be interpreted as markup or code.
 */

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

export class TitleScreen {
  private readonly element: HTMLElement;
  private readonly highScoreLine: HTMLParagraphElement;

  constructor(root: HTMLElement) {
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

    // ---- Prompt and controls ------------------------------------------------
    const prompt = createElement('p', 'prompt', 'PRESS ENTER OR TAP TO BOOT');
    const controls = createElement(
      'p',
      'credits hud__label',
      'ARROWS/WASD OR SWIPE TO MOVE   P PAUSE   M MUTE',
    );

    this.element.append(title, credits, prompt, controls);
    root.append(this.element);
  }

  get isVisible(): boolean {
    return !this.element.classList.contains('is-hidden');
  }

  /** Shows the title screen with the current high score. */
  show(highScore: number): void {
    this.highScoreLine.textContent = `HIGH SCORE ${formatScore(highScore)}`;
    this.element.classList.remove('is-hidden');
  }

  hide(): void {
    this.element.classList.add('is-hidden');
  }

  dispose(): void {
    this.element.remove();
  }
}
