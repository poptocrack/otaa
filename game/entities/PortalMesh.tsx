import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WIREFRAME_GREEN, WIREFRAME_CYAN, WIREFRAME_YELLOW, WIREFRAME_RED } from '../engine/constants';
import type { Vec3, HexConfig } from '../engine/store';

interface PortalProps {
  position: Vec3;
  color: string;
  label: string;
}

function Portal({ position, color }: PortalProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.5;
      ringRef.current.rotation.z = Math.sin(t) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.8;
      innerRef.current.scale.setScalar(0.9 + Math.sin(t * 2) * 0.1);
    }
  });

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={ringRef} position={[0, 4, 0]}>
        <torusGeometry args={[3, 0.15, 6, 8]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Inner rotating diamond */}
      <mesh ref={innerRef} position={[0, 4, 0]}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.6} />
      </mesh>
      {/* Base pillar */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.5, 0.8, 3, 6]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
      </mesh>
      {/* Ground ring */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 3, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

interface PortalChoicesProps {
  portalChoices: { hex: HexConfig; position: Vec3 }[];
  garagePortalPosition: Vec3;
}

export function PortalChoices({ portalChoices, garagePortalPosition }: PortalChoicesProps) {
  return (
    <group>
      {/* Garage portal (green, behind player) */}
      <Portal
        position={garagePortalPosition}
        color={WIREFRAME_GREEN}
        label="GARAGE"
      />

      {/* Territory portals (cyan/yellow, ahead) */}
      {portalChoices.map((choice, i) => (
        <Portal
          key={i}
          position={choice.position}
          color={i === 0 ? WIREFRAME_CYAN : WIREFRAME_YELLOW}
          label={`SECTOR ${choice.hex.difficulty}`}
        />
      ))}
    </group>
  );
}
