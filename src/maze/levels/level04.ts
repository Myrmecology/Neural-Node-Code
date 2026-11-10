/**
 * Neural Node & Code - Level 4: Dendrite
 *
 * Branching corridors that split and rejoin like a nerve cell's dendrites,
 * a long open tunnel corridor across the lower middle, and a scientist start
 * sealed in a pocket just below the tunnel. The final maze before the first
 * cutscene. The symbol legend is documented in src/maze/Maze.ts.
 *
 * 28 columns x 31 rows. 362 nodes, 4 power orbs.
 * The layout is mirrored left-to-right for balanced, fair play.
 */
import type { LevelDefinition } from '../../types';

export const level04: LevelDefinition = {
  id: 4,
  name: 'Dendrite',
  theme: 'dendrite',
  // prettier-ignore
  layout: [
    '############################',
    '#......#.....##.....#......#',
    '#.####.#.###.##.###.#.####.#',
    '#o####.......##.......####o#',
    '#.####.#.##########.#.####.#',
    '#......#.....##.....#......#',
    '###.##.#####....#####.##.###',
    '###.##......#..#......##.###',
    '#......####.#..#.####......#',
    '#.####.#.....E .....#.####.#',
    '#.####.#.####--####.#.####.#',
    '#......#.#________#.#......#',
    '####.###.#__1234__#.###.####',
    '####.#...#________#...#.####',
    '####.#.#.##########.#.#.####',
    '#......#............#......#',
    '#.####.###.######.###.####.#',
    '#.####.###.######.###.####.#',
    '====....................====',
    '#####.#.#.#.####.#.#.#.#####',
    '#.....#.#...####...#.#.....#',
    '#.###.#.#####..#####.#.###.#',
    '#o###.#......S ......#.###o#',
    '#.###.#####.####.#####.###.#',
    '#.....#####.####.#####.....#',
    '###.#.......####.......#.###',
    '###.#.#####.####.#####.#.###',
    '#...#.#####.####.#####.#...#',
    '#.###..................###.#',
    '#............##............#',
    '############################',
  ],
};
