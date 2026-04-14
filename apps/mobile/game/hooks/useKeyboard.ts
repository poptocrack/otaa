import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useGameStore } from '../engine/store';

/** Keyboard controls for web: arrows to move/rotate, space to fire */
export function useKeyboard() {
  const keys = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      update();
      if (e.code === 'Space') {
        e.preventDefault();
        useGameStore.getState().setIsFiring(true);
      }
      if (e.code === 'Escape') {
        const status = useGameStore.getState().status;
        if (status === 'playing' || status === 'levelup') {
          useGameStore.setState({ status: 'menu' });
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      update();
      if (e.code === 'Space') {
        useGameStore.getState().setIsFiring(false);
      }
    };

    function update() {
      const k = keys.current;
      const store = useGameStore.getState();

      // Movement: Up/Down = forward/backward, Left/Right = rotate
      let y = 0;
      let x = 0;
      if (k.has('ArrowUp') || k.has('KeyW')) y = 1;
      if (k.has('ArrowDown') || k.has('KeyS')) y = -1;
      if (k.has('ArrowLeft') || k.has('KeyA')) x = -1;
      if (k.has('ArrowRight') || k.has('KeyD')) x = 1;

      store.setMoveInput({ x, y });
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
