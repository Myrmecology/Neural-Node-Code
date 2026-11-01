/**
 * Neural Node & Code - Vite configuration
 *
 * Written for Vite 8 (Rolldown bundler) and Vitest 5.
 * Uses the current Vite 8 option names: `rolldownOptions` and `codeSplitting`.
 */
import { defineConfig } from 'vitest/config';

/** Security headers applied to the local dev and preview servers. */
const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineConfig({
  // Relative paths so the built game runs from any folder or host.
  base: './',

  // ---------------------------------------------------------------------------
  //  Local development server (npm run dev)
  // ---------------------------------------------------------------------------
  server: {
    // Bind to this machine only, so the dev server is never exposed on your network.
    host: 'localhost',
    port: 5173,
    strictPort: true,
    open: true,
    headers: securityHeaders,
  },

  // ---------------------------------------------------------------------------
  //  Production preview server (npm run preview)
  // ---------------------------------------------------------------------------
  preview: {
    host: 'localhost',
    port: 4173,
    strictPort: true,
    headers: securityHeaders,
  },

  // ---------------------------------------------------------------------------
  //  Production build (npm run build)
  // ---------------------------------------------------------------------------
  build: {
    target: 'baseline-widely-available',
    outDir: 'dist',
    emptyOutDir: true,
    // Do not publish source maps, so the original source is not shipped to players.
    sourcemap: false,
    // Babylon.js is a large engine; raise the warning threshold accordingly.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Place Babylon.js in its own file so browsers can cache the engine
        // separately from the game code, which changes more often.
        codeSplitting: {
          groups: [
            {
              name: 'babylon',
              test: /[\\/]node_modules[\\/]@babylonjs[\\/]/,
            },
          ],
        },
      },
    },
  },

  // ---------------------------------------------------------------------------
  //  Automated tests (npm test)
  // ---------------------------------------------------------------------------
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
