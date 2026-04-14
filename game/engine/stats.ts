import type { WeaponId, WEAPON_DEFS } from './weapons';
import { PLAYER_MAX_HEALTH } from './constants';

// --- Global stats (tank-wide) ---

export type GlobalStatId =
  | 'maxHealth'
  | 'moveSpeed'
  | 'hpRegen'
  | 'rotationSpeed'
  | 'armor';

export interface StatDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  perLevel: number;
}

export const GLOBAL_STAT_DEFS: Record<GlobalStatId, StatDef> = {
  maxHealth: {
    id: 'maxHealth',
    name: 'HULL PLATING',
    description: '+20 HP max',
    icon: '[+]',
    maxLevel: 10,
    perLevel: 20,
  },
  moveSpeed: {
    id: 'moveSpeed',
    name: 'ENGINE BOOST',
    description: '+1.5 move speed',
    icon: '>>>',
    maxLevel: 8,
    perLevel: 1.5,
  },
  hpRegen: {
    id: 'hpRegen',
    name: 'NANO REPAIR',
    description: '+2 HP/sec',
    icon: '{+}',
    maxLevel: 8,
    perLevel: 2,
  },
  rotationSpeed: {
    id: 'rotationSpeed',
    name: 'TURRET MOTOR',
    description: '+0.3 rotation speed',
    icon: '<=>',
    maxLevel: 6,
    perLevel: 0.3,
  },
  armor: {
    id: 'armor',
    name: 'REACTIVE ARMOR',
    description: '-2 damage taken',
    icon: '[#]',
    maxLevel: 8,
    perLevel: 2,
  },
};

export type GlobalStats = Record<GlobalStatId, number>;

export const INITIAL_GLOBAL_STATS: GlobalStats = {
  maxHealth: 0,
  moveSpeed: 0,
  hpRegen: 0,
  rotationSpeed: 0,
  armor: 0,
};

// --- Per-weapon stats (in-run) ---
// Generic stats available to all weapons
export type GenericWeaponStatId = 'damage' | 'fireRate' | 'range';

// Weapon-specific stats
export type SpecificWeaponStatId =
  | 'multiShot'    // all weapons: +1 extra shot (500ms delay)
  | 'pellets'      // shotgun: +1 pellet
  | 'spread'       // shotgun: tighter spread
  | 'pierceCount'  // railgun: +1 pierce
  | 'chainCount'   // tesla: +1 chain
  | 'chainRange'   // tesla: +5 chain range
  | 'blastRadius'; // mortar: +2 blast radius

export type WeaponStatId = GenericWeaponStatId | SpecificWeaponStatId;

export interface WeaponStatDef extends StatDef {
  /** Which weapons this stat applies to. undefined = all weapons */
  weapons?: WeaponId[];
}

export const WEAPON_STAT_DEFS: Record<WeaponStatId, WeaponStatDef> = {
  // Generic (all weapons)
  damage: {
    id: 'damage', name: 'DAMAGE', description: '+8 damage',
    icon: '(!)', maxLevel: 10, perLevel: 8,
  },
  fireRate: {
    id: 'fireRate', name: 'FIRE RATE', description: '-0.08s cooldown',
    icon: '>>|', maxLevel: 8, perLevel: 0.08,
  },
  range: {
    id: 'range', name: 'RANGE', description: '+0.5s projectile life',
    icon: '|->', maxLevel: 6, perLevel: 0.5,
  },
  // Epic: all weapons
  multiShot: {
    id: 'multiShot', name: 'MULTI-SHOT', description: '+1 extra shot (500ms delay)',
    icon: 'x2', maxLevel: 3, perLevel: 1,
  },
  // Shotgun specific
  pellets: {
    id: 'pellets', name: 'PELLET COUNT', description: '+1 pellet',
    icon: ':::', maxLevel: 5, perLevel: 1,
    weapons: ['shotgun'],
  },
  spread: {
    id: 'spread', name: 'TIGHTER SPREAD', description: '-15% spread angle',
    icon: '><', maxLevel: 5, perLevel: 0.15,
    weapons: ['shotgun'],
  },
  // Railgun specific
  pierceCount: {
    id: 'pierceCount', name: 'PENETRATION', description: '+1 pierce target',
    icon: '>>>', maxLevel: 5, perLevel: 1,
    weapons: ['railgun'],
  },
  // Tesla specific
  chainCount: {
    id: 'chainCount', name: 'CHAIN JUMP', description: '+1 chain target',
    icon: '/\\/\\', maxLevel: 5, perLevel: 1,
    weapons: ['tesla'],
  },
  chainRange: {
    id: 'chainRange', name: 'CHAIN REACH', description: '+5 chain range',
    icon: '~~>', maxLevel: 5, perLevel: 5,
    weapons: ['tesla'],
  },
  // Mortar specific
  blastRadius: {
    id: 'blastRadius', name: 'BLAST RADIUS', description: '+2 explosion size',
    icon: '(O)', maxLevel: 6, perLevel: 2,
    weapons: ['mortar'],
  },
};

export type WeaponRunStats = Record<WeaponStatId, number>;

export const INITIAL_WEAPON_RUN_STATS: WeaponRunStats = {
  damage: 0,
  fireRate: 0,
  range: 0,
  multiShot: 0,
  pellets: 0,
  spread: 0,
  pierceCount: 0,
  chainCount: 0,
  chainRange: 0,
  blastRadius: 0,
};

// --- Level-up choice ---

export type LevelUpChoice =
  | { type: 'global'; statId: GlobalStatId }
  | { type: 'weapon'; weaponId: WeaponId; statId: WeaponStatId };

