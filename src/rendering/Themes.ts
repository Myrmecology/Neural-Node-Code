/**
 * Neural Node & Code - Color themes
 *
 * One palette per level, plus fixed character colors that stay the same on
 * every level so the scientist and each monitor are always recognizable.
 * Colors are stored as plain hex strings; the renderer converts them to
 * Babylon.js colors.
 */
import { MonitorId } from '../types';
import type { ThemeId } from '../types';

/** A color written as #RRGGBB. */
export type HexColor = `#${string}`;

export interface ThemePalette {
  readonly id: ThemeId;
  /** Scene clear color, visible beyond the maze. */
  readonly background: HexColor;
  /** The floor beneath the maze. */
  readonly floor: HexColor;
  /** Faint grid lines etched into the floor. */
  readonly floorGrid: HexColor;
  /** Solid body of the walls. */
  readonly wallBody: HexColor;
  /** Glowing edge lines along the tops of the walls. */
  readonly wallEdge: HexColor;
  /** Small wireframe nodes. */
  readonly node: HexColor;
  /** Large wireframe power orbs. */
  readonly powerOrb: HexColor;
  /** The monitor house door. */
  readonly door: HexColor;
  /** Ripple of light that travels along the walls when a node is collected. */
  readonly pulse: HexColor;
  /** Level intro text and highlights. */
  readonly accent: HexColor;
}

export const THEMES: Readonly<Record<ThemeId, ThemePalette>> = {
  synapse: {
    id: 'synapse',
    background: '#02050a',
    floor: '#050c14',
    floorGrid: '#0b2a3a',
    wallBody: '#06212e',
    wallEdge: '#00e5ff',
    node: '#7df9ff',
    powerOrb: '#e0fdff',
    door: '#ff4fd8',
    pulse: '#00e5ff',
    accent: '#00e5ff',
  },
  cortex: {
    id: 'cortex',
    background: '#08020a',
    floor: '#120614',
    floorGrid: '#3a0b35',
    wallBody: '#2a0626',
    wallEdge: '#ff2bd6',
    node: '#ff9cf0',
    powerOrb: '#ffe0fa',
    door: '#00e5ff',
    pulse: '#ff2bd6',
    accent: '#ff2bd6',
  },
  axon: {
    id: 'axon',
    background: '#0a0602',
    floor: '#140d04',
    floorGrid: '#3a2a0b',
    wallBody: '#2e1e06',
    wallEdge: '#ffb000',
    node: '#ffd66b',
    powerOrb: '#fff3d1',
    door: '#ff4f4f',
    pulse: '#ffb000',
    accent: '#ffb000',
  },
  dendrite: {
    id: 'dendrite',
    background: '#030a02',
    floor: '#06140a',
    floorGrid: '#0f3a12',
    wallBody: '#0a2a0c',
    wallEdge: '#39ff14',
    node: '#b6ff9e',
    powerOrb: '#ecffe3',
    door: '#ffe600',
    pulse: '#39ff14',
    accent: '#39ff14',
  },
  myelin: {
    id: 'myelin',
    background: '#05020c',
    floor: '#0c0718',
    floorGrid: '#24124a',
    wallBody: '#1a0c3a',
    wallEdge: '#9b5cff',
    node: '#cdb2ff',
    powerOrb: '#f1e8ff',
    door: '#39ff14',
    pulse: '#9b5cff',
    accent: '#9b5cff',
  },
  plasma: {
    id: 'plasma',
    background: '#0c0302',
    floor: '#180806',
    floorGrid: '#45150c',
    wallBody: '#3a0f06',
    wallEdge: '#ff4d1f',
    node: '#ffa184',
    powerOrb: '#ffe6dc',
    door: '#00e5ff',
    pulse: '#ff4d1f',
    accent: '#ff4d1f',
  },
  quantum: {
    id: 'quantum',
    background: '#02040c',
    floor: '#050a1a',
    floorGrid: '#0f1f4a',
    wallBody: '#0a163a',
    wallEdge: '#3d7bff',
    node: '#9fbcff',
    powerOrb: '#e6eeff',
    door: '#ff2bd6',
    pulse: '#3d7bff',
    accent: '#3d7bff',
  },
  singularity: {
    id: 'singularity',
    background: '#000000',
    floor: '#0a0405',
    floorGrid: '#2a0a10',
    wallBody: '#1c0509',
    wallEdge: '#ff1744',
    node: '#ff8fa3',
    powerOrb: '#ffffff',
    door: '#ffd700',
    pulse: '#ff1744',
    accent: '#ff1744',
  },
};

/** The palette for a theme. */
export function getTheme(id: ThemeId): ThemePalette {
  return THEMES[id];
}

// =============================================================================
//  Character colors (the same on every level)
// =============================================================================

/** Each monitor's signature screen color, used for its face and glow. */
export const MONITOR_COLORS: Readonly<Record<MonitorId, HexColor>> = {
  [MonitorId.Virus]: '#ff2a2a',
  [MonitorId.Worm]: '#ff6ec7',
  [MonitorId.Glitch]: '#2af5ff',
  [MonitorId.Trojan]: '#ff9a1f',
};

/** Monitor casing and screen colors shared by all four monitors. */
export const MONITOR_BODY = {
  casing: '#c9c3b4',
  casingDark: '#7d786c',
  bezel: '#1a1a1a',
  /** Blue screen of death while frightened. */
  frightened: '#1a3cff',
  /** Flash color as frightened mode runs out. */
  frightenedFlash: '#f2f2f2',
  /** Dim outline of a caught monitor racing back to the house. */
  returning: '#5a6070',
} as const satisfies Record<string, HexColor>;

export const SCIENTIST_COLORS = {
  labCoat: '#f4f6f8',
  shirt: '#4a7bd1',
  trousers: '#2b2f3a',
  shoes: '#121318',
  skin: '#e8b996',
  hair: '#3a2a20',
  goggles: '#7df9ff',
  /** Glow around the scientist while invincible. */
  powerGlow: '#ffffff',
} as const satisfies Record<string, HexColor>;
