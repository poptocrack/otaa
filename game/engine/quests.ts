import type { Vec3 } from './store';
import { getObstaclesNear } from '../world/obstacles';

export type QuestType =
  | 'fetch_deliver'
  | 'destroy_structure'
  | 'eliminate_target'
  | 'survive_zone'
  | 'siege'
  | 'scavenge'
  | 'recon'
  | 'defend'
  | 'intercept'
  | 'purge';

export interface QuestObjective {
  /** World position for this objective step */
  position: Vec3;
  /** Radius for proximity check */
  radius: number;
  /** Label shown on compass/HUD */
  label: string;
  /** Is this step completed? */
  completed: boolean;
}

export interface QuestStructure {
  id: string;
  position: Vec3;
  health: number;
  maxHealth: number;
  type: 'hostile' | 'allied';
  width: number;
  depth: number;
  height: number;
}

export interface QuestTarget {
  id: string;
  position: Vec3;
  rotation: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  fireRate: number;
  lastFireTime: number;
  alive: boolean;
  /** For intercept: direction of movement */
  moveDirection?: Vec3;
}

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  waveSpawned: number;
  coreReward: number;

  /** Current objective index (for multi-step quests) */
  currentStep: number;
  objectives: QuestObjective[];

  /** Quest-spawned entities */
  structures: QuestStructure[];
  targets: QuestTarget[];

  /** Items to collect (for fetch/scavenge) */
  items: { id: string; position: Vec3; collected: boolean }[];

  /** For survive/defend: timer */
  timerDuration: number;
  timerElapsed: number;

  /** Carrying item (for fetch_deliver) */
  carrying: boolean;

  status: 'active' | 'completed' | 'failed';
}

export interface QuestDef {
  type: QuestType;
  title: string;
  generate: (playerPos: Vec3, wave: number, questId: string) => Omit<Quest, 'id' | 'type' | 'title' | 'waveSpawned' | 'coreReward' | 'status'>;
}

function randomAngle() {
  return Math.random() * Math.PI * 2;
}

function positionAway(playerPos: Vec3, minDist: number, maxDist: number): Vec3 {
  const angle = randomAngle();
  const dist = minDist + Math.random() * (maxDist - minDist);
  return [
    playerPos[0] + Math.cos(angle) * dist,
    0,
    playerPos[2] + Math.sin(angle) * dist,
  ];
}

