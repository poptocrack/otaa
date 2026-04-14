import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../engine/store';
import { Terrain } from './Terrain';
import { EnemyMesh } from '../entities/EnemyMesh';
import { ProjectileMesh } from '../entities/ProjectileMesh';
import { HitEffectMesh } from '../entities/HitEffectMesh';
import { QuestEntities } from '../entities/QuestMeshes';
import { PortalChoices } from '../entities/PortalMesh';
import { BG_BLACK } from '../engine/constants';

/** Sync the default Canvas camera with player position & rotation */
function PlayerCamera() {
  useFrame((state) => {
    const { playerPosition, playerRotation } = useGameStore.getState();
    state.camera.position.set(...playerPosition);
    state.camera.rotation.order = 'YXZ';
    state.camera.rotation.y = playerRotation;
    state.camera.rotation.x = 0;
    state.camera.rotation.z = 0;
    state.camera.updateMatrixWorld();
  });

  return null;
}

/** Gun barrel visible at bottom of screen (first person) */
function PlayerGun() {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    const { playerPosition, playerRotation } = useGameStore.getState();
    ref.current.position.set(...playerPosition);
    ref.current.rotation.y = playerRotation;
  });

  return (
    <group ref={ref}>
      {/* Barrel - centered, forward and below camera */}
      <mesh position={[0, -0.4, 1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2, 6]} />
        <meshBasicMaterial color="#00ff00" wireframe />
      </mesh>
      {/* Gun body */}
      <mesh position={[0, -0.6, 0.5]}>
        <boxGeometry args={[0.3, 0.3, 0.8]} />
        <meshBasicMaterial color="#00ff00" wireframe />
      </mesh>
    </group>
  );
}

/** Game tick driver — runs the game update every frame */
function GameLoop() {
  useFrame((_, delta) => {
    // Cap delta to prevent huge jumps on tab-out
    const clampedDelta = Math.min(delta, 0.05);
    useGameStore.getState().updateGame(clampedDelta);
  });
  return null;
}

export function Scene() {
  const enemies = useGameStore((s) => s.enemies);
  const projectiles = useGameStore((s) => s.projectiles);
  const hitEffects = useGameStore((s) => s.hitEffects);
  const activeQuest = useGameStore((s) => s.activeQuest);
  const status = useGameStore((s) => s.status);
  const portalChoices = useGameStore((s) => s.portalChoices);
  const garagePortalPosition = useGameStore((s) => s.garagePortalPosition);

  return (
    <>
      <color attach="background" args={[BG_BLACK]} />
      <fog attach="fog" args={[BG_BLACK, 80, 200]} />
      <PlayerCamera />
      <PlayerGun />
      <GameLoop />
      <Terrain />
      {enemies.map((e) => (
        <EnemyMesh key={e.id} enemy={e} />
      ))}
      {projectiles.map((p) => (
        <ProjectileMesh key={p.id} projectile={p} />
      ))}
      {hitEffects.map((e) => (
        <HitEffectMesh key={e.id} effect={e} />
      ))}
      {activeQuest && activeQuest.status === 'active' && (
        <QuestEntities quest={activeQuest} />
      )}
      {status === 'portal_choice' && (
        <PortalChoices
          portalChoices={portalChoices}
          garagePortalPosition={garagePortalPosition}
        />
      )}
    </>
  );
}