/** Roll N unique level-up choices from global + weapon pools */
export function rollLevelUpChoices(
  globalStats: GlobalStats,
  weaponRunStats: Record<WeaponId, WeaponRunStats>,
  equippedWeapons: WeaponId[],
  count: number,
): LevelUpChoice[] {
  const pool: LevelUpChoice[] = [];

  // Global stat choices
  for (const id of Object.keys(GLOBAL_STAT_DEFS) as GlobalStatId[]) {
    if (globalStats[id] < GLOBAL_STAT_DEFS[id].maxLevel) {
      pool.push({ type: 'global', statId: id });
    }
  }

  // Per-weapon stat choices (generic + weapon-specific)
  for (const weaponId of equippedWeapons) {
    const wStats = weaponRunStats[weaponId];
    if (!wStats) continue;
    for (const [id, def] of Object.entries(WEAPON_STAT_DEFS) as [WeaponStatId, WeaponStatDef][]) {
      // Skip if this stat doesn't apply to this weapon
      if (def.weapons && !def.weapons.includes(weaponId)) continue;
      if (wStats[id] < def.maxLevel) {
        pool.push({ type: 'weapon', weaponId, statId: id });
      }
    }
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// --- Permanent tank upgrades (meta-progression) ---

export interface TankUpgradeDef {
  id: GlobalStatId;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  perLevel: number; // 50% of in-run value
  baseCost: number; // scrap cost for level 1
  costMultiplier: number; // cost * multiplier per level
}

export const TANK_UPGRADE_DEFS: Record<GlobalStatId, TankUpgradeDef> = {
  maxHealth: {
    id: 'maxHealth', name: 'HULL REINFORCEMENT', description: '+10 base HP',
    icon: '[+]', maxLevel: 5, perLevel: 10, baseCost: 100, costMultiplier: 1.8,
  },
  moveSpeed: {
    id: 'moveSpeed', name: 'ENGINE OVERHAUL', description: '+0.75 base speed',
    icon: '>>>', maxLevel: 5, perLevel: 0.75, baseCost: 120, costMultiplier: 1.8,
  },
  hpRegen: {
    id: 'hpRegen', name: 'REPAIR SYSTEMS', description: '+1 base HP/sec',
    icon: '{+}', maxLevel: 5, perLevel: 1, baseCost: 150, costMultiplier: 2,
  },
  rotationSpeed: {
    id: 'rotationSpeed', name: 'TURRET BEARINGS', description: '+0.15 base rotation',
    icon: '<=>', maxLevel: 5, perLevel: 0.15, baseCost: 100, costMultiplier: 1.8,
  },
  armor: {
    id: 'armor', name: 'PLATING UPGRADE', description: '-1 base damage taken',
    icon: '[#]', maxLevel: 5, perLevel: 1, baseCost: 130, costMultiplier: 2,
  },
};

export type TankUpgrades = Record<GlobalStatId, number>;

export const INITIAL_TANK_UPGRADES: TankUpgrades = {
  maxHealth: 0,
  moveSpeed: 0,
  hpRegen: 0,
  rotationSpeed: 0,
  armor: 0,
};

export function getTankUpgradeCost(statId: GlobalStatId, currentLevel: number): number {
  const def = TANK_UPGRADE_DEFS[statId];
  return Math.round(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

/** Compute effective global values (permanent + in-run) */
export function getEffective(runStats: GlobalStats, tankUpgrades?: TankUpgrades) {
  const t = tankUpgrades ?? INITIAL_TANK_UPGRADES;
  return {
    maxHealth: PLAYER_MAX_HEALTH
      + runStats.maxHealth * GLOBAL_STAT_DEFS.maxHealth.perLevel
      + t.maxHealth * TANK_UPGRADE_DEFS.maxHealth.perLevel,
    moveSpeed: 12
      + runStats.moveSpeed * GLOBAL_STAT_DEFS.moveSpeed.perLevel
      + t.moveSpeed * TANK_UPGRADE_DEFS.moveSpeed.perLevel,
    hpRegen: runStats.hpRegen * GLOBAL_STAT_DEFS.hpRegen.perLevel
      + t.hpRegen * TANK_UPGRADE_DEFS.hpRegen.perLevel,
    rotationSpeed: 1.5
      + runStats.rotationSpeed * GLOBAL_STAT_DEFS.rotationSpeed.perLevel
      + t.rotationSpeed * TANK_UPGRADE_DEFS.rotationSpeed.perLevel,
    armor: runStats.armor * GLOBAL_STAT_DEFS.armor.perLevel
      + t.armor * TANK_UPGRADE_DEFS.armor.perLevel,
  };
}

/** Compute effective weapon run bonuses */
export function getWeaponRunEffective(wStats: WeaponRunStats) {
  return {
    damageBonus: wStats.damage * WEAPON_STAT_DEFS.damage.perLevel,
    fireRateBonus: wStats.fireRate * WEAPON_STAT_DEFS.fireRate.perLevel,
    rangeBonus: wStats.range * WEAPON_STAT_DEFS.range.perLevel,
    multiShot: wStats.multiShot * WEAPON_STAT_DEFS.multiShot.perLevel,
    pelletBonus: wStats.pellets * WEAPON_STAT_DEFS.pellets.perLevel,
    spreadReduction: wStats.spread * WEAPON_STAT_DEFS.spread.perLevel,
    pierceBonus: wStats.pierceCount * WEAPON_STAT_DEFS.pierceCount.perLevel,
    chainCountBonus: wStats.chainCount * WEAPON_STAT_DEFS.chainCount.perLevel,
    chainRangeBonus: wStats.chainRange * WEAPON_STAT_DEFS.chainRange.perLevel,
    blastRadiusBonus: wStats.blastRadius * WEAPON_STAT_DEFS.blastRadius.perLevel,
  };
}
