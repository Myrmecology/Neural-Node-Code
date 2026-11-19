/**
 * Neural Node & Code - Standalone build
 *
 * Packs the whole game (code, styles, fonts, and icon) into ONE HTML file
 * that runs by double-clicking it, with no server, install, or internet.
 *
 *   npm run build:standalone  ->  release/Neural Node & Code.html
 *
 * How it works:
 * 1. Runs a normal Vite build with packing overrides (one script, one
 *    stylesheet, every asset inlined). vite.config.ts itself is not changed.
 * 2. Inlines the script, stylesheet, and icon into index.html.
 * 3. Adds the inlined script's SHA-256 hash to the Content Security Policy,
 *    so that script (and only that script) is allowed to run. Every other
 *    CSP rule stays exactly as written in index.html.
 *
 * Output goes to release/, which .gitignore already excludes.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_DIR = path.join(ROOT, 'release');
// Temporary build output lives outside the project, so nothing stray is ever
// linted, formatted, or committed, even if a build is interrupted.
const TEMP_DIR = path.join(tmpdir(), 'neural-node-and-code-standalone');
const OUTPUT_FILE = path.join(RELEASE_DIR, 'Neural Node & Code.html');

/** Replaces exactly one occurrence of a pattern, failing loudly otherwise. */
function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`));
  if (matches?.length !== 1) {
    throw new Error(
      `Standalone build: expected exactly one ${label}, found ${matches?.length ?? 0}.`,
    );
  }
  // A function replacement keeps "$" characters in the code from being misread.
  return html.replace(pattern, () => replacement);
}

async function main() {
  // ---- 1. Build with packing overrides ---------------------------------------
  await rm(TEMP_DIR, { recursive: true, force: true });
  await build({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.ts'),
    logLevel: 'warn',
    build: {
      outDir: TEMP_DIR,
      emptyOutDir: true,
      // Inline every asset (fonts) as data: URLs.
      assetsInlineLimit: () => true,
      cssCodeSplit: false,
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: 50_000,
      // One script file: no separate Babylon.js chunk, no lazy-loaded chunks.
      rolldownOptions: { output: { codeSplitting: false } },
    },
  });

  // ---- 2. Collect the built files ----------------------------------------------
  const assetsDir = path.join(TEMP_DIR, 'assets');
  const assets = await readdir(assetsDir);
  const scripts = assets.filter((name) => name.endsWith('.js'));
  const styles = assets.filter((name) => name.endsWith('.css'));
  const leftovers = assets.filter((name) => !name.endsWith('.js') && !name.endsWith('.css'));
  if (scripts.length !== 1 || styles.length !== 1 || leftovers.length !== 0) {
    throw new Error(
      `Standalone build: expected 1 script and 1 stylesheet, found ${assets.join(', ')}.`,
    );
  }

  const script = (await readFile(path.join(assetsDir, scripts[0]), 'utf8'))
    // Keep the code from ending its own <script> tag early.
    .replace(/<\/script/gi, '<\\/script');
  const style = (await readFile(path.join(assetsDir, styles[0]), 'utf8')).replace(
    /<\/style/gi,
    '<\\/style',
  );
  const favicon = await readFile(path.join(TEMP_DIR, 'favicon.svg'));
  let html = await readFile(path.join(TEMP_DIR, 'index.html'), 'utf8');

  // ---- 3. Prepare the page (before any code is inserted) -----------------------
  html = replaceOnce(
    html,
    /<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/,
    '',
    'module script tag',
  );
  html = replaceOnce(
    html,
    /href="[^"]*favicon\.svg"/,
    `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`,
    'favicon link',
  );

  // Allow exactly this script in the Content Security Policy. Every other rule
  // stays exactly as written in index.html.
  const hash = createHash('sha256').update(script, 'utf8').digest('base64');
  html = replaceOnce(
    html,
    /script-src 'self';/,
    `script-src 'self' 'sha256-${hash}';`,
    'CSP script-src rule',
  );

  // ---- 4. Inline the stylesheet and the script ---------------------------------
  html = replaceOnce(
    html,
    /<link rel="stylesheet"[^>]*href="[^"]+"[^>]*>/,
    `<style>${style}</style>`,
    'stylesheet link',
  );
  // The script goes at the very end of <body>, after the canvas and UI root.
  const bodyEnd = html.lastIndexOf('</body>');
  if (bodyEnd === -1) {
    throw new Error('Standalone build: </body> not found.');
  }
  html = `${html.slice(0, bodyEnd)}<script type="module">${script}</script>\n  ${html.slice(bodyEnd)}`;

  // ---- 5. Write the result and clean up ------------------------------------------
  await mkdir(RELEASE_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, html, 'utf8');
  await rm(TEMP_DIR, { recursive: true, force: true });

  const sizeMb = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(1);
  console.log(`Standalone build complete: release/Neural Node & Code.html (${sizeMb} MB)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
