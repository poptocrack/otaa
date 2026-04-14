/** Axial hex coordinates (q, r) */
export interface HexCoord {
  q: number;
  r: number;
}

export type BiomeType = 'plains' | 'ruins' | 'canyon' | 'crater' | 'fortress';
export type HexObjective = 'kill_all' | 'destroy_base' | 'survive' | 'boss';
export type HexState = 'unknown' | 'visible' | 'active' | 'conquered';

export interface HexTile {
  coord: HexCoord;
  state: HexState;
  biome: BiomeType;
  objective: HexObjective;
  difficulty: number; // 1-based, increases with distance from center
  reward: { scrap: number; cores: number };
  enemyCount: number;
  bossWave: boolean;
}

export const HEX_RADIUS = 75; // world units, radius of each hex

// Hex directions (flat-top)
const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Convert hex coord to world position (center of hex) */
export function hexToWorld(coord: HexCoord): [number, number] {
  const x = HEX_RADIUS * (3 / 2) * coord.q;
  const z = HEX_RADIUS * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return [x, z];
}

/** Deterministic biome from hex coord */
function hexSeed(q: number, r: number): number {
  let h = (q * 374761393 + r * 668265263 + 1013904223) | 0;
  h = ((h >> 13) ^ h) * 1274126177;
  h = (h >> 16) ^ h;
  return Math.abs(h);
}

const BIOMES: BiomeType[] = ['plains', 'ruins', 'canyon', 'crater', 'fortress'];
const OBJECTIVES: HexObjective[] = ['kill_all', 'destroy_base', 'survive', 'boss'];

export function generateHexTile(coord: HexCoord): HexTile {
  const dist = hexDistance(coord, { q: 0, r: 0 });

  // Center = HQ
  if (dist === 0) {
    return {
      coord, state: 'conquered', biome: 'plains',
      objective: 'kill_all', difficulty: 0,
      reward: { scrap: 0, cores: 0 },
      enemyCount: 0, bossWave: false,
    };
  }

  const seed = hexSeed(coord.q, coord.r);
  const rng = (offset: number) => ((seed + offset * 16807) % 2147483647) / 2147483647;

  const difficulty = dist;
  const biome = BIOMES[seed % BIOMES.length];

  // Boss every ring of 3
  const isBoss = dist % 3 === 0;
  const objective = isBoss ? 'boss' : OBJECTIVES[Math.floor(rng(1) * 3)] as HexObjective; // no boss from random

  // 8 * 2^(difficulty-1): 8, 16, 32, 64, 128...
  const enemyBase = 8 * Math.pow(2, difficulty - 1);
  const enemyCount = isBoss ? enemyBase + Math.round(enemyBase * 0.25) : enemyBase;

  return {
    coord,
    state: dist === 1 ? 'visible' : 'unknown',
    biome,
    objective,
    difficulty,
    reward: {
      scrap: 30 + difficulty * 20 + Math.floor(rng(3) * 30),
      cores: Math.floor(difficulty / 2) + (isBoss ? 2 : 0),
    },
    enemyCount,
    bossWave: isBoss,
  };
}

/** Get or generate a hex tile, reveal neighbors of conquered tiles */
export function getVisibleHexes(conquered: Set<string>): Map<string, HexTile> {
  const tiles = new Map<string, HexTile>();

  // Always include HQ
  const hq = generateHexTile({ q: 0, r: 0 });
  hq.state = 'conquered';
  tiles.set(hexKey(hq.coord), hq);

  // For each conquered hex, reveal its neighbors
  for (const key of conquered) {
    const [q, r] = key.split(',').map(Number);
    const tile = generateHexTile({ q, r });
    tile.state = 'conquered';
    tiles.set(key, tile);

    for (const n of hexNeighbors({ q, r })) {
      const nKey = hexKey(n);
      if (!tiles.has(nKey)) {
        const nTile = generateHexTile(n);
        if (!conquered.has(nKey)) {
          nTile.state = 'visible';
        } else {
          nTile.state = 'conquered';
        }
        tiles.set(nKey, nTile);
      }
    }
  }

  return tiles;
}
