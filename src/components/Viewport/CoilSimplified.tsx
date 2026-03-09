import * as THREE from 'three';
import { useMemo } from 'react';
import type { CoilDefinition } from '../../types/coil';
import type { ExpandedCoilGeometry } from '../../types/geometry';

interface Props {
  coil: CoilDefinition;
  geo: ExpandedCoilGeometry | undefined;
  selected: boolean;
}

export function CoilSimplified({ coil, geo, selected }: Props) {
  const color = new THREE.Color(coil.color);
  const [px, py, pz] = coil.transform.position;

  // Use bounding box to draw a single representative tube
  const bbox = geo?.boundingBox;
  const size = bbox
    ? [bbox[3]-bbox[0], bbox[4]-bbox[1], bbox[5]-bbox[2]]
    : [0.1, 0.02, 0.1];

  const r = Math.max(size[0], size[2]) / 2;
  const h = Math.max(size[1], 0.002);

  return (
    <group position={[px, py, pz]}>
      <mesh>
        <torusGeometry args={[r, h * 0.5, 8, 48]} />
        <meshStandardMaterial
          color={selected ? '#88bbff' : color}
          emissive={selected ? '#2244aa' : '#000000'}
          roughness={0.4}
          metalness={0.3}
          wireframe={!coil.visible}
          transparent={!coil.visible}
          opacity={coil.visible ? 1 : 0.3}
        />
      </mesh>
    </group>
  );
}
