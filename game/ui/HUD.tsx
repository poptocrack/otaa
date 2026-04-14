import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useRef, useEffect } from 'react';
import { useGameStore, type Enemy, type Vec3 } from '../engine/store';
import { useMetaStore } from '../engine/meta';
import { WIREFRAME_GREEN, WIREFRAME_RED, WIREFRAME_YELLOW, WIREFRAME_CYAN, XP_PER_LEVEL } from '../engine/constants';
import { getEffective } from '../engine/stats';
import type { Quest } from '../engine/quests';

export function HUD() {
  const health = useGameStore((s) => s.playerHealth);
  const score = useGameStore((s) => s.score);
  const wave = useGameStore((s) => s.waveNumber);
  const level = useGameStore((s) => s.level);
  const xp = useGameStore((s) => s.xp);
  const globalStats = useGameStore((s) => s.globalStats);
  const tankUpgrades = useMetaStore((s) => s.tankUpgrades);
  const maxHealth = getEffective(globalStats, tankUpgrades).maxHealth;
  const quest = useGameStore((s) => s.activeQuest);
  const gameMode = useGameStore((s) => s.gameMode);
  const totalEnemies = useGameStore((s) => s.totalEnemiesInHex);
  const killedEnemies = useGameStore((s) => s.enemiesKilledInHex);
  const enemies = useGameStore((s) => s.enemies);
  const surviveTimer = useGameStore((s) => s.surviveTimer);
  const surviveTarget = useGameStore((s) => s.surviveTarget);
  const hexConfig = useGameStore((s) => s.hexConfig);

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {gameMode === 'territory' ? (
            <>
              {hexConfig?.objective === 'survive' ? (
                <Text style={styles.label}>
                  SURVIVE {Math.max(0, Math.ceil(surviveTarget - surviveTimer))}s
                </Text>
              ) : (
                <Text style={styles.label}>
                  {totalEnemies - killedEnemies - enemies.length > 0
                    ? `${totalEnemies - killedEnemies} LEFT`
                    : `${enemies.length} LEFT`}
                </Text>
              )}
              <Text style={styles.score}>SCORE {score}</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>WAVE {wave}</Text>
              <Text style={styles.score}>SCORE {score}</Text>
            </>
          )}
        </View>
        <Compass />
        <View style={styles.topRight}>
          <Text style={styles.label}>LVL {level}</Text>
          <XPBar xp={xp} />
        </View>
      </View>

      {/* Quest info */}
      {quest && quest.status === 'active' && (
        <View style={styles.questBar}>
          <Text style={styles.questTitle}>{quest.title}</Text>
          <Text style={styles.questDesc}>{questProgress(quest)}</Text>
          {quest.timerDuration > 0 && (
            <Text style={styles.questTimer}>
              {Math.max(0, quest.timerDuration - quest.timerElapsed).toFixed(1)}s
            </Text>
          )}
          <Text style={styles.questReward}>{quest.coreReward} CORES</Text>
        </View>
      )}

      {/* Reward popup */}
      <RewardPopup />

      {/* Health bar: bottom on web, under top bar on mobile */}
      <View style={Platform.OS === 'web' ? styles.bottomBar : styles.mobileHealthBar}>
        <HealthBar health={health} maxHealth={maxHealth} />
      </View>

      {/* Crosshair */}
      <View style={styles.crosshairContainer} pointerEvents="none">
        <View style={styles.crosshairH} />
        <View style={styles.crosshairV} />
        <View style={styles.crosshairDot} />
      </View>

      {/* Portal choice instructions */}
      {gameMode === 'territory' && useGameStore.getState().status === 'portal_choice' && (
        <View style={styles.portalHint} pointerEvents="none">
          <Text style={styles.portalHintTitle}>SECTOR SECURED</Text>
          <Text style={styles.portalHintText}>Walk into a portal to continue</Text>
          <Text style={[styles.portalHintText, { color: WIREFRAME_GREEN }]}>GREEN = Return to garage</Text>
          <Text style={[styles.portalHintText, { color: WIREFRAME_CYAN }]}>CYAN = Easy sector</Text>
          <Text style={[styles.portalHintText, { color: WIREFRAME_YELLOW }]}>YELLOW = Hard sector</Text>
        </View>
      )}

    </View>
  );
}

function HealthBar({ health, maxHealth }: { health: number; maxHealth: number }) {
  const pct = Math.max(0, health / maxHealth);
  const color = pct > 0.5 ? WIREFRAME_GREEN : pct > 0.25 ? WIREFRAME_YELLOW : WIREFRAME_RED;

  return (
    <View style={styles.healthContainer}>
      <Text style={[styles.label, { marginRight: 8 }]}>HP</Text>
      <View style={styles.healthBarOuter}>
        <View style={[styles.healthBarInner, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function XPBar({ xp }: { xp: number }) {
  const pct = xp / XP_PER_LEVEL;
  return (
    <View style={styles.xpBarOuter}>
      <View style={[styles.xpBarInner, { width: `${pct * 100}%` }]} />
    </View>
  );
}

function questProgress(q: Quest): string {
  switch (q.type) {
    case 'scavenge': {
      const collected = q.items.filter((it) => it.collected).length;
      return `Collect fragments: ${collected}/${q.items.length}`;
    }
    case 'recon': {
      const visited = q.objectives.filter((o) => o.completed).length;
      return `Scout locations: ${visited}/${q.objectives.length}`;
    }
    case 'fetch_deliver':
      return q.carrying ? 'Deliver the crate' : 'Pick up the crate';
    case 'siege': {
      const destroyed = q.structures.filter((s) => s.health <= 0).length;
      return `Destroy structures: ${destroyed}/${q.structures.length}`;
    }
    case 'purge':
    case 'intercept': {
      const killed = q.targets.filter((t) => !t.alive).length;
      return `Eliminate: ${killed}/${q.targets.length}`;
    }
    default:
      return q.description;
  }
}

function RewardPopup() {
  const popup = useGameStore((s) => s.rewardPopup);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (popup) {
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(anim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [popup?.time]);

  if (!popup) return null;

  const isFail = popup.text.includes('FAILED');

  return (
    <Animated.View
      style={[
        styles.rewardPopup,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }),
          }],
        },
      ]}
    >
      <Text style={[styles.rewardText, isFail && styles.rewardTextFail]}>
        {popup.text}
      </Text>
    </Animated.View>
  );
}

