import { create } from 'zustand';
import { Platform } from 'react-native';
import * as C from './constants';
import { getObstaclesNear } from '../world/obstacles';
import {
  type GlobalStatId,
  type GlobalStats,
  type WeaponStatId,
  type WeaponRunStats,
  type LevelUpChoice,
  INITIAL_GLOBAL_STATS,
  INITIAL_WEAPON_RUN_STATS,
  rollLevelUpChoices,
  getEffective,
  getWeaponRunEffective,
} from './stats';
import { type WeaponId, getWeaponEffective } from './weapons';
import { useMetaStore } from './meta';
import { type Quest, rollQuest } from './quests';
import { hexNeighbors, generateHexTile, hexKey, type HexTile } from './hex';
import { useTerritoryStore } from './territory';
import { saveRunData, saveUserProfile, getCurrentUser } from '../services/firebase';

export type Vec3 = [number, number, number];

export interface Enemy {
  id: string;
  position: Vec3;
  rotation: number;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  fireRate: number;
  lastFireTime: number;
  alive: boolean;
}

export interface Projectile {
  id: string;
  position: Vec3;
  direction: Vec3;
  speed: number;
  owner: 'player' | 'enemy';
  spawnTime: number;
  lifetime: number;
  damage: number;
  weaponType: 'direct' | 'homing' | 'shotgun' | 'railgun' | 'tesla' | 'mortar';
  targetId?: string;
  /** Railgun: how many enemies it can still pierce */
  piercesLeft?: number;
  /** Tesla: chain targets hit so far */
  chainTargets?: string[];
  chainCount?: number;
  chainRange?: number;
  /** Mortar: target landing position + blast radius */
  landingPos?: Vec3;
  blastRadius?: number;
  /** Mortar: arc progress 0-1 */
  arcProgress?: number;
}

export interface HitEffect {
  id: string;
  position: Vec3;
  spawnTime: number;
  type: 'hit' | 'destroy' | 'mortar_blast';
  blastRadius?: number;
}

export type GameStatus = 'menu' | 'playing' | 'levelup' | 'dead' | 'victory' | 'portal_choice';
export type GameMode = 'roguelike' | 'territory';

export interface HexConfig {
  coord: { q: number; r: number };
  biome: string;
  objective: string;
  difficulty: number;
  enemyCount: number;
  bossWave: boolean;
  reward: { scrap: number; cores: number };
}

interface GameState {
  // Game status
  status: GameStatus;
  gameMode: GameMode;
  hexConfig: HexConfig | null;
  time: number;

  // Player
  playerPosition: Vec3;
  playerRotation: number;
  playerHealth: number;
  score: number;
  xp: number;
  level: number;
  globalStats: GlobalStats;
  weaponRunStats: Record<WeaponId, WeaponRunStats>;

  // Level-up choices
  levelUpChoices: LevelUpChoice[];

  // Input state
  moveInput: { x: number; y: number };
  lookInput: { x: number };
  isFiring: boolean;
  weaponFireTimers: Record<string, number>;
  pendingShots: { weaponId: WeaponId; fireAt: number }[];
  kills: number;
  runScrapEarned: number;
  runCoresEarned: number;

  // Entities
  enemies: Enemy[];
  projectiles: Projectile[];
  hitEffects: HitEffect[];

  // Wave
  waveNumber: number;
  enemiesRemainingToSpawn: number;
  lastSpawnTime: number;
  waveActive: boolean;
  lastWaveEndTime: number;

  // Quests
  activeQuest: Quest | null;
  questsCompleted: number;

  // Reward popup
  rewardPopup: { text: string; time: number } | null;

  // Portals (territory mode — after victory)
  portalChoices: { hex: HexConfig; position: Vec3 }[];
  garagePortalPosition: Vec3;
  chainCount: number; // how many sectors chained in a row

  // Victory tracking (territory mode)
  totalEnemiesInHex: number;
  enemiesKilledInHex: number;
  surviveTimer: number;
  surviveTarget: number;

  // Actions
  startGame: (mode?: GameMode, hex?: HexConfig) => void;
  continueToHex: (hex: HexConfig) => void;
  setMoveInput: (input: { x: number; y: number }) => void;
  setLookInput: (input: { x: number }) => void;
  setIsFiring: (firing: boolean) => void;
  chooseLevelUp: (choice: LevelUpChoice) => void;
  updateGame: (delta: number) => void;
}

let nextId = 0;
const uid = () => `${++nextId}`;

function spawnEnemyPosition(playerPos: Vec3): Vec3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = C.ENEMY_SPAWN_DISTANCE + Math.random() * 30;
  return [
    playerPos[0] + Math.cos(angle) * dist,
    0,
    playerPos[2] + Math.sin(angle) * dist,
  ];
}

const COLLISION_RADIUS = 2;

function collideWithObstacles(pos: Vec3): Vec3 {
  let x = pos[0];
  let z = pos[2];

  const nearby = getObstaclesNear(x, z, 1);
  for (const ob of nearby) {
    const dx = x - ob.x;
    const dz = z - ob.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = ob.radius + COLLISION_RADIUS;
    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const nz = dz / dist;
      x = ob.x + nx * minDist;
      z = ob.z + nz * minDist;
    }
  }

  return [x, pos[1], z];
}

function distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

