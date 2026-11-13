# Neural Node & Code
# FOR A VIDEO DEMO OF THIS PROJECT PLEASE VISIT: https://www.youtube.com/watch?v=R3JmjBxTS5g

A 3D maze chase game built with TypeScript and Babylon.js. Guide the scientist through eight glowing neural mazes, collect every data node, and outrun four rogue computer monitors that each hunt you in their own way.

---

## Features

- **Fully 3D world** rendered with Babylon.js on WebGL, with glowing neon walls, a fixed angled camera, and bloom-style glow on every light source.
- **A walking scientist** built entirely in code, with a procedural walk cycle: swinging arms, hip and knee joints, a bobbing stride, and footsteps that never slide.
- **Breathing wireframe nodes** that pulse in a slow wave across the maze, plus larger power orbs that grant temporary invincibility.
- **The neural pulse:** every node you collect sends a ripple of light racing across the maze walls.
- **Four independent monitors,** each with its own personality, release timing, speed, and scatter corner, so they never move as a single cluster.
- **Eight handcrafted levels,** each with its own layout and color theme, automatically tested to be sealed, fully reachable, and free of dead ends.
- **Level assembly:** each maze rises out of the floor in a wave before play begins.
- **Two cutscenes:** one after level 4 and another after level 8.
- **Endless play:** after level 8 the game loops back to level 1, faster and harder.
- **Synthesized sound:** every sound effect and jingle is generated live in code. There are no audio files.
- **Smooth on any display:** fixed-timestep simulation with interpolated rendering, identical at 60 Hz or 240 Hz.
- **Keyboard and touch controls,** with input buffering for responsive cornering.

---

## Controls

| Action          | Keyboard              | Touch |
| --------------- | --------------------- | ----- |
| Move            | Arrow keys or W A S D | Swipe |
| Start / Confirm | Enter or Space        | Tap   |
| Pause / Resume  | P or Esc              | -     |
| Mute / Unmute   | M                     | -     |

Tip: press a direction just before reaching a turn. The game remembers it briefly and turns the moment the path opens.

---

## How to Play

1. Collect every **node** in the maze to clear the level.
2. Avoid the **monitors**. If one catches you, you lose a life.
3. Grab a **power orb** to become invincible for a short time. The monitors turn blue and flee, and you can catch them for bonus points.
4. Use the **side tunnels** to escape across the maze. Monitors slow down inside them.
5. Earn an **extra life** at 10,000 points.

### Scoring

| Item               | Points |
| ------------------ | ------ |
| Node               | 10     |
| Power orb          | 50     |
| 1st monitor caught | 200    |
| 2nd monitor caught | 400    |
| 3rd monitor caught | 800    |
| 4th monitor caught | 1600   |

Catch values reset each time you collect a new power orb.

---

## The Monitors

| Monitor | Color  | Role     | Behavior                                                                |
| ------- | ------ | -------- | ----------------------------------------------------------------------- |
| Virus   | Red    | Hunter   | Chases the scientist's exact position.                                  |
| Worm    | Pink   | Ambusher | Aims four tiles ahead of the scientist to cut him off.                  |
| Glitch  | Cyan   | Flanker  | Uses the Virus's position to approach from the opposite side.           |
| Trojan  | Orange | Coward   | Chases from a distance, then retreats to its corner when it gets close. |

Each monitor's screen shows its face, and its eyes look in the direction it is moving.

---

## Levels

| Level | Name        | Highlights                                             |
| ----- | ----------- | ------------------------------------------------------ |
| 1     | Synapse     | Long, readable corridors and a single center tunnel.   |
| 2     | Cortex      | Folded corridors and winding side passages.            |
| 3     | Axon        | Two tunnels, high and low.                             |
| 4     | Dendrite    | Branching paths and a wide-open tunnel corridor.       |
| 5     | Myelin      | Layered parallel corridors and a deep tunnel approach. |
| 6     | Plasma      | Two short tunnels and a fortress-like monitor house.   |
| 7     | Quantum     | Twin shafts beside the house and a narrow top channel. |
| 8     | Singularity | A high monitor house and long blind corridors.         |

---

## Requirements

- **Node.js** 22.12 or newer
- **npm** (included with Node.js)
- A modern browser with **WebGL** support (Chrome, Edge, Firefox, or Safari)

---

## Getting Started

Clone the repository and install dependencies:

```bash
git clone <your-repository-url>
cd <your-repository-folder>
npm install
```

Start the development server:

```bash
npm run dev
```

The game opens automatically at `http://localhost:5173`.

---

## Available Scripts

| Command                | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Starts the local development server with instant reload.            |
| `npm run build`        | Type-checks the project and builds an optimized release in `dist/`. |
| `npm run preview`      | Serves the release build locally for testing.                       |
| `npm run typecheck`    | Checks every file for type errors.                                  |
| `npm run lint`         | Checks code quality and security rules.                             |
| `npm run lint:fix`     | Fixes lint issues that can be corrected automatically.              |
| `npm run format`       | Formats every file with Prettier.                                   |
| `npm run format:check` | Verifies formatting without changing files.                         |
| `npm test`             | Runs the automated maze tests.                                      |
| `npm run check`        | Runs type checking, linting, formatting, and tests together.        |

---

## Building for Release

```bash
npm run build
npm run preview
```

The finished game is written to the `dist/` folder. It is fully self-contained, uses relative paths, and can be hosted on any static web host.

---

## Project Structure

```
Neural Node & Code/
├── public/              Favicon
├── src/
│   ├── ai/              Monitor personalities, scatter/chase rhythm, monitor AI
│   ├── audio/           Web Audio synthesis engine and sound effects
│   ├── core/            Game orchestrator, config, game loop, state machine, events
│   ├── cutscenes/       Level 4 and level 8 cutscenes
│   ├── entities/        Scientist, monitors, and collectible nodes
│   ├── input/           Keyboard and touch input with buffering
│   ├── maze/            Maze logic, validation, 3D rendering, and the 8 levels
│   ├── rendering/       Scene setup, color themes, effects, and particles
│   ├── styles/          Page and screen styling
│   ├── systems/         Score, power, collisions, and level progression
│   ├── types/           Shared TypeScript types
│   ├── ui/              Title screen, HUD, and overlay screens
│   ├── utils/           Direction, grid, and math helpers
│   └── main.ts          Entry point
├── tests/               Automated maze tests
└── index.html           Game page with Content Security Policy
```

---

## Technology

- **TypeScript** with strict type checking
- **Babylon.js** for 3D rendering on WebGL
- **Vite** for development and builds
- **Vitest** for automated testing
- **ESLint** with strict type-aware rules
- **Prettier** for consistent formatting
- **Fontsource** for bundled, locally served fonts (Pirata One and Press Start 2P, SIL Open Font License)

---

## Quality and Testing

Every level is verified by automated tests before it can ship. The tests prove that each maze:

- has a sealed outer wall, except for matched side tunnels,
- has every corridor, node, and power orb reachable from the scientist's start,
- contains no dead ends,
- has a working monitor house where every monitor can exit,
- keeps the scientist out of the monitor house.

Run the full quality gate at any time:

```bash
npm run check
```

---

## Security

This project uses a strict Content Security Policy, locally bundled fonts, no external network requests, exact dependency versions, and a security-focused `.gitignore`. See [SECURITY.md](SECURITY.md) for details and how to report a vulnerability.

---

## License

Copyright 2026. All rights reserved.

This project is not licensed for redistribution. Bundled fonts are used under the SIL Open Font License.
