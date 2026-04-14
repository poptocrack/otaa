import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGameStore } from '../engine/store';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, BG_BLACK } from '../engine/constants';

interface Props {
  onContinue: () => void;
}

export function VictoryScreen({ onContinue }: Props) {
  const score = useGameStore((s) => s.score);
  const kills = useGameStore((s) => s.kills);
  const hex = useGameStore((s) => s.hexConfig);

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>SECTOR SECURED</Text>

      <View style={styles.stats}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>SCORE</Text>
          <Text style={styles.statValue}>{score}</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>KILLS</Text>
          <Text style={styles.statValue}>{kills}</Text>
        </View>
        {hex && (
          <>
            <View style={styles.divider} />
            <Text style={styles.rewardTitle}>REWARDS</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>SCRAP</Text>
              <Text style={[styles.statValue, { color: WIREFRAME_YELLOW }]}>+{hex.reward.scrap}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>CORES</Text>
              <Text style={[styles.statValue, { color: WIREFRAME_CYAN }]}>+{hex.reward.cores}</Text>
            </View>
          </>
        )}
      </View>

      <Pressable style={styles.button} onPress={onContinue}>
        <Text style={styles.buttonText}>[ CONTINUE ]</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK + 'ee',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  title: {
    color: WIREFRAME_GREEN,
    fontSize: 32,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 6,
  },
  stats: {
    marginTop: 30,
    width: 250,
    gap: 6,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    color: '#00ff0088',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statValue: {
    color: WIREFRAME_GREEN,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#00ff0022',
    marginVertical: 8,
  },
  rewardTitle: {
    color: WIREFRAME_CYAN,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 4,
  },
  button: {
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 30,
  },
  buttonText: {
    color: WIREFRAME_GREEN,
    fontSize: 18,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 4,
  },
});
