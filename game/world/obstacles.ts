import { CHUNK_SIZE } from '../engine/constants';

export interface Obstacle {
  type: 'pyramid' | 'building' | 'wall' | 'tower';
  x: number;
  z: number;
  radius: number;
  height: number;
  width?: number; // for buildings/walls
  depth?: number; // for buildings
  segments: number;
}

export interface CityChunk {
  obstacles: Obstacle[];
  isCity: boolean;
}

/** Deterministic hash for chunk coordinates */
function chunkSeed(cx: number, cz: number): number {
  let h = (cx * 374761393 + cz * 668265263 + 1013904223) | 0;
  h = ((h >> 13) ^ h) * 1274126177;
  h = (h >> 16) ^ h;
  return Math.abs(h);
}

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const chunkCache = new Map<string, CityChunk>();

/** Generate obstacles for a single chunk */
function generateChunk(cx: number, cz: number): CityChunk {
  const key = `${cx},${cz}`;
  if (chunkCache.has(key)) return chunkCache.get(key)!;

  const rng = seededRandom(chunkSeed(cx, cz));
  const items: Obstacle[] = [];
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  // Cities no longer spawn randomly — they're tied to quests
  const isCity = false;
  generateWilderness(rng, baseX, baseZ, items);

  const result = { obstacles: items, isCity };
  chunkCache.set(key, result);
  return result;
}

function generateWilderness(rng: () => number, baseX: number, baseZ: number, items: Obstacle[]) {
  // 2-4 pyramids
  const count = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const scale = 3 + rng() * 6;
    items.push({
      type: 'pyramid',
      x: baseX + rng() * CHUNK_SIZE,
      z: baseZ + rng() * CHUNK_SIZE,
      radius: scale,
      height: scale * 1.5,
      segments: 4,
    });
  }
}

function generateCity(rng: () => number, baseX: number, baseZ: number, items: Obstacle[]) {
  const centerX = baseX + CHUNK_SIZE / 2;
  const centerZ = baseZ + CHUNK_SIZE / 2;

  // Central tower
  const towerHeight = 12 + rng() * 10;
  items.push({
    type: 'tower',
    x: centerX + (rng() - 0.5) * 10,
    z: centerZ + (rng() - 0.5) * 10,
    radius: 3,
    height: towerHeight,
    segments: 6,
  });

  // Buildings scattered around
  const buildingCount = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < buildingCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 8 + rng() * 25;
    const w = 3 + rng() * 5;
    const d = 3 + rng() * 5;
    const h = 3 + rng() * 8;
    items.push({
      type: 'building',
      x: centerX + Math.cos(angle) * dist,
      z: centerZ + Math.sin(angle) * dist,
      radius: Math.max(w, d) * 0.6, // collision radius
      width: w,
      depth: d,
      height: h,
      segments: 4,
    });
  }

  // Walls (broken sections connecting some buildings)
  const wallCount = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < wallCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = 10 + rng() * 20;
    const length = 6 + rng() * 12;
    items.push({
      type: 'wall',
      x: centerX + Math.cos(angle) * dist,
      z: centerZ + Math.sin(angle) * dist,
      radius: 1.5, // thin collision
      width: length,
      height: 2 + rng() * 4,
      segments: 4,
    });
  }
}

/** Get all obstacles near a world position (within view range) */
export function getObstaclesNear(px: number, pz: number, range: number): Obstacle[] {
  const minCx = Math.floor((px - range * CHUNK_SIZE) / CHUNK_SIZE);
  const maxCx = Math.floor((px + range * CHUNK_SIZE) / CHUNK_SIZE);
  const minCz = Math.floor((pz - range * CHUNK_SIZE) / CHUNK_SIZE);
  const maxCz = Math.floor((pz + range * CHUNK_SIZE) / CHUNK_SIZE);

  const result: Obstacle[] = [];
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      result.push(...generateChunk(cx, cz).obstacles);
    }
  }
  return result;
}

/** Get chunks near a position (for rendering, includes city info) */
export function getChunksNear(px: number, pz: number, range: number): CityChunk[] {
  const minCx = Math.floor((px - range * CHUNK_SIZE) / CHUNK_SIZE);
  const maxCx = Math.floor((px + range * CHUNK_SIZE) / CHUNK_SIZE);
  const minCz = Math.floor((pz - range * CHUNK_SIZE) / CHUNK_SIZE);
  const maxCz = Math.floor((pz + range * CHUNK_SIZE) / CHUNK_SIZE);

  const result: CityChunk[] = [];
  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cz = minCz; cz <= maxCz; cz++) {
      result.push(generateChunk(cx, cz));
    }
  }
  return result;
}