/** Find a position near center that doesn't overlap any obstacle */
function clearPosition(centerX: number, centerZ: number, spread: number, maxAttempts = 20): Vec3 {
  for (let i = 0; i < maxAttempts; i++) {
    const x = centerX + (Math.random() - 0.5) * spread;
    const z = centerZ + (Math.random() - 0.5) * spread;
    const nearby = getObstaclesNear(x, z, 1);
    let blocked = false;
    for (const ob of nearby) {
      const dx = x - ob.x;
      const dz = z - ob.z;
      if (dx * dx + dz * dz < (ob.radius + 2) * (ob.radius + 2)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return [x, 0, z];
  }
  // Fallback: return last attempt anyway
  return [centerX + (Math.random() - 0.5) * spread, 0, centerZ + (Math.random() - 0.5) * spread];
}

let qid = 0;
const uid = () => `q${++qid}`;

export const QUEST_DEFS: QuestDef[] = [
  {
    type: 'fetch_deliver',
    title: 'SUPPLY RUN',
    generate: (pp, wave, questId) => {
      const pickupBase = positionAway(pp, 50, 90);
      const dropoffBase = positionAway(pp, 40, 80);
      const pickup = clearPosition(pickupBase[0], pickupBase[2], 10);
      const dropoff = clearPosition(dropoffBase[0], dropoffBase[2], 10);
      return {
        description: 'Retrieve the supply crate and deliver it',
        currentStep: 0,
        objectives: [
          { position: pickup, radius: 5, label: 'PICKUP', completed: false },
          { position: dropoff, radius: 5, label: 'DELIVER', completed: false },
        ],
        structures: [],
        targets: [],
        items: [{ id: uid(), position: pickup, collected: false }],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'destroy_structure',
    title: 'DEMOLITION',
    generate: (pp, wave) => {
      const pos = positionAway(pp, 60, 100);
      const hp = 100 + wave * 20;
      return {
        description: 'Destroy the hostile outpost',
        currentStep: 0,
        objectives: [
          { position: pos, radius: 30, label: 'OUTPOST', completed: false },
        ],
        structures: [{
          id: uid(), position: pos, health: hp, maxHealth: hp,
          type: 'hostile', width: 6, depth: 6, height: 8,
        }],
        targets: [],
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'eliminate_target',
    title: 'HIGH VALUE TARGET',
    generate: (pp, wave) => {
      const pos = positionAway(pp, 60, 100);
      const hp = 80 + wave * 30;
      return {
        description: 'Eliminate the elite commander',
        currentStep: 0,
        objectives: [
          { position: pos, radius: 40, label: 'TARGET', completed: false },
        ],
        structures: [],
        targets: [{
          id: uid(), position: pos, rotation: 0,
          health: hp, maxHealth: hp,
          speed: 3 + wave * 0.3, damage: 20 + wave * 3,
          fireRate: 1.2, lastFireTime: 0, alive: true,
        }],
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'survive_zone',
    title: 'HOLD POSITION',
    generate: (pp, wave) => {
      const pos = positionAway(pp, 40, 70);
      return {
        description: 'Hold the zone for 15 seconds',
        currentStep: 0,
        objectives: [
          { position: pos, radius: 12, label: 'ZONE', completed: false },
        ],
        structures: [],
        targets: [],
        items: [],
        timerDuration: 15,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'siege',
    title: 'SIEGE',
    generate: (pp, wave) => {
      const center = positionAway(pp, 70, 110);
      const structures: QuestStructure[] = [];
      const count = 3 + Math.min(wave, 5);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 8 + Math.random() * 15;
        const hp = 60 + wave * 10;
        structures.push({
          id: uid(),
          position: [center[0] + Math.cos(angle) * dist, 0, center[2] + Math.sin(angle) * dist],
          health: hp, maxHealth: hp, type: 'hostile',
          width: 3 + Math.random() * 4, depth: 3 + Math.random() * 4,
          height: 4 + Math.random() * 6,
        });
      }
      return {
        description: `Destroy all ${count} structures`,
        currentStep: 0,
        objectives: [
          { position: center, radius: 40, label: 'CITY', completed: false },
        ],
        structures,
        targets: [],
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'scavenge',
    title: 'SCAVENGE',
    generate: (pp, wave) => {
      const center = positionAway(pp, 50, 80);
      const count = 3 + Math.min(Math.floor(wave / 2), 3);
      const items = Array.from({ length: count }, () => ({
        id: uid(),
        position: clearPosition(center[0], center[2], 40),
        collected: false,
      }));
      return {
        description: `Collect ${count} fragments`,
        currentStep: 0,
        objectives: items.map((it, i) => ({
          position: it.position, radius: 4,
          label: `FRAG ${i + 1}`, completed: false,
        })),
        structures: [],
        targets: [],
        items,
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'recon',
    title: 'RECON',
    generate: (pp, wave) => {
      const points = Array.from({ length: 3 }, () => {
        const base = positionAway(pp, 40, 100);
        return clearPosition(base[0], base[2], 10);
      });
      return {
        description: 'Scout 3 locations',
        currentStep: 0,
        objectives: points.map((p, i) => ({
          position: p, radius: 6,
          label: `POINT ${i + 1}`, completed: false,
        })),
        structures: [],
        targets: [],
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'defend',
    title: 'DEFEND',
    generate: (pp, wave) => {
      const pos = positionAway(pp, 50, 80);
      const hp = 150 + wave * 20;
      return {
        description: 'Protect the relay for 20 seconds',
        currentStep: 0,
        objectives: [
          { position: pos, radius: 20, label: 'RELAY', completed: false },
        ],
        structures: [{
          id: uid(), position: pos, health: hp, maxHealth: hp,
          type: 'allied', width: 4, depth: 4, height: 6,
        }],
        targets: [],
        items: [],
        timerDuration: 20,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'intercept',
    title: 'INTERCEPT',
    generate: (pp, wave) => {
      const start = positionAway(pp, 60, 90);
      const count = 3 + Math.min(wave, 4);
      const targets: QuestTarget[] = [];
      const escapeDir: Vec3 = [
        Math.cos(randomAngle()), 0, Math.sin(randomAngle()),
      ];
      for (let i = 0; i < count; i++) {
        const offset = (Math.random() - 0.5) * 20;
        targets.push({
          id: uid(),
          position: [start[0] + offset, 0, start[2] + offset * 0.5],
          rotation: 0,
          health: 30 + wave * 5, maxHealth: 30 + wave * 5,
          speed: 8 + wave * 0.5, damage: 0, fireRate: 999,
          lastFireTime: 0, alive: true,
          moveDirection: escapeDir,
        });
      }
      return {
        description: `Destroy ${count} drones before they escape`,
        currentStep: 0,
        objectives: [
          { position: start, radius: 50, label: 'DRONES', completed: false },
        ],
        structures: [],
        targets,
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
  {
    type: 'purge',
    title: 'PURGE',
    generate: (pp, wave) => {
      const pos = positionAway(pp, 60, 100);
      const count = 4 + Math.min(wave, 6);
      const targets: QuestTarget[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 5 + Math.random() * 15;
        const hp = 40 + wave * 10;
        targets.push({
          id: uid(),
          position: [pos[0] + Math.cos(angle) * dist, 0, pos[2] + Math.sin(angle) * dist],
          rotation: randomAngle(),
          health: hp, maxHealth: hp,
          speed: 4 + wave * 0.3, damage: 12 + wave * 2,
          fireRate: 2, lastFireTime: 0, alive: true,
        });
      }
      return {
        description: `Destroy all ${count} hostiles in the nest`,
        currentStep: 0,
        objectives: [
          { position: pos, radius: 35, label: 'NEST', completed: false },
        ],
        structures: [],
        targets,
        items: [],
        timerDuration: 0,
        timerElapsed: 0,
        carrying: false,
      };
    },
  },
];

/** Pick a random quest appropriate for the current wave */
export function rollQuest(playerPos: Vec3, wave: number): Quest {
  const def = QUEST_DEFS[Math.floor(Math.random() * QUEST_DEFS.length)];
  const id = uid();
  const generated = def.generate(playerPos, wave, id);
  return {
    id,
    type: def.type,
    title: def.title,
    waveSpawned: wave,
    coreReward: wave,
    status: 'active',
    ...generated,
  };
}
