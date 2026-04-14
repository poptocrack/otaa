import { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useGameStore } from '../engine/store';

const JOYSTICK_SIZE = 130;
const KNOB_SIZE = 50;

export function Controls() {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Joystick />
      <FireZone />
    </View>
  );
}

function Joystick() {
  const viewRef = useRef<View>(null);

  const updateMove = useCallback((x: number, y: number) => {
    useGameStore.getState().setMoveInput({ x, y });
  }, []);

  const resetMove = useCallback(() => {
    useGameStore.getState().setMoveInput({ x: 0, y: 0 });
  }, []);

  const maxDist = JOYSTICK_SIZE / 2 - KNOB_SIZE / 2;

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const x = Math.max(-maxDist, Math.min(maxDist, e.translationX));
      const y = Math.max(-maxDist, Math.min(maxDist, e.translationY));
      runOnJS(updateMove)(x / maxDist, -y / maxDist);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(resetMove)();
    });

  return (
    <View style={styles.joystickContainer}>
      <GestureDetector gesture={pan}>
        <View ref={viewRef} style={styles.joystickOuter}>
          <View style={styles.joystickKnob} />
        </View>
      </GestureDetector>
    </View>
  );
}

function FireZone() {
  const lastTransX = useRef(0);

  const updateLook = useCallback((deltaX: number) => {
    useGameStore.getState().setLookInput({ x: deltaX });
  }, []);

  const stopLookAndFire = useCallback(() => {
    useGameStore.getState().setIsFiring(false);
    useGameStore.getState().setLookInput({ x: 0 });
  }, []);

  const tapFire = useCallback(() => {
    useGameStore.getState().setIsFiring(true);
    setTimeout(() => useGameStore.getState().setIsFiring(false), 100);
  }, []);

  const sensitivity = 0.04;

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      lastTransX.current = 0;
    })
    .onUpdate((e) => {
      'worklet';
      const delta = e.translationX - lastTransX.current;
      lastTransX.current = e.translationX;
      runOnJS(updateLook)(-delta * sensitivity);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(stopLookAndFire)();
    });

  const tap = Gesture.Tap()
    .onStart(() => {
      'worklet';
      runOnJS(tapFire)();
    });

  const composed = Gesture.Race(pan, tap);

  return (
    <View style={styles.fireZone}>
      <GestureDetector gesture={composed}>
        <View style={styles.fireZoneInner} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 30,
    paddingBottom: 50,
  },
  joystickContainer: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
  },
  joystickOuter: {
    width: JOYSTICK_SIZE,
    height: JOYSTICK_SIZE,
    borderRadius: JOYSTICK_SIZE / 2,
    borderWidth: 2,
    borderColor: '#00ff0066',
    backgroundColor: '#00ff0011',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joystickKnob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: '#00ff0033',
  },
  fireZone: {
    flex: 1,
    marginLeft: 40,
    height: '100%',
  },
  fireZoneInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshair: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairLine: {
    position: 'absolute',
    backgroundColor: '#00ff00',
  },
  crosshairH: {
    width: 20,
    height: 1,
  },
  crosshairV: {
    width: 1,
    height: 20,
  },
});
