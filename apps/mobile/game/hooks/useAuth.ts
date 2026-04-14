import { useEffect, useState } from 'react';
import { signInAnon, onAuthChange, trackEvent, saveUserProfile } from '../services/firebase';
import { useMetaStore } from '../engine/meta';
import { useTerritoryStore } from '../engine/territory';
import type { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);

      // On first auth, save initial profile with firstSeen
      if (u) {
        const meta = useMetaStore.getState();
        const territory = useTerritoryStore.getState();
        saveUserProfile(u.uid, {
          totalRuns: meta.totalRuns,
          totalKills: meta.totalKills,
          bestWave: meta.bestWave,
          bestScore: meta.bestScore,
          scrap: meta.scrap,
          cores: meta.cores,
          unlockedWeapons: meta.unlockedWeapons,
          equippedWeapons: meta.equippedWeapons,
          conqueredHexes: territory.conquered.size - 1,
          tankUpgrades: meta.tankUpgrades as unknown as Record<string, number>,
        });
        trackEvent(u.uid, 'session_start');
      }
    });

    signInAnon().catch(() => {
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading, uid: user?.uid ?? null };
}