const initialState = {
  status: 'menu' as GameStatus,
  gameMode: 'roguelike' as GameMode,
  hexConfig: null as HexConfig | null,
  time: 0,
  playerPosition: [0, 1.5, 0] as Vec3,
  playerRotation: 0,
  playerHealth: C.PLAYER_MAX_HEALTH,
  score: 0,
  xp: 0,
  level: 1,
  globalStats: { ...INITIAL_GLOBAL_STATS },
  weaponRunStats: {
    cannon: { ...INITIAL_WEAPON_RUN_STATS },
    homing_missile: { ...INITIAL_WEAPON_RUN_STATS },
    shotgun: { ...INITIAL_WEAPON_RUN_STATS },
    railgun: { ...INITIAL_WEAPON_RUN_STATS },
    tesla: { ...INITIAL_WEAPON_RUN_STATS },
    mortar: { ...INITIAL_WEAPON_RUN_STATS },
  } as Record<WeaponId, WeaponRunStats>,
  levelUpChoices: [] as LevelUpChoice[],
  moveInput: { x: 0, y: 0 },
  lookInput: { x: 0 },
  isFiring: false,
  weaponFireTimers: {} as Record<string, number>,
  pendingShots: [] as { weaponId: WeaponId; fireAt: number }[],
  kills: 0,
  runScrapEarned: 0,
  runCoresEarned: 0,
  enemies: [] as Enemy[],
  projectiles: [] as Projectile[],
  hitEffects: [] as HitEffect[],
  waveNumber: 0,
  enemiesRemainingToSpawn: 0,
  lastSpawnTime: 0,
  waveActive: false,
  lastWaveEndTime: 0,
  activeQuest: null as Quest | null,
  questsCompleted: 0,
  rewardPopup: null as { text: string; time: number } | null,
  portalChoices: [] as { hex: HexConfig; position: Vec3 }[],
  garagePortalPosition: [0, 0, 0] as Vec3,
  chainCount: 0,
  totalEnemiesInHex: 0,
  enemiesKilledInHex: 0,
  surviveTimer: 0,
  surviveTarget: 0,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  startGame: (mode: GameMode = 'roguelike', hex?: HexConfig) => {
    nextId = 0;

    if (mode === 'territory' && hex) {
      // Territory mode: bounded, finite enemies, victory condition
      const waveEnemies = Math.min(hex.enemyCount, 6);
      set({
        ...initialState,
        status: 'playing',
        gameMode: 'territory',
        hexConfig: hex,
        waveNumber: 1,
        enemiesRemainingToSpawn: waveEnemies,
        waveActive: true,
        lastSpawnTime: -C.WAVE_SPAWN_INTERVAL,
        totalEnemiesInHex: hex.enemyCount,
        enemiesKilledInHex: 0,
        surviveTimer: 0,
        surviveTarget: hex.objective === 'survive' ? 120 : 0, // 2 min
      });
    } else {
      // Roguelike: infinite, no victory
      set({
        ...initialState,
        status: 'playing',
        gameMode: 'roguelike',
        hexConfig: null,
        waveNumber: 1,
        enemiesRemainingToSpawn: C.WAVE_BASE_ENEMIES,
        waveActive: true,
        lastSpawnTime: -C.WAVE_SPAWN_INTERVAL,
      });
    }
  },

  continueToHex: (hex: HexConfig) => {
    const state = get();
    // Keep: level, globalStats, weaponRunStats, score, xp, kills, earnings
    // Reset: enemies, projectiles, quest, wave, position, health (heal 50%)
    const metaState = useMetaStore.getState();
    const eff = getEffective(state.globalStats, metaState.tankUpgrades);
    const waveEnemies = Math.min(hex.enemyCount, 4 + hex.difficulty);

    set({
      status: 'playing',
      hexConfig: hex,
      chainCount: state.chainCount + 1,
      playerPosition: [0, 1.5, 0] as Vec3,
      playerRotation: 0,
      playerHealth: Math.min(eff.maxHealth, state.playerHealth + eff.maxHealth * 0.5),
      enemies: [],
      projectiles: [],
      hitEffects: [],
      activeQuest: null,
      questsCompleted: state.questsCompleted,
      portalChoices: [],
      waveNumber: 1,
      enemiesRemainingToSpawn: waveEnemies,
      lastSpawnTime: -C.WAVE_SPAWN_INTERVAL,
      waveActive: true,
      lastWaveEndTime: 0,
      totalEnemiesInHex: hex.enemyCount,
      enemiesKilledInHex: 0,
      surviveTimer: 0,
      surviveTarget: hex.objective === 'survive' ? 120 : 0,
      weaponFireTimers: {},
      pendingShots: [],
      rewardPopup: null,
    });
  },

  setMoveInput: (input) => set({ moveInput: input }),
  setLookInput: (input) => set({ lookInput: input }),
  setIsFiring: (firing) => set({ isFiring: firing }),

  chooseLevelUp: (choice: LevelUpChoice) => {
    const state = get();
    const tank = useMetaStore.getState().tankUpgrades;

    if (choice.type === 'global') {
      const newGlobal = { ...state.globalStats, [choice.statId]: state.globalStats[choice.statId] + 1 };
      const eff = getEffective(newGlobal, tank);
      set({
        globalStats: newGlobal,
        levelUpChoices: [],
        status: 'playing',
        playerHealth: Math.min(eff.maxHealth, state.playerHealth + 25),
      });
    } else {
      const current = state.weaponRunStats[choice.weaponId] ?? { ...INITIAL_WEAPON_RUN_STATS };
      const newWeaponStats = {
        ...state.weaponRunStats,
        [choice.weaponId]: { ...current, [choice.statId]: current[choice.statId] + 1 },
      };
      set({
        weaponRunStats: newWeaponStats,
        levelUpChoices: [],
        status: 'playing',
        playerHealth: Math.min(
          getEffective(state.globalStats, tank).maxHealth,
          state.playerHealth + 25,
        ),
      });
    }
  },

  updateGame: (delta: number) => {
    const state = get();

    // Portal choice mode: allow movement + check portal proximity
    if (state.status === 'portal_choice') {
      const { moveInput, lookInput, playerPosition, playerRotation, portalChoices, garagePortalPosition } = state;
      const metaS = useMetaStore.getState();
      const eff2 = getEffective(state.globalStats, metaS.tankUpgrades);
      let rot = playerRotation;
      rot += lookInput.x * eff2.rotationSpeed * delta;
      rot -= moveInput.x * eff2.rotationSpeed * delta;
      const fwd = moveInput.y;
      const pos: Vec3 = [
        playerPosition[0] + (-Math.sin(rot) * fwd * eff2.moveSpeed * delta),
        playerPosition[1],
        playerPosition[2] + (-Math.cos(rot) * fwd * eff2.moveSpeed * delta),
      ];

      // Check portal proximity
      const PORTAL_RANGE = 6;
      for (const choice of portalChoices) {
        const dx = pos[0] - choice.position[0];
        const dz = pos[2] - choice.position[2];
        if (dx * dx + dz * dz < PORTAL_RANGE * PORTAL_RANGE) {
          get().continueToHex(choice.hex);
          return;
        }
      }
      // Garage portal
      const gdx = pos[0] - garagePortalPosition[0];
      const gdz = pos[2] - garagePortalPosition[2];
      if (gdx * gdx + gdz * gdz < PORTAL_RANGE * PORTAL_RANGE) {
        set({ status: 'victory' });
        return;
      }

      set({ playerPosition: pos, playerRotation: rot, time: state.time + delta });
      return;
    }

    if (state.status !== 'playing') return;

    const metaState = useMetaStore.getState();
    const eff = getEffective(state.globalStats, metaState.tankUpgrades);
    const time = state.time + delta;
    let {
      playerPosition,
      playerRotation,
      playerHealth,
      score,
      xp,
      level,
      enemies,
      projectiles,
      hitEffects,
      waveNumber,
      enemiesRemainingToSpawn,
      lastSpawnTime,
      waveActive,
      lastWaveEndTime,
      activeQuest,
      questsCompleted,
      rewardPopup,
      totalEnemiesInHex,
      enemiesKilledInHex,
      surviveTimer,
      surviveTarget,
      moveInput,
      lookInput,
      weaponFireTimers,
      pendingShots,
      kills,
      runScrapEarned,
      runCoresEarned,
    } = state;

    // --- Get equipped weapons from meta store ---
    const equippedWeapons = metaState.equippedWeapons;
    const weaponUpgrades = metaState.weaponUpgrades;

    // --- HP Regen ---
    if (eff.hpRegen > 0 && playerHealth < eff.maxHealth) {
      playerHealth = Math.min(eff.maxHealth, playerHealth + eff.hpRegen * delta);
    }

    // --- Player movement ---
    playerRotation += lookInput.x * eff.rotationSpeed * delta;
    playerRotation -= moveInput.x * eff.rotationSpeed * delta;

    // --- Aim assist (mobile only) ---
    if (Platform.OS !== 'web' && enemies.length > 0) {
      const AIM_CONE = 0.25; // ~14° cone
      const PULL_STRENGTH = 3; // how fast aim pulls toward target
      const STICKY_FACTOR = 0.4; // slow down rotation when near target

      let bestAngle = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const edx = e.position[0] - playerPosition[0];
        const edz = e.position[2] - playerPosition[2];
        let angleToEnemy = Math.atan2(-edx, -edz) - playerRotation;
        while (angleToEnemy > Math.PI) angleToEnemy -= Math.PI * 2;
        while (angleToEnemy < -Math.PI) angleToEnemy += Math.PI * 2;
        if (Math.abs(angleToEnemy) < Math.abs(bestAngle)) {
          bestAngle = angleToEnemy;
        }
      }

      if (Math.abs(bestAngle) < AIM_CONE) {
        // Pull toward target
        playerRotation += bestAngle * PULL_STRENGTH * delta;
        // Sticky: dampen any manual rotation when near a target
        if (lookInput.x !== 0 || moveInput.x !== 0) {
          playerRotation -= (lookInput.x * eff.rotationSpeed * delta) * STICKY_FACTOR;
          playerRotation += (moveInput.x * eff.rotationSpeed * delta) * STICKY_FACTOR;
        }
      }
    }

    const forward = moveInput.y;
    const dx = -Math.sin(playerRotation) * forward * eff.moveSpeed * delta;
    const dz = -Math.cos(playerRotation) * forward * eff.moveSpeed * delta;
    playerPosition = collideWithObstacles([
      playerPosition[0] + dx,
      playerPosition[1],
      playerPosition[2] + dz,
    ]);

    // --- Helper: fire a weapon (used for primary fire + multi-shot) ---
    // --- Build unified target list (enemies + quest targets) ---
    interface Target { id: string; position: Vec3; alive: boolean }
    const allTargets: Target[] = [
      ...enemies.filter((e) => e.alive),
      ...((activeQuest?.status === 'active' ? activeQuest.targets : [])
        .filter((t) => t.alive)),
    ];

    const FOV_HALF = Math.PI / 3; // ~60° each side, generous acquisition cone

    function isInFieldOfView(targetPos: Vec3): boolean {
      const dx = targetPos[0] - playerPosition[0];
      const dz = targetPos[2] - playerPosition[2];
      // Player forward direction: (-sin(rot), -cos(rot))
      let angleToTarget = Math.atan2(-dx, -dz) - playerRotation;
      while (angleToTarget > Math.PI) angleToTarget -= Math.PI * 2;
      while (angleToTarget < -Math.PI) angleToTarget += Math.PI * 2;
      return Math.abs(angleToTarget) < FOV_HALF;
    }

    function findClosestTarget(from: Vec3, maxRange?: number): Target | null {
      let best: Target | null = null;
      let bestDist = maxRange ?? Infinity;
      for (const t of allTargets) {
        if (!isInFieldOfView(t.position)) continue;
        const d = distance(from, t.position);
        if (d < bestDist) { bestDist = d; best = t; }
      }
      return best;
    }

    function fireWeapon(weaponId: WeaponId) {
      const wEff = getWeaponEffective(weaponId, weaponUpgrades[weaponId]);
      const wRunStats = getWeaponRunEffective(state.weaponRunStats[weaponId] ?? INITIAL_WEAPON_RUN_STATS);
      const adjustedDamage = wEff.damage + wRunStats.damageBonus;
      const adjustedLifetime = wEff.projectileLifetime + wRunStats.rangeBonus;

        if (wEff.type === 'direct') {
          const dir: Vec3 = [
            -Math.sin(playerRotation),
            0,
            -Math.cos(playerRotation),
          ];
          projectiles = [
            ...projectiles,
            {
              id: uid(),
              position: [
                playerPosition[0] + dir[0] * 4,
                playerPosition[1],
                playerPosition[2] + dir[2] * 4,
              ] as Vec3,
              direction: dir,
              speed: wEff.projectileSpeed,
              owner: 'player',
              spawnTime: time,
              lifetime: adjustedLifetime,
              damage: adjustedDamage,
              weaponType: 'direct',
            },
          ];
        } else if (wEff.type === 'homing') {
          const target = findClosestTarget(playerPosition);
          if (!target) return;
          const dir = normalize([
            target.position[0] - playerPosition[0], 0,
            target.position[2] - playerPosition[2],
          ]);
          projectiles = [...projectiles, {
            id: uid(),
            position: [playerPosition[0] + dir[0] * 4, playerPosition[1] + 1, playerPosition[2] + dir[2] * 4] as Vec3,
            direction: dir, speed: wEff.projectileSpeed, owner: 'player',
            spawnTime: time, lifetime: adjustedLifetime, damage: adjustedDamage,
            weaponType: 'homing', targetId: target.id,
          }];

        } else if (wEff.type === 'shotgun') {
          const baseDir = playerRotation;
          const pelletCount = Math.round((wEff.extra.pellets ?? 5) + wRunStats.pelletBonus);
          const spreadAngle = Math.max(0.05, (wEff.extra.spread ?? 0.4) * (1 - wRunStats.spreadReduction));
          for (let i = 0; i < pelletCount; i++) {
            const offset = (i - (pelletCount - 1) / 2) * (spreadAngle / pelletCount);
            const angle = baseDir + offset;
            const dir: Vec3 = [-Math.sin(angle), 0, -Math.cos(angle)];
            projectiles = [...projectiles, {
              id: uid(),
              position: [playerPosition[0] + dir[0] * 4, playerPosition[1], playerPosition[2] + dir[2] * 4] as Vec3,
              direction: dir, speed: wEff.projectileSpeed + (Math.random() - 0.5) * 10,
              owner: 'player', spawnTime: time, lifetime: adjustedLifetime,
              damage: adjustedDamage, weaponType: 'shotgun',
            }];
          }

        } else if (wEff.type === 'railgun') {
          const dir: Vec3 = [-Math.sin(playerRotation), 0, -Math.cos(playerRotation)];
          const pierces = Math.round((wEff.extra.pierceCount ?? 3) + wRunStats.pierceBonus);
          projectiles = [...projectiles, {
            id: uid(),
            position: [playerPosition[0] + dir[0] * 4, playerPosition[1], playerPosition[2] + dir[2] * 4] as Vec3,
            direction: dir, speed: wEff.projectileSpeed, owner: 'player',
            spawnTime: time, lifetime: adjustedLifetime, damage: adjustedDamage,
            weaponType: 'railgun', piercesLeft: pierces,
          }];

        } else if (wEff.type === 'tesla') {
          const target = findClosestTarget(playerPosition, 60);
          if (!target) return;
          const chains = Math.round((wEff.extra.chainCount ?? 2) + wRunStats.chainCountBonus);
          const cRange = (wEff.extra.chainRange ?? 20) + wRunStats.chainRangeBonus;
          const dir = normalize([target.position[0] - playerPosition[0], 0, target.position[2] - playerPosition[2]]);
          projectiles = [...projectiles, {
            id: uid(),
            position: [...playerPosition] as Vec3,
            direction: dir, speed: 0, owner: 'player',
            spawnTime: time, lifetime: 0.3, damage: adjustedDamage,
            weaponType: 'tesla', targetId: target.id,
            chainTargets: [target.id], chainCount: chains, chainRange: cRange,
          }];

        } else if (wEff.type === 'mortar') {
          // Priority: hostile quest structures > enemies
          let landing: Vec3 | null = null;

          // Check quest structures first
          if (activeQuest && activeQuest.status === 'active') {
            let bestDist = Infinity;
            for (const s of activeQuest.structures) {
              if (s.health <= 0 || s.type !== 'hostile') continue;
              if (!isInFieldOfView(s.position)) continue;
              const d = distance(playerPosition, s.position);
              if (d < bestDist) { bestDist = d; landing = [...s.position] as Vec3; }
            }
          }

          // Fallback to closest target (enemy or quest target)
          if (!landing) {
            const target = findClosestTarget(playerPosition);
            if (target) landing = [...target.position] as Vec3;
          }

          if (!landing) return;
          const dir = normalize([landing[0] - playerPosition[0], 0, landing[2] - playerPosition[2]]);
          const bRadius = (wEff.extra.blastRadius ?? 8) + wRunStats.blastRadiusBonus;
          projectiles = [...projectiles, {
            id: uid(),
            position: [playerPosition[0], playerPosition[1] + 3, playerPosition[2]] as Vec3,
            direction: dir, speed: wEff.projectileSpeed, owner: 'player',
            spawnTime: time, lifetime: adjustedLifetime, damage: adjustedDamage,
            weaponType: 'mortar', landingPos: landing, blastRadius: bRadius,
            arcProgress: 0,
          }];
        }
    }

    // --- Process pending multi-shots ---
    pendingShots = pendingShots.filter((shot) => {
      if (time >= shot.fireAt) {
        fireWeapon(shot.weaponId);
        return false;
      }
      return true;
    });

    // --- Primary fire loop ---
    const newTimers = { ...weaponFireTimers };
    for (const weaponId of equippedWeapons) {
      const wEff = getWeaponEffective(weaponId, weaponUpgrades[weaponId]);
      const wRunStats = getWeaponRunEffective(state.weaponRunStats[weaponId] ?? INITIAL_WEAPON_RUN_STATS);
      const adjustedFireRate = Math.max(0.15, wEff.fireRate - wRunStats.fireRateBonus);
      const lastFire = newTimers[weaponId] ?? -999;

      if (time - lastFire > adjustedFireRate) {
        newTimers[weaponId] = time;
        fireWeapon(weaponId);

        // Schedule multi-shots
        const extraShots = wRunStats.multiShot;
        for (let s = 1; s <= extraShots; s++) {
          pendingShots = [...pendingShots, { weaponId, fireAt: time + s * 0.5 }];
        }
      }
    }
    weaponFireTimers = newTimers;

    // --- Spawn enemies ---
    if (waveActive && enemiesRemainingToSpawn > 0 && time - lastSpawnTime > C.WAVE_SPAWN_INTERVAL) {
      const pos = spawnEnemyPosition(playerPosition);
      // Enemies scale with wave number + hex difficulty
      const w = waveNumber - 1;
      const hexDiff = state.hexConfig?.difficulty ?? 0;
      // Territory chaining: difficulty multiplier (1x at diff 1, 2x at diff 2, 4x at diff 3...)
      const diffMult = state.gameMode === 'territory' && hexDiff > 0
        ? 1 + (hexDiff - 1) * 1.0
        : 1;
      const scaledHealth = Math.round(C.ENEMY_HEALTH * (1 + w * 0.2) * diffMult);
      const scaledDamage = Math.round(C.ENEMY_DAMAGE * (1 + w * 0.1) * diffMult);
      const scaledSpeed = C.ENEMY_SPEED * (1 + w * 0.05) * (1 + (diffMult - 1) * 0.3);
      const scaledFireRate = Math.max(0.4, C.ENEMY_FIRE_RATE * (1 - w * 0.04) * (1 / (1 + (diffMult - 1) * 0.2)));
      enemies = [
        ...enemies,
        {
          id: uid(),
          position: pos,
          rotation: Math.atan2(
            playerPosition[0] - pos[0],
            playerPosition[2] - pos[2]
          ),
          health: scaledHealth,
          maxHealth: scaledHealth,
          damage: scaledDamage,
          speed: scaledSpeed,
          fireRate: scaledFireRate,
          lastFireTime: time,
          alive: true,
        },
      ];
      enemiesRemainingToSpawn--;
      lastSpawnTime = time;
    }

    // --- Update enemies ---
    enemies = enemies.map((enemy) => {
      if (!enemy.alive) return enemy;

      const dist = distance(enemy.position, playerPosition);
      let { position, rotation, lastFireTime: eft } = enemy;

      const targetRot = Math.atan2(
        playerPosition[0] - position[0],
        playerPosition[2] - position[2]
      );
      let rotDiff = targetRot - rotation;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      rotation += Math.sign(rotDiff) * Math.min(Math.abs(rotDiff), 2 * delta);

      if (dist > 15) {
        const speed = enemy.speed * delta;
        position = collideWithObstacles([
          position[0] + Math.sin(rotation) * speed,
          0,
          position[2] + Math.cos(rotation) * speed,
        ]);
      }

      if (dist < C.ENEMY_AGGRO_RANGE && time - eft > enemy.fireRate) {
        eft = time;
        const dir = normalize([
          playerPosition[0] - position[0],
          0,
          playerPosition[2] - position[2],
        ]);
        projectiles = [
          ...projectiles,
          {
            id: uid(),
            position: [position[0], 1.5, position[2]] as Vec3,
            direction: dir,
            speed: C.PROJECTILE_SPEED * C.ENEMY_PROJECTILE_SPEED_MULT,
            owner: 'enemy',
            spawnTime: time,
            lifetime: C.PROJECTILE_LIFETIME,
            damage: enemy.damage,
            weaponType: 'direct',
          },
        ];
      }

      return { ...enemy, position, rotation, lastFireTime: eft };
    });

    // --- Update projectiles ---
    projectiles = projectiles
      .map((p) => {
        let dir = p.direction;
        let pos = p.position;
        let extra: Partial<Projectile> = {};

        if (p.weaponType === 'homing' && p.targetId) {
          const target = allTargets.find((t) => t.id === p.targetId && t.alive);
          if (target) {
            const toTarget = normalize([
              target.position[0] - pos[0], 0, target.position[2] - pos[2],
            ]);
            const turnRate = 4 * delta;
            dir = normalize([
              dir[0] + (toTarget[0] - dir[0]) * turnRate, 0,
              dir[2] + (toTarget[2] - dir[2]) * turnRate,
            ]);
          }
        }

        if (p.weaponType === 'mortar' && p.landingPos) {
          // Arc movement toward landing position
          const totalDist = Math.sqrt(
            (p.landingPos[0] - pos[0]) ** 2 + (p.landingPos[2] - pos[2]) ** 2
          );
          const progress = (p.arcProgress ?? 0) + delta * 0.8;
          const arcHeight = Math.sin(progress * Math.PI) * 15;
          extra.arcProgress = progress;
          if (progress >= 1 || totalDist < 2) {
            // Landing — explode
            pos = [...p.landingPos] as Vec3;
            extra.lifetime = 0; // trigger removal + explosion in collision
          } else {
            const t = delta * p.speed * 0.05;
            pos = [
              pos[0] + (p.landingPos[0] - pos[0]) * t,
              1.5 + arcHeight,
              pos[2] + (p.landingPos[2] - pos[2]) * t,
            ] as Vec3;
          }
          return { ...p, direction: dir, position: pos, ...extra };
        }

        if (p.weaponType === 'tesla') {
          // Tesla doesn't move, it's instant
          return p;
        }

        return {
          ...p,
          direction: dir,
          position: [
            pos[0] + dir[0] * p.speed * delta,
            pos[1],
            pos[2] + dir[2] * p.speed * delta,
          ] as Vec3,
          ...extra,
        };
      })
      .filter((p) => {
        const lifetime = p.lifetime;
        if (time - p.spawnTime >= lifetime) return false;
        const nearby = getObstaclesNear(p.position[0], p.position[2], 1);
        for (const ob of nearby) {
          const odx = p.position[0] - ob.x;
          const odz = p.position[2] - ob.z;
          if (odx * odx + odz * odz < ob.radius * ob.radius) return false;
        }
        return true;
      });

    // --- Helper: apply damage to enemy, track kills ---
    function damageEnemy(enemy: Enemy, dmg: number, effectPos: Vec3): Enemy {
      const newHealth = enemy.health - dmg;
      if (newHealth <= 0) {
        score += 100;
        xp += C.XP_PER_KILL;
        kills++;
        enemiesKilledInHex++;
        const scrapGain = 5 + Math.floor(Math.random() * 11);
        const coreGain = Math.random() < 0.05 ? 1 : 0;
        runScrapEarned += scrapGain;
        runCoresEarned += coreGain;
        useMetaStore.getState().addRunEarnings(scrapGain, coreGain);
        hitEffects = [...hitEffects, {
          id: uid(), position: [...enemy.position] as Vec3,
          spawnTime: time, type: 'destroy',
        }];
        return { ...enemy, health: 0, alive: false };
      }
      hitEffects = [...hitEffects, {
        id: uid(), position: [...effectPos] as Vec3,
        spawnTime: time, type: 'hit',
      }];
      return { ...enemy, health: newHealth };
    }

    // --- Collision: player projectiles vs enemies ---
    const hitProjectiles = new Set<string>();

    // Handle mortar explosions (on lifetime expire)
    projectiles = projectiles.map((p) => {
      if (p.weaponType !== 'mortar' || p.owner !== 'player') return p;
      if (p.arcProgress && p.arcProgress >= 1 && p.landingPos && p.blastRadius) {
        // AoE damage at landing
        enemies = enemies.map((e) => {
          if (!e.alive) return e;
          if (distance(e.position, p.landingPos!) < p.blastRadius!) {
            return damageEnemy(e, p.damage, p.landingPos!);
          }
          return e;
        });
        hitEffects = [...hitEffects, {
          id: uid(), position: [...p.landingPos] as Vec3,
          spawnTime: time, type: 'mortar_blast', blastRadius: p.blastRadius,
        }];
        hitProjectiles.add(p.id);
      }
      return p;
    });

    // Handle tesla chain hits (instant)
    for (const p of projectiles) {
      if (p.weaponType !== 'tesla' || p.owner !== 'player') continue;
      if (time - p.spawnTime < delta * 2) {
        // Only process on spawn frame
        const chainHit = new Set(p.chainTargets ?? []);
        const maxChains = (p.chainCount ?? 2) + 1; // +1 for initial target
        let lastPos = p.position;

        for (let c = 0; c < maxChains && chainHit.size <= maxChains; c++) {
          const targetId = c === 0 ? p.targetId : undefined;
          let hit: Target | undefined;

          if (targetId) {
            hit = allTargets.find((t) => t.id === targetId && t.alive);
          } else {
            // Find nearest target not yet chained
            let bestDist = p.chainRange ?? 20;
            for (const t of allTargets) {
              if (!t.alive || chainHit.has(t.id)) continue;
              const d = distance(lastPos as Vec3, t.position);
              if (d < bestDist) { bestDist = d; hit = t; }
            }
          }

          if (!hit) break;
          chainHit.add(hit.id);
          // Damage: check if it's a regular enemy or quest target
          const isRegularEnemy = enemies.some((e) => e.id === hit!.id);
          if (isRegularEnemy) {
            enemies = enemies.map((e) => e.id === hit!.id ? damageEnemy(e, p.damage, hit!.position) : e);
          } else if (activeQuest) {
            activeQuest.targets = activeQuest.targets.map((t) => {
              if (t.id !== hit!.id || !t.alive) return t;
              const newHp = t.health - p.damage;
              hitEffects = [...hitEffects, {
                id: uid(), position: [...t.position] as Vec3,
                spawnTime: time, type: newHp <= 0 ? 'destroy' : 'hit',
              }];
              return { ...t, health: Math.max(0, newHp), alive: newHp > 0 };
            });
          }
          lastPos = hit.position;
        }
        hitProjectiles.add(p.id);
      }
    }

    // Standard collision (direct, homing, shotgun, railgun)
    enemies = enemies.map((enemy) => {
      if (!enemy.alive) return enemy;
      for (const p of projectiles) {
        if (p.owner !== 'player' || hitProjectiles.has(p.id)) continue;
        if (p.weaponType === 'tesla' || p.weaponType === 'mortar') continue;
        if (distance(p.position, enemy.position) < 3) {
          if (p.weaponType === 'railgun') {
            // Pierce: don't consume projectile, decrement counter
            const newPierces = (p.piercesLeft ?? 1) - 1;
            if (newPierces <= 0) hitProjectiles.add(p.id);
            else p.piercesLeft = newPierces;
          } else {
            hitProjectiles.add(p.id);
          }
          return damageEnemy(enemy, p.damage, p.position);
        }
      }
      return enemy;
    });

    // --- Collision: enemy projectiles vs player ---
    for (const p of projectiles) {
      if (p.owner !== 'enemy' || hitProjectiles.has(p.id)) continue;
      if (distance(p.position, playerPosition) < 2.5) {
        hitProjectiles.add(p.id);
        const dmg = Math.max(1, p.damage - eff.armor);
        playerHealth -= dmg;
      }
    }

    // --- Collision: player projectiles vs enemy projectiles ---
    const playerProjs = projectiles.filter((p) => p.owner === 'player' && !hitProjectiles.has(p.id));
    const enemyProjs = projectiles.filter((p) => p.owner === 'enemy' && !hitProjectiles.has(p.id));
    for (const pp of playerProjs) {
      for (const ep of enemyProjs) {
        if (hitProjectiles.has(pp.id) || hitProjectiles.has(ep.id)) continue;
        if (distance(pp.position, ep.position) < 1.5) {
          hitProjectiles.add(pp.id);
          hitProjectiles.add(ep.id);
          hitEffects = [...hitEffects, {
            id: uid(), position: [...ep.position] as Vec3,
            spawnTime: time, type: 'hit',
          }];
        }
      }
    }

    // --- Remove dead enemies ---
    enemies = enemies.filter((e) => e.alive);

    // --- Expire hit effects ---
    hitEffects = hitEffects.filter((e) => {
      const duration = e.type === 'mortar_blast' ? 1.5 : e.type === 'destroy' ? 1.0 : 0.5;
      return time - e.spawnTime < duration;
    });

    // --- Expire reward popup ---
    if (rewardPopup && time - rewardPopup.time > 3) {
      rewardPopup = null;
    }

    // --- Level up ---
    let newStatus: GameStatus = 'playing';
    let levelUpChoices: LevelUpChoice[] = [];
    while (xp >= C.XP_PER_LEVEL) {
      xp -= C.XP_PER_LEVEL;
      level++;
      levelUpChoices = rollLevelUpChoices(
        state.globalStats,
        state.weaponRunStats,
        equippedWeapons,
        3,
      );
      newStatus = 'levelup';
    }

    // --- Update active quest ---
    if (activeQuest && activeQuest.status === 'active') {
      const q = activeQuest;

      // Update quest targets (move, fire like enemies)
      q.targets = q.targets.map((t) => {
        if (!t.alive) return t;
        let { position, rotation, lastFireTime: tft } = t;

        if (t.moveDirection) {
          // Intercept drones: move in escape direction
          position = [
            position[0] + t.moveDirection[0] * t.speed * delta,
            0,
            position[2] + t.moveDirection[2] * t.speed * delta,
          ];
        } else {
          // Normal quest targets: move toward player
          const dist = distance(position, playerPosition);
          const targetRot = Math.atan2(
            playerPosition[0] - position[0],
            playerPosition[2] - position[2]
          );
          let rotDiff = targetRot - rotation;
          while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
          while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
          rotation += Math.sign(rotDiff) * Math.min(Math.abs(rotDiff), 2 * delta);

          if (dist > 15) {
            position = [
              position[0] + Math.sin(rotation) * t.speed * delta,
              0,
              position[2] + Math.cos(rotation) * t.speed * delta,
            ];
          }

          if (dist < 60 && t.damage > 0 && time - tft > t.fireRate) {
            tft = time;
            const dir = normalize([
              playerPosition[0] - position[0], 0,
              playerPosition[2] - position[2],
            ]);
            projectiles = [...projectiles, {
              id: uid(), position: [position[0], 1.5, position[2]] as Vec3,
              direction: dir, speed: C.PROJECTILE_SPEED * C.ENEMY_PROJECTILE_SPEED_MULT,
              owner: 'enemy', spawnTime: time, lifetime: C.PROJECTILE_LIFETIME,
              damage: t.damage, weaponType: 'direct',
            }];
          }
        }
        return { ...t, position, rotation, lastFireTime: tft };
      });

      // Check player projectiles vs quest targets
      q.targets = q.targets.map((t) => {
        if (!t.alive) return t;
        for (const p of projectiles) {
          if (p.owner !== 'player' || hitProjectiles.has(p.id)) continue;
          if (distance(p.position, t.position) < 3.5) {
            hitProjectiles.add(p.id);
            const newHp = t.health - p.damage;
            if (newHp <= 0) {
              hitEffects = [...hitEffects, {
                id: uid(), position: [...t.position] as Vec3,
                spawnTime: time, type: 'destroy',
              }];
              return { ...t, health: 0, alive: false };
            }
            hitEffects = [...hitEffects, {
              id: uid(), position: [...p.position] as Vec3,
              spawnTime: time, type: 'hit',
            }];
            return { ...t, health: newHp };
          }
        }
        return t;
      });

      // Check player projectiles vs quest structures (hostile only)
      q.structures = q.structures.map((s) => {
        if (s.health <= 0 || s.type !== 'hostile') return s;
        for (const p of projectiles) {
          if (p.owner !== 'player' || hitProjectiles.has(p.id)) continue;
          const dx = p.position[0] - s.position[0];
          const dz = p.position[2] - s.position[2];
          if (Math.abs(dx) < s.width / 2 + 1 && Math.abs(dz) < s.depth / 2 + 1) {
            hitProjectiles.add(p.id);
            const newHp = s.health - p.damage;
            hitEffects = [...hitEffects, {
              id: uid(), position: [...p.position] as Vec3,
              spawnTime: time, type: newHp <= 0 ? 'destroy' : 'hit',
            }];
            return { ...s, health: Math.max(0, newHp) };
          }
        }
        return s;
      });

      // Enemy projectiles vs allied structures
      q.structures = q.structures.map((s) => {
        if (s.health <= 0 || s.type !== 'allied') return s;
        for (const p of projectiles) {
          if (p.owner !== 'enemy' || hitProjectiles.has(p.id)) continue;
          const dx = p.position[0] - s.position[0];
          const dz = p.position[2] - s.position[2];
          if (Math.abs(dx) < s.width / 2 + 1 && Math.abs(dz) < s.depth / 2 + 1) {
            hitProjectiles.add(p.id);
            return { ...s, health: Math.max(0, s.health - p.damage) };
          }
        }
        return s;
      });

      // Quest-type-specific logic
      switch (q.type) {
        case 'fetch_deliver': {
          if (!q.carrying && !q.objectives[0].completed) {
            if (distance(playerPosition, q.objectives[0].position) < q.objectives[0].radius) {
              q.objectives[0].completed = true;
              q.carrying = true;
              q.currentStep = 1;
            }
          } else if (q.carrying && !q.objectives[1].completed) {
            if (distance(playerPosition, q.objectives[1].position) < q.objectives[1].radius) {
              q.objectives[1].completed = true;
              q.carrying = false;
              q.status = 'completed';
            }
          }
          break;
        }
        case 'destroy_structure': {
          if (q.structures.every((s) => s.health <= 0)) q.status = 'completed';
          break;
        }
        case 'eliminate_target': {
          if (q.targets.every((t) => !t.alive)) q.status = 'completed';
          break;
        }
        case 'survive_zone': {
          const inZone = distance(playerPosition, q.objectives[0].position) < q.objectives[0].radius;
          if (inZone) {
            q.timerElapsed += delta;
          } else {
            q.timerElapsed = 0;
          }
          if (q.timerElapsed >= q.timerDuration) {
            q.objectives[0].completed = true;
            q.status = 'completed';
          }
          break;
        }
        case 'siege': {
          if (q.structures.every((s) => s.health <= 0)) q.status = 'completed';
          break;
        }
        case 'scavenge': {
          q.items = q.items.map((it, idx) => {
            if (it.collected) return it;
            if (distance(playerPosition, it.position) < q.objectives[idx].radius) {
              q.objectives[idx].completed = true;
              return { ...it, collected: true };
            }
            return it;
          });
          if (q.items.every((it) => it.collected)) q.status = 'completed';
          break;
        }
        case 'recon': {
          q.objectives = q.objectives.map((obj) => {
            if (obj.completed) return obj;
            if (distance(playerPosition, obj.position) < obj.radius) {
              return { ...obj, completed: true };
            }
            return obj;
          });
          if (q.objectives.every((o) => o.completed)) q.status = 'completed';
          break;
        }
        case 'defend': {
          const allied = q.structures.find((s) => s.type === 'allied');
          if (allied && allied.health <= 0) {
            q.status = 'failed';
          } else {
            const inZone = distance(playerPosition, q.objectives[0].position) < q.objectives[0].radius;
            if (inZone) {
              q.timerElapsed += delta;
            } else {
              q.timerElapsed = 0;
            }
            if (q.timerElapsed >= q.timerDuration) {
              q.objectives[0].completed = true;
              q.status = 'completed';
            }
          }
          break;
        }
        case 'intercept': {
          // Fail if any drone escapes too far
          const anyEscaped = q.targets.some((t) =>
            t.alive && distance(t.position, q.objectives[0].position) > 150
          );
          if (anyEscaped) q.status = 'failed';
          if (q.targets.every((t) => !t.alive)) q.status = 'completed';
          break;
        }
        case 'purge': {
          if (q.targets.every((t) => !t.alive)) q.status = 'completed';
          break;
        }
      }

      // Quest completed — give reward
      if (q.status === 'completed') {
        runCoresEarned += q.coreReward;
        useMetaStore.getState().addRunEarnings(0, q.coreReward);
        score += q.coreReward * 50;
        questsCompleted++;
        activeQuest = null;
        rewardPopup = { text: `+${q.coreReward} CORES`, time };
      } else if (q.status === 'failed') {
        activeQuest = null;
        rewardPopup = { text: 'QUEST FAILED', time };
      } else {
        // Create a new reference so Zustand detects the change
        activeQuest = { ...q };
      }

    }

    // --- Clean up hit projectiles (after both enemy and quest collisions) ---
    projectiles = projectiles.filter((p) => !hitProjectiles.has(p.id));

    // --- Territory: survive timer ---
    if (state.gameMode === 'territory' && surviveTarget > 0) {
      surviveTimer += delta;
    }

    // --- Check wave completion ---
    if (waveActive && enemiesRemainingToSpawn === 0) {
      if (enemies.length === 0 && lastWaveEndTime === 0) {
        lastWaveEndTime = time;
      }
      if (lastWaveEndTime === 0 && lastSpawnTime > 0) {
        const timeSinceLastSpawn = time - lastSpawnTime;
        if (timeSinceLastSpawn > 10) {
          lastWaveEndTime = time;
        }
      }
      if (lastWaveEndTime > 0 && time - lastWaveEndTime > 2) {
        waveNumber++;
        lastWaveEndTime = 0;

        if (state.gameMode === 'territory' && state.hexConfig) {
          // Territory: spawn next wave if enemies remain
          const remaining = totalEnemiesInHex - enemiesKilledInHex;
          if (remaining > 0) {
            const nextWaveSize = Math.min(remaining, 4 + state.hexConfig.difficulty);
            enemiesRemainingToSpawn = nextWaveSize;
            lastSpawnTime = time;
          }
        } else {
          // Roguelike: infinite scaling waves
          enemiesRemainingToSpawn = C.WAVE_BASE_ENEMIES + (waveNumber - 1) * C.WAVE_ENEMY_INCREMENT;
          lastSpawnTime = time;
        }

        if (!activeQuest && waveNumber % 2 === 0) {
          activeQuest = rollQuest(playerPosition, waveNumber);
        }
      }
    }

    // --- Check victory (territory mode) ---
    if (state.gameMode === 'territory' && state.hexConfig && newStatus === 'playing') {
      const hex = state.hexConfig;
      let objectiveComplete = false;

      switch (hex.objective) {
        case 'kill_all':
          objectiveComplete = enemiesKilledInHex >= totalEnemiesInHex && enemies.length === 0;
          break;
        case 'destroy_base':
          objectiveComplete = enemiesKilledInHex >= totalEnemiesInHex && enemies.length === 0;
          break;
        case 'survive':
          objectiveComplete = surviveTimer >= surviveTarget;
          break;
        case 'boss':
          objectiveComplete = enemiesKilledInHex >= totalEnemiesInHex && enemies.length === 0;
          break;
      }

      // Must also complete any active quest
      const questDone = !activeQuest || activeQuest.status !== 'active';
      const victory = objectiveComplete && questDone;

      if (victory) {
        newStatus = 'portal_choice';
        const meta = useMetaStore.getState();
        meta.collectPending();
        meta.addRunEarnings(hex.reward.scrap, hex.reward.cores);
        meta.collectPending();
        meta.updateRunStats(kills, waveNumber, score);

        // Non-blocking Firestore save
        const user = getCurrentUser();
        if (user) {
          saveRunData(user.uid, {
            mode: state.gameMode, score, wave: waveNumber, kills, level,
            duration: Math.round(time),
            scrapEarned: runScrapEarned, coresEarned: runCoresEarned,
            equippedWeapons: metaState.equippedWeapons,
            hexDifficulty: hex.difficulty,
            hexBiome: hex.biome,
            chainCount: state.chainCount,
            survived: true,
            questsCompleted,
          });
          const territory = useTerritoryStore.getState();
          saveUserProfile(user.uid, {
            totalRuns: meta.totalRuns, totalKills: meta.totalKills,
            bestWave: meta.bestWave, bestScore: meta.bestScore,
            scrap: meta.scrap, cores: meta.cores,
            unlockedWeapons: meta.unlockedWeapons,
            equippedWeapons: meta.equippedWeapons,
            conqueredHexes: territory.conquered.size - 1,
            tankUpgrades: meta.tankUpgrades as unknown as Record<string, number>,
          });
        }

        // Conquer this hex
        useTerritoryStore.getState().conquer(hex.coord);

        // Generate 2 adjacent unconquered hexes as portal choices
        const conquered = useTerritoryStore.getState().conquered;
        const neighbors = hexNeighbors(hex.coord)
          .filter((n) => !conquered.has(hexKey(n)))
          .map((n) => generateHexTile(n));

        // Sort by difficulty, pick easiest and hardest available
        neighbors.sort((a, b) => a.difficulty - b.difficulty);
        const choices: { hex: HexConfig; position: Vec3 }[] = [];
        const pp = playerPosition;

        // Chain multiplier: x2 rewards per chain
        const chainMult = 1 + state.chainCount;

        function makeHexConfig(tile: HexTile): HexConfig {
          return {
            coord: tile.coord, biome: tile.biome, objective: tile.objective,
            difficulty: tile.difficulty, enemyCount: tile.enemyCount, bossWave: tile.bossWave,
            reward: {
              scrap: Math.round(tile.reward.scrap * chainMult),
              cores: Math.round(tile.reward.cores * chainMult),
            },
          };
        }

        if (neighbors.length >= 2) {
          const easy = neighbors[0];
          const hard = neighbors[neighbors.length - 1];
          const fwd: Vec3 = [-Math.sin(playerRotation), 0, -Math.cos(playerRotation)];
          const right: Vec3 = [-fwd[2], 0, fwd[0]];
          choices.push({
            hex: makeHexConfig(easy),
            position: [pp[0] + fwd[0] * 30 - right[0] * 15, 0, pp[2] + fwd[2] * 30 - right[2] * 15],
          });
          choices.push({
            hex: makeHexConfig(hard),
            position: [pp[0] + fwd[0] * 30 + right[0] * 15, 0, pp[2] + fwd[2] * 30 + right[2] * 15],
          });
        } else if (neighbors.length === 1) {
          const n = neighbors[0];
          const fwd: Vec3 = [-Math.sin(playerRotation), 0, -Math.cos(playerRotation)];
          choices.push({
            hex: makeHexConfig(n),
            position: [pp[0] + fwd[0] * 30, 0, pp[2] + fwd[2] * 30],
          });
        }

        // Garage portal behind the player
        const back: Vec3 = [Math.sin(playerRotation), 0, Math.cos(playerRotation)];
        const garagePos: Vec3 = [pp[0] + back[0] * 25, 0, pp[2] + back[2] * 25];

        rewardPopup = { text: `+${hex.reward.scrap}S +${hex.reward.cores}C`, time };
        set({ portalChoices: choices, garagePortalPosition: garagePos });
      }
    }

    // --- Check death ---
    if (playerHealth <= 0) {
      newStatus = 'dead';
      const meta = useMetaStore.getState();
      meta.collectPending();
      meta.updateRunStats(kills, waveNumber, score);
      meta.addWreckage(playerPosition[0], playerPosition[2], waveNumber, score);

      // Non-blocking Firestore save
      const user = getCurrentUser();
      if (user) {
        saveRunData(user.uid, {
          mode: state.gameMode, score, wave: waveNumber, kills, level,
          duration: Math.round(time),
          scrapEarned: runScrapEarned, coresEarned: runCoresEarned,
          equippedWeapons: metaState.equippedWeapons,
          hexDifficulty: state.hexConfig?.difficulty,
          hexBiome: state.hexConfig?.biome,
          chainCount: state.chainCount,
          survived: false,
          questsCompleted,
          deathWave: waveNumber,
        });
        const territory = useTerritoryStore.getState();
        saveUserProfile(user.uid, {
          totalRuns: meta.totalRuns, totalKills: meta.totalKills,
          bestWave: meta.bestWave, bestScore: meta.bestScore,
          scrap: meta.scrap, cores: meta.cores,
          unlockedWeapons: meta.unlockedWeapons,
          equippedWeapons: meta.equippedWeapons,
          conqueredHexes: territory.conquered.size - 1,
          tankUpgrades: meta.tankUpgrades as unknown as Record<string, number>,
        });
      }
    }

    set({
      time,
      playerPosition,
      playerRotation,
      playerHealth: Math.max(0, playerHealth),
      score,
      xp,
      level,
      enemies,
      projectiles,
      hitEffects,
      kills,
      runScrapEarned,
      runCoresEarned,
      waveNumber,
      enemiesRemainingToSpawn,
      lastSpawnTime,
      waveActive,
      activeQuest,
      questsCompleted,
      rewardPopup,
      totalEnemiesInHex,
      enemiesKilledInHex,
      surviveTimer,
      lastWaveEndTime,
      weaponFireTimers,
      pendingShots,
      status: newStatus,
      levelUpChoices,
    });
  },
}));
