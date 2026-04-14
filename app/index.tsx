import { useState, useCallback } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Canvas } from '@react-three/fiber';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Scene } from '@/game/world/Scene';
import { HUD } from '@/game/ui/HUD';
import { Controls } from '@/game/ui/Controls';
import { MainMenu } from '@/game/ui/GameOver';
import { DeathMenu } from '@/game/ui/DeathMenu';
import { LevelUpScreen } from '@/game/ui/LevelUpScreen';
import { VictoryScreen } from '@/game/ui/VictoryScreen';
import { HexMapScreen } from '@/game/ui/HexMapScreen';
import { useGameStore, type HexConfig } from '@/game/engine/store';
import { useTerritoryStore } from '@/game/engine/territory';
import { useKeyboard } from '@/game/hooks/useKeyboard';
import { BG_BLACK } from '@/game/engine/constants';
import type { HexTile } from '@/game/engine/hex';

const isWeb = Platform.OS === 'web';

type AppScreen = 'game' | 'hexmap';

export default function GameScreen() {
  const status = useGameStore((s) => s.status);
  const gameMode = useGameStore((s) => s.gameMode);
  const hexConfig = useGameStore((s) => s.hexConfig);
  const startGame = useGameStore((s) => s.startGame);
  const conquer = useTerritoryStore((s) => s.conquer);

  const [screen, setScreen] = useState<AppScreen>('game');
  const { width, height } = useWindowDimensions();

  useKeyboard();

  const handleTerritoryMode = useCallback(() => {
    setScreen('hexmap');
  }, []);

  const handleSelectHex = useCallback((tile: HexTile) => {
    const config: HexConfig = {
      coord: tile.coord,
      biome: tile.biome,
      objective: tile.objective,
      difficulty: tile.difficulty,
      enemyCount: tile.enemyCount,
      bossWave: tile.bossWave,
      reward: tile.reward,
    };
    startGame('territory', config);
    setScreen('game');
  }, [startGame]);

  const handleVictoryContinue = useCallback(() => {
    if (hexConfig) {
      conquer(hexConfig.coord);
    }
    setScreen('hexmap');
  }, [hexConfig, conquer]);

  const handleBackFromHex = useCallback(() => {
    setScreen('game');
    useGameStore.setState({ status: 'menu' });
  }, []);

  // Hex map screen
  if (screen === 'hexmap') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <HexMapScreen onSelectHex={handleSelectHex} onBack={handleBackFromHex} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={[styles.canvasContainer, { width, height }]}>
        <Canvas
          style={{ width, height }}
          camera={{ fov: 75, near: 0.1, far: 500 }}
        >
          <Scene />
        </Canvas>
      </View>

      {(status === 'playing' || status === 'levelup' || status === 'portal_choice') && <HUD />}
      {(status === 'playing' || status === 'portal_choice') && !isWeb && <Controls />}
      {status === 'levelup' && <LevelUpScreen />}
      {status === 'dead' && <DeathMenu />}
      {status === 'victory' && <VictoryScreen onContinue={handleVictoryContinue} />}
      {status === 'menu' && <MainMenu onTerritoryMode={handleTerritoryMode} />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_BLACK,
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
});
