import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WIREFRAME_RED, WIREFRAME_GREEN, WIREFRAME_YELLOW } from '../engine/constants';
import type { Enemy } from '../engine/store';

/** Renders a single enemy tank as wireframe geometry + health bar */
export function EnemyMesh({ enemy }: { enemy: Enemy }) {
  const ref = useRef<THREE.Group>(null);
  const healthBarRef = useRef<THREE.Group>(null);
  const healthFillRef = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);

  const healthPct = enemy.health / enemy.maxHealth;

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(...enemy.position);
    ref.current.rotation.y = enemy.rotation;

    // Health bar always faces camera (billboard)
    if (healthBarRef.current) {
      healthBarRef.current.quaternion.copy(camera.quaternion);
    }

    // Update health fill scale
    if (healthFillRef.current) {
      const pct = enemy.health / enemy.maxHealth;
      healthFillRef.current.scale.x = Math.max(0.01, pct);
      healthFillRef.current.position.x = -(1 - pct) * 1.25;
    }
  });

  const barColor = healthPct > 0.5 ? WIREFRAME_GREEN : healthPct > 0.25 ? WIREFRAME_YELLOW : WIREFRAME_RED;

  return (
    <group ref={ref}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[2.5, 1.2, 3.5]} />
        <meshBasicMaterial color={WIREFRAME_RED} wireframe />
      </mesh>
      {/* Turret */}
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[1.5, 0.8, 1.5]} />
        <meshBasicMaterial color={WIREFRAME_RED} wireframe />
      </mesh>
      {/* Barrel */}
      <mesh position={[0, 1.4, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 2, 6]} />
        <meshBasicMaterial color={WIREFRAME_RED} wireframe />
      </mesh>
      {/* Health bar — billboard above tank, only shown when damaged */}
      {enemy.health < enemy.maxHealth && (
        <group ref={healthBarRef} position={[0, 3, 0]}>
          {/* Background */}
          <mesh>
            <planeGeometry args={[2.5, 0.25]} />
            <meshBasicMaterial color="#330000" transparent opacity={0.6} />
          </mesh>
          {/* Fill */}
          <mesh ref={healthFillRef}>
            <planeGeometry args={[2.5, 0.25]} />
            <meshBasicMaterial color={barColor} transparent opacity={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}
