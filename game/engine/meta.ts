import { create } from 'zustand';
import { Platform } from 'react-native';
import { getCurrentUser, trackEvent } from '../services/firebase';
import {
  type WeaponId,
  type WeaponUpgrades,
  WEAPON_DEFS,
  INITIAL_WEAPON_UPGRADES,
} from './weapons';
import {
  type GlobalStatId,
  type TankUpgrades,
  INITIAL_TANK_UPGRADES,
  TANK_UPGRADE_DEFS,
  getTankUpgradeCost,
} from './stats';

const STORAGE_KEY = 'otaa-meta';

// Simple cross-platform storage
async function loadFromStorage(): Promise<Partial<MetaPersisted> | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    return null;
  }
}

async function saveToStorage(data: MetaPersisted) {
  try {
    const raw = JSON.stringify(data);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, raw);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {
    // Silent fail
  }
}

export interface Wreckage {
  x: number;
  z: number;
  wave: number;
  score: number;
  timestamp: number;
  looted: boolean;
}

const MAX_WRECKAGE = 50;

/** Persisted subset of meta state */
interface MetaPersisted {
  scrap: number;
  cores: number;
  unlockedWeapons: WeaponId[];
  equippedWeapons: WeaponId[];
  weaponUpgrades: Record<WeaponId, WeaponUpgrades>;
  totalKills: number;
  totalRuns: number;
  bestWave: number;
  bestScore: number;
  wreckages: Wreckage[];
  tankUpgrades: TankUpgrades;
}

export interface MetaState extends MetaPersisted {
  pendingScrap: number;
  pendingCores: number;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  addRunEarnings: (scrap: number, cores: number) => void;
  collectPending: () => void;
  unlockWeapon: (id: WeaponId) => boolean;
  equipWeapon: (id: WeaponId) => void;
  unequipWeapon: (id: WeaponId) => void;
  upgradeWeapon: (id: WeaponId, stat: keyof WeaponUpgrades) => boolean;
  updateRunStats: (kills: number, wave: number, score: number) => void;
  addWreckage: (x: number, z: number, wave: number, score: number) => void;
  lootWreckage: (timestamp: number) => number;
  upgradeTank: (statId: GlobalStatId) => boolean; // returns scrap gained
}

function getPersisted(state: MetaState): MetaPersisted {
  return {
    scrap: state.scrap,
    cores: state.cores,
    unlockedWeapons: state.unlockedWeapons,
    equippedWeapons: state.equippedWeapons,
    weaponUpgrades: state.weaponUpgrades,
    totalKills: state.totalKills,
    totalRuns: state.totalRuns,
    bestWave: state.bestWave,
    bestScore: state.bestScore,
    wreckages: state.wreckages,
    tankUpgrades: state.tankUpgrades,
  };
}

function persist(state: MetaState) {
  saveToStorage(getPersisted(state));
}

