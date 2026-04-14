import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { useTerritoryStore } from '../engine/territory';
import {
  getVisibleHexes,
  hexKey,
  type HexTile,
  type BiomeType,
} from '../engine/hex';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, WIREFRAME_RED, BG_BLACK } from '../engine/constants';
import { GaragePanel } from './GaragePanel';

const HEX_SIZE = 38; // radius of hex in display
const HEX_W = HEX_SIZE * 2;
const HEX_H = HEX_SIZE * Math.sqrt(3);

const BIOME_LABELS: Record<BiomeType, string> = {
  plains: 'PLAINS', ruins: 'RUINS', canyon: 'CANYON', crater: 'CRATER', fortress: 'FORTRESS',
};

const OBJECTIVE_LABELS = {
  kill_all: 'ELIMINATE ALL', destroy_base: 'DESTROY BASE', survive: 'SURVIVE 2 MIN', boss: 'BOSS FIGHT',
};

/** Flat-top hexagon SVG points */
function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

interface Props {
  onSelectHex: (tile: HexTile) => void;
  onBack: () => void;
}

export function HexMapScreen({ onSelectHex, onBack }: Props) {
  const conquered = useTerritoryStore((s) => s.conquered);
  const [selectedHex, setSelectedHex] = useState<HexTile | null>(null);
  const [showGarage, setShowGarage] = useState(false);

  const tiles = useMemo(() => getVisibleHexes(conquered), [conquered]);
  const tileArray = useMemo(() => Array.from(tiles.values()), [tiles]);

  // Hex positions in pixel space (flat-top)
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const tile of tileArray) {
      const { q, r } = tile.coord;
      const x = HEX_SIZE * (3 / 2) * q;
      const y = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
      map.set(hexKey(tile.coord), { x, y });
    }
    return map;
  }, [tileArray]);

  // Bounds + center on HQ (0,0)
  const { minX, minY, totalW, totalH, offsetX, offsetY } = useMemo(() => {
    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
    for (const p of positions.values()) {
      mnX = Math.min(mnX, p.x); mxX = Math.max(mxX, p.x);
      mnY = Math.min(mnY, p.y); mxY = Math.max(mxY, p.y);
    }
    const pad = HEX_SIZE * 3;
    const w = mxX - mnX + pad * 2;
    const h = mxY - mnY + pad * 2;
    const screen = Dimensions.get('window');
    // Offset so HQ (0,0) is at center of the content
    const ox = Math.max(w / 2, screen.width / 2);
    const oy = Math.max(h / 2, (screen.height - 250) / 2); // account for header+panel
    return { minX: mnX, minY: mnY, totalW: ox * 2, totalH: oy * 2, offsetX: ox, offsetY: oy };
  }, [positions]);

  const canAttack = selectedHex && selectedHex.state === 'visible';

  if (showGarage) {
    return <GaragePanel onClose={() => setShowGarage(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>{'< BACK'}</Text>
        </Pressable>
        <Text style={styles.title}>TERRITORY</Text>
        <Pressable onPress={() => setShowGarage(true)} style={styles.garageBtn}>
          <Text style={styles.garageText}>GARAGE</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.mapScroll}
        contentContainerStyle={{ width: totalW, height: totalH }}
        contentOffset={{ x: offsetX - Dimensions.get('window').width / 2, y: offsetY - (Dimensions.get('window').height - 300) / 2 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          contentContainerStyle={{ width: totalW, height: totalH }}
          contentOffset={{ x: offsetX - Dimensions.get('window').width / 2, y: 0 }}
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ width: totalW, height: totalH }}>
            {tileArray.map((tile) => {
              const pos = positions.get(hexKey(tile.coord))!;
              const cx = pos.x + offsetX;
              const cy = pos.y + offsetY;
              const isSelected = selectedHex && hexKey(selectedHex.coord) === hexKey(tile.coord);
              const isHQ = tile.coord.q === 0 && tile.coord.r === 0;

              let strokeColor = '#333333';
              let fillColor = 'transparent';
              if (tile.state === 'conquered') { strokeColor = WIREFRAME_GREEN; fillColor = '#00ff0015'; }
              if (tile.state === 'visible') { strokeColor = WIREFRAME_YELLOW; fillColor = '#ffff0010'; }
              if (isSelected) { strokeColor = WIREFRAME_CYAN; fillColor = '#00ffff20'; }

              return (
                <Pressable
                  key={hexKey(tile.coord)}
                  style={{
                    position: 'absolute',
                    left: cx - HEX_SIZE,
                    top: cy - HEX_SIZE,
                    width: HEX_W,
                    height: HEX_W,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => setSelectedHex(tile)}
                >
                  <Svg width={HEX_W} height={HEX_W} style={{ position: 'absolute' }}>
                    <Polygon
                      points={hexPoints(HEX_SIZE, HEX_SIZE, HEX_SIZE - 2)}
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                  </Svg>
                  {isHQ ? (
                    <Text style={styles.hexLabel}>HQ</Text>
                  ) : tile.state === 'conquered' ? (
                    <Text style={styles.hexLabelDone}>OK</Text>
                  ) : tile.state === 'visible' ? (
                    <Text style={styles.hexDifficulty}>{tile.difficulty}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Info panel */}
      <View style={styles.infoPanel}>
        {selectedHex ? (
          <>
            <Text style={styles.infoTitle}>
              {selectedHex.coord.q === 0 && selectedHex.coord.r === 0
                ? 'HEADQUARTERS'
                : `SECTOR ${selectedHex.coord.q},${selectedHex.coord.r}`}
            </Text>
            <Text style={styles.infoBiome}>{BIOME_LABELS[selectedHex.biome]}</Text>
            {selectedHex.state === 'visible' && (
              <>
                <Text style={styles.infoObjective}>{OBJECTIVE_LABELS[selectedHex.objective]}</Text>
                <Text style={styles.infoDifficulty}>
                  DIFFICULTY {'■'.repeat(Math.min(selectedHex.difficulty, 8))}{'□'.repeat(Math.max(0, 8 - selectedHex.difficulty))}
                </Text>
                <Text style={styles.infoEnemies}>{selectedHex.enemyCount} HOSTILES</Text>
                <Text style={styles.infoReward}>
                  REWARD: {selectedHex.reward.scrap}S {selectedHex.reward.cores}C
                </Text>
              </>
            )}
            {selectedHex.state === 'conquered' && (
              <Text style={styles.infoConquered}>SECTOR SECURED</Text>
            )}
            {canAttack && (
              <Pressable style={styles.attackBtn} onPress={() => onSelectHex(selectedHex)}>
                <Text style={styles.attackBtnText}>[ DEPLOY ]</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={styles.infoHint}>Select a sector</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_BLACK,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#00ff0022',
  },
  backBtn: { padding: 8 },
  backText: { color: WIREFRAME_GREEN, fontSize: 14, fontFamily: 'monospace' },
  title: {
    color: WIREFRAME_GREEN, fontSize: 18, fontFamily: 'monospace',
    fontWeight: 'bold', letterSpacing: 4,
  },
  garageBtn: { padding: 8, borderWidth: 1, borderColor: WIREFRAME_CYAN },
  garageText: { color: WIREFRAME_CYAN, fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' },
  mapScroll: { flex: 1 },
  hexLabel: {
    color: WIREFRAME_GREEN, fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold',
  },
  hexLabelDone: {
    color: WIREFRAME_GREEN, fontSize: 10, fontFamily: 'monospace', opacity: 0.5,
  },
  hexDifficulty: {
    color: WIREFRAME_YELLOW, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold',
  },
  infoPanel: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#00ff0022',
    minHeight: 150,
  },
  infoTitle: {
    color: WIREFRAME_GREEN, fontSize: 16, fontFamily: 'monospace',
    fontWeight: 'bold', letterSpacing: 2,
  },
  infoBiome: { color: WIREFRAME_CYAN, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  infoObjective: {
    color: WIREFRAME_YELLOW, fontSize: 13, fontFamily: 'monospace',
    fontWeight: 'bold', marginTop: 8,
  },
  infoDifficulty: { color: WIREFRAME_RED, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  infoEnemies: { color: WIREFRAME_RED, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  infoReward: { color: WIREFRAME_GREEN, fontSize: 12, fontFamily: 'monospace', marginTop: 4 },
  infoConquered: {
    color: WIREFRAME_GREEN, fontSize: 13, fontFamily: 'monospace', marginTop: 8, opacity: 0.6,
  },
  infoHint: { color: '#00ff0044', fontSize: 13, fontFamily: 'monospace' },
  attackBtn: {
    borderWidth: 1, borderColor: WIREFRAME_GREEN,
    paddingVertical: 10, paddingHorizontal: 20,
    alignSelf: 'flex-start', marginTop: 12,
  },
  attackBtnText: {
    color: WIREFRAME_GREEN, fontSize: 16, fontFamily: 'monospace',
    fontWeight: 'bold', letterSpacing: 3,
  },
});
