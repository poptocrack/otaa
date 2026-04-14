import { create } from 'zustand';
import { Platform } from 'react-native';
import { hexKey, type HexCoord } from './hex';

const STORAGE_KEY = 'otaa-territory';

interface TerritoryPersisted {
  conqueredHexes: string[]; // hex keys
}

async function loadTerritory(): Promise<TerritoryPersisted | null> {
  try {
    if (Platform.OS === 'web') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch { return null; }
}

async function saveTerritory(data: TerritoryPersisted) {
  try {
    const raw = JSON.stringify(data);
    if (Platform.OS === 'web') {
      localStorage.setItem(STORAGE_KEY, raw);
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {}
}

export interface TerritoryState {
  conquered: Set<string>;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  conquer: (coord: HexCoord) => void;
  isConquered: (coord: HexCoord) => boolean;
  reset: () => void;
}

export const useTerritoryStore = create<TerritoryState>((set, get) => ({
  conquered: new Set(['0,0']), // HQ always conquered
  hydrated: false,

  hydrate: async () => {
    const saved = await loadTerritory();
    if (saved) {
      const hexes = new Set(saved.conqueredHexes);
      hexes.add('0,0');
      set({ conquered: hexes, hydrated: true });
    } else {
      set({ hydrated: true });
    }
  },

  conquer: (coord) => {
    const key = hexKey(coord);
    set((s) => {
      const next = new Set(s.conquered);
      next.add(key);
      saveTerritory({ conqueredHexes: Array.from(next) });
      return { conquered: next };
    });
  },

  isConquered: (coord) => {
    return get().conquered.has(hexKey(coord));
  },

  reset: () => {
    const initial = new Set(['0,0']);
    set({ conquered: initial });
    saveTerritory({ conqueredHexes: ['0,0'] });
  },
}));

useTerritoryStore.getState().hydrate();