export const useMetaStore = create<MetaState>((set, get) => ({
  scrap: 0,
  cores: 0,
  pendingScrap: 0,
  pendingCores: 0,
  hydrated: false,

  unlockedWeapons: ['cannon'] as WeaponId[],
  equippedWeapons: ['cannon'] as WeaponId[],
  weaponUpgrades: {
    cannon: { ...INITIAL_WEAPON_UPGRADES },
    homing_missile: { ...INITIAL_WEAPON_UPGRADES },
    shotgun: { ...INITIAL_WEAPON_UPGRADES },
    railgun: { ...INITIAL_WEAPON_UPGRADES },
    tesla: { ...INITIAL_WEAPON_UPGRADES },
    mortar: { ...INITIAL_WEAPON_UPGRADES },
  },

  totalKills: 0,
  totalRuns: 0,
  bestWave: 0,
  bestScore: 0,
  wreckages: [] as Wreckage[],
  tankUpgrades: { ...INITIAL_TANK_UPGRADES },

  hydrate: async () => {
    const saved = await loadFromStorage();
    if (saved) {
      // Ensure all weapons have upgrade entries (handles old saves)
      const defaults: Record<string, WeaponUpgrades> = {
        cannon: { ...INITIAL_WEAPON_UPGRADES },
        homing_missile: { ...INITIAL_WEAPON_UPGRADES },
        shotgun: { ...INITIAL_WEAPON_UPGRADES },
        railgun: { ...INITIAL_WEAPON_UPGRADES },
        tesla: { ...INITIAL_WEAPON_UPGRADES },
        mortar: { ...INITIAL_WEAPON_UPGRADES },
      };
      saved.weaponUpgrades = { ...defaults, ...(saved.weaponUpgrades ?? {}) } as Record<WeaponId, WeaponUpgrades>;
      saved.wreckages = saved.wreckages ?? [];
      saved.tankUpgrades = { ...INITIAL_TANK_UPGRADES, ...(saved.tankUpgrades ?? {}) };
      set({ ...saved, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  addRunEarnings: (scrap, cores) => {
    set((s) => ({
      pendingScrap: s.pendingScrap + scrap,
      pendingCores: s.pendingCores + cores,
    }));
  },

  collectPending: () => {
    set((s) => {
      const updated = {
        ...s,
        scrap: s.scrap + s.pendingScrap,
        cores: s.cores + s.pendingCores,
        pendingScrap: 0,
        pendingCores: 0,
      };
      persist(updated);
      return updated;
    });
  },

  unlockWeapon: (id) => {
    const state = get();
    const def = WEAPON_DEFS[id];
    if (state.unlockedWeapons.includes(id)) return false;
    if (state.scrap < def.unlockCost.scrap || state.cores < def.unlockCost.cores) return false;

    const updated = {
      scrap: state.scrap - def.unlockCost.scrap,
      cores: state.cores - def.unlockCost.cores,
      unlockedWeapons: [...state.unlockedWeapons, id] as WeaponId[],
    };
    set(updated);
    persist({ ...get() });
    const user = getCurrentUser();
    if (user) {
      trackEvent(user.uid, 'weapon_unlock', {
        weaponId: id,
        totalRuns: state.totalRuns,
        totalKills: state.totalKills,
      });
    }
    return true;
  },

  equipWeapon: (id) => {
    const state = get();
    if (!state.unlockedWeapons.includes(id)) return;
    if (state.equippedWeapons.includes(id)) return;
    const equipped = state.equippedWeapons.length >= 2
      ? [state.equippedWeapons[1], id] as WeaponId[]
      : [...state.equippedWeapons, id] as WeaponId[];
    set({ equippedWeapons: equipped });
    persist({ ...get() });
  },

  unequipWeapon: (id) => {
    const state = get();
    if (state.equippedWeapons.length <= 1) return;
    set({ equippedWeapons: state.equippedWeapons.filter((w) => w !== id) as WeaponId[] });
    persist({ ...get() });
  },

  upgradeWeapon: (id, stat) => {
    const state = get();
    const def = WEAPON_DEFS[id];
    const current = state.weaponUpgrades[id];
    if (!current || current[stat] >= def.maxUpgradeLevel) return false;

    const cost = def.upgradeScrapCost * (current[stat] + 1);
    if (state.scrap < cost) return false;

    set({
      scrap: state.scrap - cost,
      weaponUpgrades: {
        ...state.weaponUpgrades,
        [id]: { ...current, [stat]: current[stat] + 1 },
      },
    });
    persist({ ...get() });
    return true;
  },

  updateRunStats: (kills, wave, score) => {
    set((s) => {
      const updated = {
        ...s,
        totalKills: s.totalKills + kills,
        totalRuns: s.totalRuns + 1,
        bestWave: Math.max(s.bestWave, wave),
        bestScore: Math.max(s.bestScore, score),
      };
      persist(updated);
      return updated;
    });
  },

  addWreckage: (x, z, wave, score) => {
    set((s) => {
      const wreck: Wreckage = {
        x, z, wave, score,
        timestamp: Date.now(),
        looted: false,
      };
      // Keep max N wreckages, remove oldest
      const wreckages = [...s.wreckages, wreck].slice(-MAX_WRECKAGE);
      const updated = { ...s, wreckages };
      persist(updated);
      return updated;
    });
  },

  lootWreckage: (timestamp) => {
    const state = get();
    const wreck = state.wreckages.find((w) => w.timestamp === timestamp);
    if (!wreck || wreck.looted) return 0;

    const scrapGain = 10 + wreck.wave * 5;
    set((s) => {
      const updated = {
        ...s,
        scrap: s.scrap + scrapGain,
        wreckages: s.wreckages.map((w) =>
          w.timestamp === timestamp ? { ...w, looted: true } : w
        ),
      };
      persist(updated);
      return updated;
    });
    return scrapGain;
  },

  upgradeTank: (statId) => {
    const state = get();
    const current = state.tankUpgrades[statId];
    const def = TANK_UPGRADE_DEFS[statId];
    if (current >= def.maxLevel) return false;

    const cost = getTankUpgradeCost(statId, current);
    if (state.scrap < cost) return false;

    set({
      scrap: state.scrap - cost,
      tankUpgrades: { ...state.tankUpgrades, [statId]: current + 1 },
    });
    persist({ ...get() });
    return true;
  },
}));

// Auto-hydrate on import
useMetaStore.getState().hydrate();
