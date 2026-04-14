import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WIREFRAME_GREEN, WIREFRAME_YELLOW } from '../engine/constants';
import type { Wreckage } from '../engine/meta';
import { useMetaStore } from '../engine/meta';
import { useGameStore, type Vec3 } from '../engine/store';

const LOOT_RANGE = 8;

/** Destroyed tank wreckage from a previous run */
export function WreckageMesh({ wreck }: { wreck: Wreckage }) {
  const ref = useRef<THREE.Group>(null);
  const lootWreckage = useMetaStore((s) => s.lootWreckage);

  // Deterministic tilt based on position
  const tilt = useMemo(() => ({
    rx: Math.sin(wreck.x * 13.7) * 0.3,
    rz: Math.cos(wreck.z * 7.3) * 0.4,
    bodyShift: Math.sin(wreck.timestamp) * 0.5,
  }), [wreck.x, wreck.z, wreck.timestamp]);

  // Check player proximity for looting
  useFrame(() => {
    if (wreck.looted) return;
    const pp = useGameStore.getState().playerPosition;
    const status = useGameStore.getState().status;
    if (status !== 'playing') return;
    const dx = pp[0] - wreck.x;
    const dz = pp[2] - wreck.z;
    if (dx * dx + dz * dz < LOOT_RANGE * LOOT_RANGE) {
      lootWreckage(wreck.timestamp);
    }
  });

  const color = wreck.looted ? '#003300' : WIREFRAME_GREEN;
  const glowColor = wreck.looted ? '#002200' : WIREFRAME_YELLOW;

  return (
    <group ref={ref} position={[wreck.x, 0, wreck.z]}>
      {/* Broken hull — tilted and cracked */}
      <mesh
        position={[tilt.bodyShift, 0.3, 0]}
        rotation={[tilt.rx, 0, tilt.rz]}
      >
        <boxGeometry args={[2.5, 0.8, 3.5]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
      </mesh>

      {/* Detached turret */}
      <mesh
        position={[-1 + tilt.bodyShift, 0.2, 1.5]}
        rotation={[0.5, 0.8, tilt.rz]}
      >
        <boxGeometry args={[1.2, 0.6, 1.2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} />
      </mesh>

      {/* Broken barrel */}
      <mesh
        position={[0.8, 0.1, -1.5]}
        rotation={[0, 0.3, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.1, 0.1, 1.2, 4]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
      </mesh>

      {/* Loot glow indicator (if not looted) */}
      {!wreck.looted && (
        <mesh position={[0, 1.5, 0]}>
          <octahedronGeometry args={[0.5, 0]} />
          <meshBasicMaterial color={glowColor} wireframe />
        </mesh>
      )}
    </group>
  );
}
