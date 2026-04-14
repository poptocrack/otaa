import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WIREFRAME_GREEN, WIREFRAME_YELLOW, WIREFRAME_RED, WIREFRAME_CYAN } from '../engine/constants';
import type { Projectile } from '../engine/store';

export function ProjectileMesh({ projectile }: { projectile: Projectile }) {
  switch (projectile.weaponType) {
    case 'homing': return <HomingMissileMesh projectile={projectile} />;
    case 'shotgun': return <ShotgunPelletMesh projectile={projectile} />;
    case 'railgun': return <RailgunBeamMesh projectile={projectile} />;
    case 'tesla': return <TeslaArcMesh projectile={projectile} />;
    case 'mortar': return <MortarShellMesh projectile={projectile} />;
    default: return <DirectProjectileMesh projectile={projectile} />;
  }
}

/** Standard cannon round */
function DirectProjectileMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.position.set(...projectile.position); });
  const color = projectile.owner === 'player' ? WIREFRAME_GREEN : WIREFRAME_YELLOW;
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.3, 4, 4]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  );
}

/** Homing missile */
function HomingMissileMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(...projectile.position);
    ref.current.rotation.y = Math.atan2(projectile.direction[0], projectile.direction[2]);
  });
  return (
    <group ref={ref}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.25, 1.8, 4]} />
        <meshBasicMaterial color={WIREFRAME_CYAN} wireframe />
      </mesh>
      <mesh position={[0, 0, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 0.6, 4]} />
        <meshBasicMaterial color={WIREFRAME_CYAN} wireframe opacity={0.5} transparent />
      </mesh>
      <mesh position={[0, 0, -0.9]}>
        <sphereGeometry args={[0.15, 4, 4]} />
        <meshBasicMaterial color={WIREFRAME_RED} wireframe />
      </mesh>
    </group>
  );
}

/** Shotgun pellet — small, fast, slightly different shape */
function ShotgunPelletMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.position.set(...projectile.position); });
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.2, 0]} />
      <meshBasicMaterial color={WIREFRAME_GREEN} wireframe />
    </mesh>
  );
}

/** Railgun beam — long thin line that stretches */
function RailgunBeamMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(...projectile.position);
    ref.current.rotation.y = Math.atan2(projectile.direction[0], projectile.direction[2]);
  });
  return (
    <group ref={ref}>
      {/* Main beam */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 6, 4]} />
        <meshBasicMaterial color={'#ff00ff'} wireframe />
      </mesh>
      {/* Glow core */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 4, 4]} />
        <meshBasicMaterial color={'#ff00ff'} wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/** Tesla arc — line from origin to target */
function TeslaArcMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Group>(null);
  const age = Date.now() * 0.001; // for flickering

  useFrame(() => {
    if (ref.current) ref.current.position.set(...projectile.position);
  });

  // Visual: a jagged line toward the target direction
  const dir = projectile.direction;
  const len = 15;

  return (
    <group ref={ref}>
      {/* Main arc */}
      <mesh position={[dir[0] * len / 2, 1, dir[2] * len / 2]}
        rotation={[0, Math.atan2(dir[0], dir[2]), Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, len, 3]} />
        <meshBasicMaterial color={'#aaffff'} transparent opacity={0.8} />
      </mesh>
      {/* Glow */}
      <mesh position={[dir[0] * len / 2, 1, dir[2] * len / 2]}
        rotation={[0, Math.atan2(dir[0], dir[2]), Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, len, 3]} />
        <meshBasicMaterial color={WIREFRAME_CYAN} wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

/** Mortar shell — arcing sphere */
function MortarShellMesh({ projectile }: { projectile: Projectile }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.set(...projectile.position);
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.5, 6, 6]} />
        <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe />
      </mesh>
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.25, 4, 4]} />
        <meshBasicMaterial color={WIREFRAME_RED} wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
