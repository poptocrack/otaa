import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GRID_SIZE, GRID_DIVISIONS, WIREFRAME_GREEN, WIREFRAME_CYAN, OBSTACLE_VIEW_RANGE } from '../engine/constants';
import { getObstaclesNear, type Obstacle } from './obstacles';
import { useGameStore } from '../engine/store';
import { useMetaStore } from '../engine/meta';
import { WreckageMesh } from '../entities/WreckageMesh';

export function Terrain() {
  return (
    <group>
      <FollowingGrid />
      <Obstacles />
      <Wreckages />
      <HorizonMountains />
      <Moon />
      <Starfield />
    </group>
  );
}

/** Grid that snaps to player position */
function FollowingGrid() {
  const ref = useRef<THREE.GridHelper>(null);
  const cellSize = GRID_SIZE / GRID_DIVISIONS;

  useFrame(() => {
    if (!ref.current) return;
    const [px, , pz] = useGameStore.getState().playerPosition;
    // Snap to grid cell so lines don't visibly jump
    ref.current.position.x = Math.round(px / cellSize) * cellSize;
    ref.current.position.z = Math.round(pz / cellSize) * cellSize;
  });

  return (
    <gridHelper
      ref={ref}
      args={[GRID_SIZE, GRID_DIVISIONS, WIREFRAME_GREEN, '#004400']}
      position={[0, 0, 0]}
    />
  );
}

/** Chunk-based procedural obstacles around the player */
function Obstacles() {
  const playerPos = useGameStore((s) => s.playerPosition);
  const nearby = useMemo(
    () => getObstaclesNear(playerPos[0], playerPos[2], OBSTACLE_VIEW_RANGE),
    [Math.floor(playerPos[0] / 80), Math.floor(playerPos[2] / 80)]
  );

  return (
    <group>
      {nearby.map((ob) => (
        <ObstacleMesh key={`${ob.type}_${ob.x.toFixed(0)}_${ob.z.toFixed(0)}`} ob={ob} />
      ))}
    </group>
  );
}

function ObstacleMesh({ ob }: { ob: Obstacle }) {
  switch (ob.type) {
    case 'pyramid':
      return (
        <mesh position={[ob.x, ob.height / 2, ob.z]}>
          <coneGeometry args={[ob.radius, ob.height, 4]} />
          <meshBasicMaterial color={WIREFRAME_GREEN} wireframe />
        </mesh>
      );
    case 'tower':
      return (
        <group position={[ob.x, 0, ob.z]}>
          <mesh position={[0, ob.height / 2, 0]}>
            <cylinderGeometry args={[ob.radius * 0.7, ob.radius, ob.height, ob.segments]} />
            <meshBasicMaterial color={WIREFRAME_CYAN} wireframe />
          </mesh>
          {/* Antenna on top */}
          <mesh position={[0, ob.height + 1, 0]}>
            <coneGeometry args={[0.3, 2, 4]} />
            <meshBasicMaterial color={WIREFRAME_CYAN} wireframe />
          </mesh>
        </group>
      );
    case 'building':
      return (
        <mesh position={[ob.x, ob.height / 2, ob.z]}>
          <boxGeometry args={[ob.width ?? 4, ob.height, ob.depth ?? 4]} />
          <meshBasicMaterial color={WIREFRAME_GREEN} wireframe opacity={0.7} transparent />
        </mesh>
      );
    case 'wall':
      return (
        <mesh position={[ob.x, ob.height / 2, ob.z]}>
          <boxGeometry args={[ob.width ?? 8, ob.height, 0.5]} />
          <meshBasicMaterial color={WIREFRAME_GREEN} wireframe opacity={0.5} transparent />
        </mesh>
      );
    default:
      return null;
  }
}

/** Wreckages from previous runs */
function Wreckages() {
  const wreckages = useMetaStore((s) => s.wreckages);

  return (
    <group>
      {wreckages.filter((w) => !w.looted).map((w) => (
        <WreckageMesh key={w.timestamp} wreck={w} />
      ))}
    </group>
  );
}

/** Cosmetic mountain ring always at the horizon around the player */
function HorizonMountains() {
  const ref = useRef<THREE.Group>(null);

  const mountains = useMemo(() => {
    const items: { angle: number; scale: number; segments: number }[] = [];
    const count = 24;
    for (let i = 0; i < count; i++) {
      items.push({
        angle: (i / count) * Math.PI * 2,
        scale: 15 + ((i * 7 + 3) % 11) * 2, // deterministic variation
        segments: 4 + (i % 3),
      });
    }
    return items;
  }, []);

  useFrame(() => {
    if (!ref.current) return;
    const [px, , pz] = useGameStore.getState().playerPosition;
    ref.current.position.x = px;
    ref.current.position.z = pz;
  });

  const horizonDist = 180;

  return (
    <group ref={ref}>
      {mountains.map((m, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(m.angle) * horizonDist,
            m.scale / 2,
            Math.sin(m.angle) * horizonDist,
          ]}
        >
          <coneGeometry args={[m.scale * 0.8, m.scale, m.segments]} />
          <meshBasicMaterial color={'#007700'} wireframe />
        </mesh>
      ))}
    </group>
  );
}

/** Wireframe moon in the sky */
function Moon() {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const [px, , pz] = useGameStore.getState().playerPosition;
    ref.current.position.x = px;
    ref.current.position.z = pz;
  });

  return (
    <group ref={ref}>
      {/* Moon sphere */}
      <mesh position={[120, 160, -200]}>
        <sphereGeometry args={[18, 12, 12]} />
        <meshBasicMaterial color={WIREFRAME_GREEN} wireframe />
      </mesh>
      {/* Craters — smaller spheres on the surface */}
      <mesh position={[115, 165, -198]}>
        <sphereGeometry args={[5, 8, 8]} />
        <meshBasicMaterial color={'#005500'} wireframe />
      </mesh>
      <mesh position={[125, 155, -196]}>
        <sphereGeometry args={[3.5, 8, 8]} />
        <meshBasicMaterial color={'#005500'} wireframe />
      </mesh>
      <mesh position={[118, 153, -194]}>
        <sphereGeometry args={[4, 8, 8]} />
        <meshBasicMaterial color={'#005500'} wireframe />
      </mesh>
    </group>
  );
}

/** Stars in the sky */
function Starfield() {
  const ref = useRef<THREE.Points>(null);

  const [positions] = useMemo(() => {
    const count = 500;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Random point on upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45; // above horizon
      const r = 400;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi); // up
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return [pos];
  }, []);

  useFrame(() => {
    if (!ref.current) return;
    const [px, , pz] = useGameStore.getState().playerPosition;
    ref.current.position.x = px;
    ref.current.position.z = pz;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial color={WIREFRAME_GREEN} size={2} sizeAttenuation={false} />
    </points>
  );
}
