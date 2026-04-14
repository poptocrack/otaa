import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGameStore } from '../engine/store';
import { useMetaStore } from '../engine/meta';
import { useTerritoryStore } from '../engine/territory';
import { WIREFRAME_GREEN, WIREFRAME_RED, BG_BLACK } from '../engine/constants';

export function GameOver() {
  const score = useGameStore((s) => s.score);
  const wave = useGameStore((s) => s.waveNumber);
  const level = useGameStore((s) => s.level);
  const startGame = useGameStore((s) => s.startGame);

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>DESTROYED</Text>
      <View style={styles.stats}>
        <Text style={styles.stat}>SCORE: {score}</Text>
        <Text style={styles.stat}>WAVE: {wave}</Text>
        <Text style={styles.stat}>LEVEL: {level}</Text>
      </View>
      <Pressable style={styles.button} onPress={() => { startGame(); }}>
        <Text style={styles.buttonText}>[ RETRY ]</Text>
      </Pressable>
    </View>
  );
}

interface MainMenuProps {
  onTerritoryMode: () => void;
}

export function MainMenu({ onTerritoryMode }: MainMenuProps) {
  const startGame = useGameStore((s) => s.startGame);

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>OTAA</Text>
      <Text style={styles.subtitle}>ONE TANK AFTER ANOTHER</Text>
      <View style={{ height: 40 }} />
      <Pressable style={styles.button} onPress={() => { startGame('roguelike'); }}>
        <Text style={styles.buttonText}>[ ROGUELIKE ]</Text>
      </Pressable>
      <View style={{ height: 16 }} />
      <Pressable style={styles.button} onPress={onTerritoryMode}>
        <Text style={styles.buttonText}>[ TERRITORY ]</Text>
      </Pressable>
      {__DEV__ && (
        <>
          <View style={{ height: 40 }} />
          <Pressable
            style={styles.resetButton}
            onPress={() => {
              useMetaStore.getState().hydrate().then(() => {
                // Reset meta store to defaults
                useMetaStore.setState({
                  scrap: 0, cores: 0, pendingScrap: 0, pendingCores: 0,
                  unlockedWeapons: ['cannon'],
                  equippedWeapons: ['cannon'],
                  weaponUpgrades: {
                    cannon: { damage: 0, fireRate: 0, speed: 0 },
                    homing_missile: { damage: 0, fireRate: 0, speed: 0 },
                    shotgun: { damage: 0, fireRate: 0, speed: 0 },
                    railgun: { damage: 0, fireRate: 0, speed: 0 },
                    tesla: { damage: 0, fireRate: 0, speed: 0 },
                    mortar: { damage: 0, fireRate: 0, speed: 0 },
                  },
                  totalKills: 0, totalRuns: 0, bestWave: 0, bestScore: 0,
                  wreckages: [],
                  tankUpgrades: { maxHealth: 0, moveSpeed: 0, hpRegen: 0, rotationSpeed: 0, armor: 0 },
                });
              });
              useTerritoryStore.getState().reset();
              // Clear storage
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('otaa-meta');
                localStorage.removeItem('otaa-territory');
              }
            }}
          >
            <Text style={styles.resetText}>[ DEV RESET ]</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK + 'dd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: WIREFRAME_GREEN,
    fontSize: 40,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  subtitle: {
    color: WIREFRAME_GREEN,
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 6,
    marginTop: 8,
    opacity: 0.7,
  },
  stats: {
    marginTop: 30,
    alignItems: 'center',
    gap: 8,
  },
  stat: {
    color: WIREFRAME_GREEN,
    fontSize: 16,
    fontFamily: 'monospace',
  },
  button: {
    marginTop: 30,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
  },
  buttonText: {
    color: WIREFRAME_GREEN,
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  resetButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: WIREFRAME_RED,
  },
  resetText: {
    color: WIREFRAME_RED,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
