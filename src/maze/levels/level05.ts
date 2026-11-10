/**
 * Neural Node & Code - Level 5: Myelin
 *
 * Long insulated corridors wrap the maze in layers, like the myelin sheath
 * around a nerve fiber. A deep, narrow tunnel approach makes the side
 * escape a gamble. This is where the difficulty curve steps up: faster
 * monitors and shorter invincibility. The symbol legend is documented in
 * src/maze/Maze.ts.
 *
 * 28 columns x 31 rows. 376 nodes, 4 power orbs.
 * The layout is mirrored left-to-right for balanced, fair play.
 */
import type { LevelDefinition } from '../../types';

export const level05: LevelDefinition = {
  id: 5,
  name: 'Myelin',
  theme: 'myelin',
  // prettier-ignore
  layout: [
    '############################',
    '#............##............#',
    '#.##.#######.##.#######.##.#',
    '#.##.#.......##.......#.##.#',
    '#o##.#.#.##########.#.#.##o#',
    '#....#.#.....##.....#.#....#',
    '####.#.#####....#####.#.####',
    '####...#.....##.....#...####',
    '####.#.#.###.##.###.#.#.####',
    '#....#.......##.......#....#',
    '#.####.#.##########.#.####.#',
    '#.####.#.....E .....#.####.#',
    '#......#.####--####.#......#',
    '######.#.#________#.#.######',
    '======...#__1234__#...======',
    '######.#.#________#.#.######',
    '#......#.##########.#......#',
    '#.####.#............#.####.#',
    '#.####.#.####..####.#.####.#',
    '#....#...####..####...#....#',
    '####.#.#............#.#.####',
    '#o...#.#.###.##.###.#.#...o#',
    '#.##.....###.##.###.....##.#',
    '#.##.###.....##.....###.##.#',
    '#.##.###.##########.###.##.#',
    '#....#.......##.......#....#',
    '#.####.#.###.##.###.#.####.#',
    '#.####.#.###.##.###.#.####.#',
    '#......#.....##.....#......#',
    '#............S ............#',
    '############################',
  ],
};
