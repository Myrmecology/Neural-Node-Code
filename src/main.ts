/**
 * Neural Node & Code - Entry point
 *
 * Loads the stylesheet, verifies WebGL support, creates the game, and starts
 * it. Audio is unlocked on the player's first key press or tap, as browsers
 * require. If anything fails during startup, a readable message is shown
 * instead of a blank screen.
 */
import './styles/main.css';
import { Game } from './core/Game';

/** Finds a required element by id and checks its type. */
function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Startup failed: element #${id} is missing from index.html.`);
  }
  return element;
}

/** True when the browser can create a WebGL context. */
function supportsWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null;
  } catch {
    return false;
  }
}

/** Replaces the page with a readable error message. */
function showFatalError(message: string): void {
  const notice = document.createElement('p');
  notice.className = 'noscript';
  notice.textContent = message;
  document.body.replaceChildren(notice);
}

function boot(): void {
  if (!supportsWebGL()) {
    showFatalError('NEURAL NODE & CODE REQUIRES WEBGL. PLEASE USE AN UP-TO-DATE BROWSER.');
    return;
  }

  const canvas = requireElement('game-canvas', HTMLCanvasElement);
  const uiRoot = requireElement('ui-root', HTMLDivElement);

  const game = new Game(canvas, uiRoot);
  game.start();

  // Browsers only allow sound after the player interacts with the page.
  const unlockAudio = (): void => {
    game.unlockAudio();
  };
  window.addEventListener('keydown', unlockAudio);
  window.addEventListener('pointerdown', unlockAudio);

  // During development, cleanly shut down the old game before a hot reload.
  import.meta.hot?.dispose(() => {
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('pointerdown', unlockAudio);
    game.dispose();
  });
}

try {
  boot();
} catch (error) {
  console.error(error);
  showFatalError('NEURAL NODE & CODE FAILED TO START. SEE THE BROWSER CONSOLE (F12) FOR DETAILS.');
}