const COMPASS_BAR_WIDTH = 250;

function compassXPos(targetX: number, targetZ: number, playerPos: Vec3, playerRot: number): number {
  const dx = targetX - playerPos[0];
  const dz = targetZ - playerPos[2];
  let angle = Math.atan2(-dx, -dz) - playerRot;
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  const normalized = -angle / Math.PI;
  const clamped = Math.max(-0.48, Math.min(0.48, normalized * 0.5));
  return (0.5 + clamped) * COMPASS_BAR_WIDTH;
}

function Compass() {
  const playerPos = useGameStore((s) => s.playerPosition);
  const playerRot = useGameStore((s) => s.playerRotation);
  const enemies = useGameStore((s) => s.enemies);
  const quest = useGameStore((s) => s.activeQuest);

  return (
    <View style={styles.compassBar}>
      <View style={styles.compassCenterTick} />
      {/* Enemy indicators */}
      {enemies.map((e) => {
        const dist = Math.sqrt(
          (e.position[0] - playerPos[0]) ** 2 + (e.position[2] - playerPos[2]) ** 2
        );
        const xPos = compassXPos(e.position[0], e.position[2], playerPos, playerRot);
        const height = Math.max(4, Math.min(16, 300 / dist));
        return (
          <View
            key={e.id}
            style={[
              styles.compassEnemyTick,
              { left: xPos - 1.5, height, top: 12 - height / 2 },
            ]}
          />
        );
      })}
      {/* Quest objective indicators (cyan) */}
      {quest && quest.status === 'active' && quest.objectives
        .filter((o) => !o.completed)
        .map((obj, i) => {
          const xPos = compassXPos(obj.position[0], obj.position[2], playerPos, playerRot);
          return (
            <View
              key={`qobj${i}`}
              style={[
                styles.compassQuestTick,
                { left: xPos - 2, top: 2, height: 20 },
              ]}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  topLeft: {
    alignItems: 'flex-start',
  },
  topRight: {
    alignItems: 'flex-end',
  },
  label: {
    color: WIREFRAME_GREEN,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  score: {
    color: WIREFRAME_GREEN,
    fontSize: 12,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  compassBar: {
    width: COMPASS_BAR_WIDTH,
    height: 24,
    borderWidth: 1,
    borderColor: '#00ff0044',
    position: 'relative',
    overflow: 'hidden',
  },
  compassCenterTick: {
    position: 'absolute',
    left: COMPASS_BAR_WIDTH / 2 - 0.5,
    top: 0,
    width: 1,
    height: 24,
    backgroundColor: '#00ff0066',
  },
  compassEnemyTick: {
    position: 'absolute',
    width: 3,
    backgroundColor: WIREFRAME_RED,
  },
  rewardPopup: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: WIREFRAME_CYAN,
    backgroundColor: '#000000cc',
  },
  rewardText: {
    color: WIREFRAME_CYAN,
    fontSize: 20,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  rewardTextFail: {
    color: WIREFRAME_RED,
  },
  compassQuestTick: {
    position: 'absolute',
    width: 4,
    backgroundColor: WIREFRAME_CYAN,
    opacity: 0.8,
  },
  questBar: {
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00ffff44',
    backgroundColor: '#00000088',
  },
  questTitle: {
    color: WIREFRAME_CYAN,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  questDesc: {
    color: WIREFRAME_GREEN,
    fontSize: 10,
    fontFamily: 'monospace',
    opacity: 0.7,
    marginTop: 2,
  },
  questTimer: {
    color: WIREFRAME_YELLOW,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginTop: 2,
  },
  questReward: {
    color: WIREFRAME_CYAN,
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 2,
    opacity: 0.6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mobileHealthBar: {
    alignItems: 'center',
    marginTop: 8,
  },
  healthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthBarOuter: {
    width: 200,
    height: 10,
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
    overflow: 'hidden',
  },
  healthBarInner: {
    height: '100%',
  },
  xpBarOuter: {
    width: 60,
    height: 4,
    borderWidth: 1,
    borderColor: '#00ff0066',
    marginTop: 4,
    overflow: 'hidden',
  },
  xpBarInner: {
    height: '100%',
    backgroundColor: '#00ffff',
  },
  crosshairContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 24,
    height: 1,
    backgroundColor: WIREFRAME_GREEN,
  },
  crosshairV: {
    position: 'absolute',
    width: 1,
    height: 24,
    backgroundColor: WIREFRAME_GREEN,
  },
  crosshairDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: WIREFRAME_GREEN,
  },
  portalHint: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#000000aa',
  },
  portalHintTitle: {
    color: WIREFRAME_GREEN,
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 8,
  },
  portalHintText: {
    color: '#00ff0088',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
