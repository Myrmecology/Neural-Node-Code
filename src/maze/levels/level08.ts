/**
 * Neural Node & Code - Level 8: Singularity
 *
 * The final maze. The monitor house sits high in the maze, close to the top
 * tunnel, so monitors reach the scientist's half quickly. Two tunnels, long
 * blind corridors beneath the house, and a scientist start on the bottom
 * edge with nowhere to hide. Clearing it triggers the second cutscene.
 * The symbol legend is documented in src/maze/Maze.ts.
 *
 * 28 columns x 31 rows. 334 nodes, 4 power orbs.
 * The layout is mirrored left-to-right for balanced, fair play.
 */
import type { LevelDefinition } from '../../types';

export const level08: LevelDefinition = {
  id: 8,
  name: 'Singularity',
  theme: 'singularity',
  // prettier-ignore
  layout: [
    '############################',
    '#o.....#.....##.....#.....o#',
    '#.####.#.###.##.###.#.####.#',
    '#.####.......##.......####.#',
    '#......#.###....###.#......#',
    '###.##.#.###.##.###.#.##.###',
    '===.##.......##.......##.===',
    '###.##.##.########.##.##.###',
    '#......##....E ....##......#',
    '#.####.######--######.####.#',
    '#.####.###________###.####.#',
    '#......###__1234__###......#',
    '####.#.###________###.#.####',
    '####.#.##############.#.####',
    '#....#.##############.#....#',
    '#.##.#.##..........##.#.##.#',
    '#.##...##.########.##...##.#',
    '#.#####...########...#####.#',
    '#.#####.#.########.#.#####.#',
    '#.......#..........#.......#',
    '####.####.##.##.##.####.####',
    '####.####.##.##.##.####.####',
    '===....#............#....===',
    '###.##.#.##.#..#.##.#.##.###',
    '#o.....#.##......##.#.....o#',
    '#.####.#.##.####.##.#.####.#',
    '#.####......####......####.#',
    '#....#.####.####.####.#....#',
    '####.#.####..##..####.#.####',
    '####.........S .........####',
    '############################',
  ],
};
