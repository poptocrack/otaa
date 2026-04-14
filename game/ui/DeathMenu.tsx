import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGameStore } from '../engine/store';
import { useMetaStore } from '../engine/meta';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, WIREFRAME_RED, BG_BLACK } from '../engine/constants';
import { GaragePanel } from './GaragePanel';

function CurrencyBar() {
  const scrap = useMetaStore((s) => s.scrap);
  const cores = useMetaStore((s) => s.cores);

  return (
    <View style={styles.currencyBar}>
      <Text style={styles.currencyItem}>
        <Text style={styles.currencyLabel}>SCRAP </Text>
        <Text style={styles.currencyScrap}>{scrap}</Text>
      </Text>
      <Text style={styles.currencyItem}>
        <Text style={styles.currencyLabel}>CORES </Text>
        <Text style={styles.currencyCores}>{cores}</Text>
      </Text>
    </View>
  );
}

export function DeathMenu() {
  const [showGarage, setShowGarage] = useState(false);
  const startGame = useGameStore((s) => s.startGame);
  const gameMode = useGameStore((s) => s.gameMode);
  const hexConfig = useGameStore((s) => s.hexConfig);
  const score = useGameStore((s) => s.score);
  const wave = useGameStore((s) => s.waveNumber);
  const level = useGameStore((s) => s.level);
  const runScrap = useGameStore((s) => s.runScrapEarned);
  const runCores = useGameStore((s) => s.runCoresEarned);
  const { scrap, cores, bestWave, bestScore, totalRuns, totalKills } = useMetaStore();

  const handleRetry = () => {
    if (gameMode === 'territory' && hexConfig) {
      startGame('territory', hexConfig);
    } else {
      startGame('roguelike');
    }
  };

  if (showGarage) {
    return <GaragePanel onClose={() => setShowGarage(false)} />;
  }

  return (
    <View style={styles.overlay}>
      <CurrencyBar />

      <Text style={styles.title}>DESTROYED</Text>

      <View style={styles.statsGrid}>
        <StatRow label="SCORE" value={`${score}`} />
        <StatRow label="WAVE" value={`${wave}`} />
        <StatRow label="LEVEL" value={`${level}`} />
      </View>

      <View style={styles.divider} />

      <Text style={styles.subtitle}>EARNINGS</Text>
      <View style={styles.statsGrid}>
        <StatRow label="SCRAP" value={`+${runScrap}`} color={WIREFRAME_YELLOW} />
        <StatRow label="CORES" value={`+${runCores}`} color={WIREFRAME_CYAN} />
      </View>

      <View style={styles.divider} />

      <Text style={styles.subtitle}>TOTALS</Text>
      <View style={styles.statsGrid}>
        <StatRow label="SCRAP" value={`${scrap}`} color={WIREFRAME_YELLOW} />
        <StatRow label="CORES" value={`${cores}`} color={WIREFRAME_CYAN} />
        <StatRow label="RUNS" value={`${totalRuns}`} />
        <StatRow label="KILLS" value={`${totalKills}`} />
        <StatRow label="BEST WAVE" value={`${bestWave}`} />
        <StatRow label="BEST SCORE" value={`${bestScore}`} />
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.garageButton} onPress={() => setShowGarage(true)}>
          <Text style={styles.garageButtonText}>[ GARAGE ]</Text>
        </Pressable>
        <Pressable style={styles.startButton} onPress={handleRetry}>
          <Text style={styles.startButtonText}>[ RETRY ]</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK + 'f5',
    paddingTop: 50,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  currencyBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#00ff0022',
  },
  currencyItem: { fontSize: 13, fontFamily: 'monospace' },
  currencyLabel: { color: '#00ff0088' },
  currencyScrap: { color: WIREFRAME_YELLOW, fontWeight: 'bold' },
  currencyCores: { color: WIREFRAME_CYAN, fontWeight: 'bold' },
  title: {
    color: WIREFRAME_RED,
    fontSize: 28,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: WIREFRAME_GREEN,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#00ff0022',
    marginVertical: 12,
  },
  statsGrid: { gap: 4 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  statLabel: { color: '#00ff0088', fontSize: 12, fontFamily: 'monospace' },
  statValue: { color: WIREFRAME_GREEN, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'center',
  },
  garageButton: {
    borderWidth: 1,
    borderColor: WIREFRAME_CYAN,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  garageButtonText: {
    color: WIREFRAME_CYAN,
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  startButton: {
    borderWidth: 1,
    borderColor: WIREFRAME_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  startButtonText: {
    color: WIREFRAME_GREEN,
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 2,
  },
});
