export type WeaponId = 'cannon' | 'homing_missile' | 'shotgun' | 'railgun' | 'tesla' | 'mortar';

export type WeaponType = 'direct' | 'homing' | 'shotgun' | 'railgun' | 'tesla' | 'mortar';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  description: string;
  type: WeaponType;
  baseDamage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileLifetime: number;
  unlockCost: { scrap: number; cores: number };
  maxUpgradeLevel: number;
  upgradeScrapCost: number;
  /** Weapon-specific base values */
  extra: Record<string, number>;
}

export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  cannon: {
    id: 'cannon',
    name: 'CANNON',
    description: 'Standard kinetic rounds. Reliable and fast.',
    type: 'direct',
    baseDamage: 25,
    fireRate: 1,
    projectileSpeed: 55,
    projectileLifetime: 0.7, // range ~38
    unlockCost: { scrap: 0, cores: 0 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 50,
    extra: {},
  },
  homing_missile: {
    id: 'homing_missile',
    name: 'HOMING MISSILE',
    description: 'Lock-on missiles. Lower damage, never miss.',
    type: 'homing',
    baseDamage: 13,
    fireRate: 2,
    projectileSpeed: 30,
    projectileLifetime: 1.5, // range ~45, curves
    unlockCost: { scrap: 500, cores: 3 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 75,
    extra: {},
  },
  shotgun: {
    id: 'shotgun',
    name: 'SHOTGUN',
    description: 'Burst of pellets. Devastating at close range.',
    type: 'shotgun',
    baseDamage: 10,
    fireRate: 1.5,
    projectileSpeed: 45,
    projectileLifetime: 0.4, // range ~18, very short
    unlockCost: { scrap: 300, cores: 2 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 60,
    extra: { pellets: 5, spread: 0.4 }, // spread in radians
  },
  railgun: {
    id: 'railgun',
    name: 'RAILGUN',
    description: 'Piercing beam. Slow but penetrates all targets.',
    type: 'railgun',
    baseDamage: 40,
    fireRate: 3,
    projectileSpeed: 100,
    projectileLifetime: 0.5, // range ~50, longest direct
    unlockCost: { scrap: 600, cores: 4 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 80,
    extra: { pierceCount: 3 },
  },
  tesla: {
    id: 'tesla',
    name: 'TESLA COIL',
    description: 'Lightning chains between nearby enemies.',
    type: 'tesla',
    baseDamage: 15,
    fireRate: 1.8,
    projectileSpeed: 0, // instant hit
    projectileLifetime: 0.3, // visual duration
    unlockCost: { scrap: 700, cores: 5 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 85,
    extra: { chainCount: 2, chainRange: 15 }, // initial hit range = 30
  },
  mortar: {
    id: 'mortar',
    name: 'MORTAR',
    description: 'Arcing shells that explode on impact.',
    type: 'mortar',
    baseDamage: 30,
    fireRate: 2.5,
    projectileSpeed: 25,
    projectileLifetime: 3,
    unlockCost: { scrap: 500, cores: 3 },
    maxUpgradeLevel: 10,
    upgradeScrapCost: 70,
    extra: { blastRadius: 8 },
  },
};

export type WeaponUpgrades = {
  damage: number;
  fireRate: number;
  speed: number;
};

export const INITIAL_WEAPON_UPGRADES: WeaponUpgrades = {
  damage: 0,
  fireRate: 0,
  speed: 0,
};

export function getWeaponEffective(weaponId: WeaponId, upgrades?: WeaponUpgrades) {
  const def = WEAPON_DEFS[weaponId];
  const u = upgrades ?? INITIAL_WEAPON_UPGRADES;
  return {
    damage: def.baseDamage + u.damage * 3,
    fireRate: Math.max(0.2, def.fireRate - u.fireRate * 0.05),
    projectileSpeed: def.projectileSpeed + u.speed * 5,
    projectileLifetime: def.projectileLifetime,
    type: def.type,
    extra: { ...def.extra },
  };
}
