import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useGameStore } from '../engine/store';
import {
  GLOBAL_STAT_DEFS,
  WEAPON_STAT_DEFS,
  type LevelUpChoice,
} from '../engine/stats';
import { WEAPON_DEFS } from '../engine/weapons';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, BG_BLACK } from '../engine/constants';

export function LevelUpScreen() {
  const level = useGameStore((s) => s.level);
  const choices = useGameStore((s) => s.levelUpChoices);
  const globalStats = useGameStore((s) => s.globalStats);
  const weaponRunStats = useGameStore((s) => s.weaponRunStats);
  const chooseLevelUp = useGameStore((s) => s.chooseLevelUp);
  const [selected, setSelected] = useState(0);

  // Keyboard navigation (web)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        setSelected((s) => Math.max(0, s - 1));
        e.preventDefault();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        setSelected((s) => Math.min(choices.length - 1, s + 1));
        e.preventDefault();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        if (choices[selected]) chooseLevelUp(choices[selected]);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choices, selected, chooseLevelUp]);

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>LEVEL {level}</Text>
      <Text style={styles.subtitle}>CHOOSE UPGRADE</Text>

      <View style={styles.choices}>
        {choices.map((choice, idx) => {
          const isGlobal = choice.type === 'global';
          const def = isGlobal
            ? GLOBAL_STAT_DEFS[choice.statId]
            : WEAPON_STAT_DEFS[choice.statId];
          const currentLvl = isGlobal
            ? globalStats[choice.statId]
            : (weaponRunStats[choice.weaponId]?.[choice.statId] ?? 0);
          const weaponName = !isGlobal ? WEAPON_DEFS[choice.weaponId].name : null;

          return (
            <Pressable
              key={idx}
              style={({ pressed }) => [
                styles.card,
                !isGlobal && styles.cardWeapon,
                pressed && styles.cardPressed,
                idx === selected && styles.cardSelected,
              ]}
              onPress={() => chooseLevelUp(choice)}
            >
              <Text style={styles.icon}>{def.icon}</Text>
              {weaponName && (
                <Text style={styles.weaponTag}>{weaponName}</Text>
              )}
              <Text style={styles.statName}>{def.name}</Text>
              <Text style={styles.statDesc}>{def.description}</Text>
              <Text style={styles.statLevel}>
                LVL {currentLvl} {'>'} {currentLvl + 1}
              </Text>
              <View style={styles.levelDots}>
                {Array.from({ length: def.maxLevel }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i < currentLvl && styles.dotFilled,
                      i === currentLvl && styles.dotNext,
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK + 'ee',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    color: WIREFRAME_CYAN,
    fontSize: 32,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  subtitle: {
    color: WIREFRAME_GREEN,
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 4,
    marginTop: 8,
    marginBottom: 30,
    opacity: 0.7,
  },
  choices: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  card: {
    width: 180,
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  cardWeapon: {
    borderColor: WIREFRAME_YELLOW,
  },
  cardPressed: {
    backgroundColor: '#00ff0022',
    borderColor: WIREFRAME_CYAN,
  },
  cardSelected: {
    borderColor: WIREFRAME_CYAN,
    borderWidth: 2,
    backgroundColor: '#00ffff11',
  },
  icon: {
    color: WIREFRAME_CYAN,
    fontSize: 24,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  weaponTag: {
    color: WIREFRAME_YELLOW,
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  statName: {
    color: WIREFRAME_GREEN,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statDesc: {
    color: WIREFRAME_GREEN,
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.7,
    textAlign: 'center',
  },
  statLevel: {
    color: WIREFRAME_CYAN,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  levelDots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
  },
  dotFilled: {
    backgroundColor: WIREFRAME_GREEN,
  },
  dotNext: {
    backgroundColor: WIREFRAME_CYAN,
  },
});
