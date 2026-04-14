import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_RED, WIREFRAME_YELLOW } from '../engine/constants';
import type { Quest, QuestStructure, QuestTarget } from '../engine/quests';

/** Render all quest entities */
export function QuestEntities({ quest }: { quest: Quest }) {
  return (
    <group>
      {quest.structures.map((s) => (
        <StructureMesh key={s.id} structure={s} />
      ))}
      {quest.targets.map((t) => (
        t.alive && <QuestTargetMesh key={t.id} target={t} />
      ))}
      {quest.items.map((it) => (
        !it.collected && <ItemMesh key={it.id} position={it.position} />
      ))}
      {quest.type === 'survive_zone' && (
        <ZoneCircle
          position={quest.objectives[0].position}
          radius={quest.objectives[0].radius}
          progress={quest.timerElapsed / quest.timerDuration}
        />
      )}
      {quest.type === 'defend' && (
        <ZoneCircle
          position={quest.objectives[0].position}
          radius={quest.objectives[0].radius}
          progress={quest.timerElapsed / quest.timerDuration}
        />
      )}
      {/* Objective markers */}
      {quest.objectives.map((obj, i) => (
        !obj.completed && (
          <ObjectiveMarker key={i} position={obj.position} label={obj.label} />
        )
      ))}
    </group>
  );
}

function StructureMesh({ structure: s }: { structure: QuestStructure }) {
  const alive = s.health > 0;
  const color = s.type === 'hostile' ? WIREFRAME_RED : WIREFRAME_CYAN;
  const opacity = alive ? 0.8 : 0.2;

  return (
    <group position={s.position}>
      <mesh position={[0, s.height / 2, 0]}>
        <boxGeometry args={[s.width, s.height, s.depth]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
      </mesh>
      {/* Health bar for alive hostile structures */}
      {alive && s.type === 'hostile' && (
        <StructureHealthBar health={s.health} maxHealth={s.maxHealth} height={s.height} />
      )}
      {alive && s.type === 'allied' && (
        <StructureHealthBar health={s.health} maxHealth={s.maxHealth} height={s.height} color={WIREFRAME_CYAN} />
      )}
    </group>
  );
}

function StructureHealthBar({ health, maxHealth, height, color }: {
  health: number; maxHealth: number; height: number; color?: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);

  useFrame(() => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
    if (fillRef.current) {
      const pct = Math.max(0.01, health / maxHealth);
      fillRef.current.scale.x = pct;
      fillRef.current.position.x = -(1 - pct) * 1.5;
    }
  });

  return (
    <group ref={ref} position={[0, height + 1, 0]}>
      <mesh>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial color="#330000" transparent opacity={0.5} />
      </mesh>
      <mesh ref={fillRef}>
        <planeGeometry args={[3, 0.3]} />
        <meshBasicMaterial color={color ?? WIREFRAME_RED} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function QuestTargetMesh({ target: t }: { target: QuestTarget }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(...t.position);
    ref.current.rotation.y = t.rotation;
  });

  const isElite = !t.moveDirection; // drones have moveDirection, elites don't

  return (
    <group ref={ref}>
      {isElite ? (
        <>
          {/* Elite tank — bigger, yellow */}
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[3.5, 1.6, 4.5]} />
            <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe />
          </mesh>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[2, 1, 2]} />
            <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe />
          </mesh>
          <mesh position={[0, 1.8, 2.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 2.5, 6]} />
            <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe />
          </mesh>
        </>
      ) : (
        <>
          {/* Drone — small, fast, cyan */}
          <mesh position={[0, 1, 0]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={WIREFRAME_CYAN} wireframe />
          </mesh>
        </>
      )}
    </group>
  );
}

function ItemMesh({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.set(position[0], 1 + Math.sin(clock.elapsedTime * 2) * 0.3, position[2]);
    ref.current.rotation.y = clock.elapsedTime;
  });

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.6, 0]} />
      <meshBasicMaterial color={WIREFRAME_YELLOW} wireframe />
    </mesh>
  );
}

function ZoneCircle({ position, radius, progress }: {
  position: [number, number, number]; radius: number; progress: number;
}) {
  const color = progress > 0.7 ? WIREFRAME_GREEN : WIREFRAME_CYAN;
  return (
    <mesh position={[position[0], 0.1, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.3, radius, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.3 + progress * 0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ObjectiveMarker({ position, label }: {
  position: [number, number, number]; label: string;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.set(position[0], 4 + Math.sin(clock.elapsedTime * 1.5) * 0.5, position[2]);
    ref.current.rotation.y = clock.elapsedTime * 0.5;
  });

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={WIREFRAME_CYAN} wireframe transparent opacity={0.6} />
    </mesh>
  );
}
