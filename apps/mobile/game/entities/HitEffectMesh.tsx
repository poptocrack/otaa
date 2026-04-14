import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WIREFRAME_GREEN, WIREFRAME_YELLOW, WIREFRAME_CYAN } from '../engine/constants';
import type { HitEffect } from '../engine/store';
import { useGameStore } from '../engine/store';

export function HitEffectMesh({ effect }: { effect: HitEffect }) {
  if (effect.type === 'mortar_blast') {
    return <MortarBlastEffect effect={effect} />;
  }
  return <StandardHitEffect effect={effect} />;
}

/** Standard expanding wireframe explosion */
function StandardHitEffect({ effect }: { effect: HitEffect }) {
  const time = useGameStore((s) => s.time);

  const age = time - effect.spawnTime;
  const duration = effect.type === 'destroy' ? 1.0 : 0.5;
  const progress = Math.min(age / duration, 1);

  const isDestroy = effect.type === 'destroy';
  const scale = isDestroy ? 1 + progress * 8 : 1 + progress * 3;
  const opacity = 1 - progress;

  return (
    <group position={effect.position}>
      <mesh scale={[scale, scale, scale]}>
        <icosahedronGeometry args={[isDestroy ? 1.5 : 0.8, 1]} />
        <meshBasicMaterial
          color={isDestroy ? WIREFRAME_YELLOW : WIREFRAME_GREEN}
          wireframe transparent opacity={opacity}
        />
      </mesh>
      {isDestroy && (
        <>
          <mesh scale={[scale * 1.3, scale * 0.5, scale * 1.3]} rotation={[0, age * 3, 0]}>
            <octahedronGeometry args={[2, 0]} />
            <meshBasicMaterial color={WIREFRAME_GREEN} wireframe transparent opacity={opacity * 0.7} />
          </mesh>
          <mesh scale={[scale * 0.8, scale * 1.5, scale * 0.8]} rotation={[age * 2, 0, age]}>
            <octahedronGeometry args={[1.5, 0]} />
            <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe transparent opacity={opacity * 0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

/** Mortar blast — expanding cyan ring on the ground */
function MortarBlastEffect({ effect }: { effect: HitEffect }) {
  const time = useGameStore((s) => s.time);
  const age = time - effect.spawnTime;
  const duration = 1.5;
  const progress = Math.min(age / duration, 1);
  const radius = (effect.blastRadius ?? 8) * progress;
  const opacity = (1 - progress) * 0.7;

  const scale = 1 + progress * 10;

  return (
    <group position={effect.position}>
      {/* Expanding ring on ground */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.1, radius - 0.5), radius, 24]} />
        <meshBasicMaterial color={WIREFRAME_CYAN} transparent opacity={opacity} side={THREE.DoubleSide} />
      </mesh>
      {/* Big wireframe explosion sphere */}
      <mesh scale={[scale, scale, scale]}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe transparent opacity={opacity} />
      </mesh>
      {/* Shrapnel */}
      <mesh scale={[scale * 1.3, scale * 0.5, scale * 1.3]} rotation={[0, age * 3, 0]}>
        <octahedronGeometry args={[2, 0]} />
        <meshBasicMaterial color={WIREFRAME_CYAN} wireframe transparent opacity={opacity * 0.7} />
      </mesh>
    </group>
  );
}
