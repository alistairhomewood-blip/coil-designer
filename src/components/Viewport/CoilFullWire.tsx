import * as THREE from 'three';
import type { CoilDefinition } from '../../types/coil';
import type { ExpandedCoilGeometry } from '../../types/geometry';
import { TurnTube } from './TurnTube';

interface Props {
  coil: CoilDefinition;
  geo: ExpandedCoilGeometry;
  selected: boolean;
}

export function CoilFullWire({ coil, geo, selected }: Props) {
  const color = new THREE.Color(selected ? '#88bbff' : coil.color);
  const tubeRadius = Math.max(coil.conductor.outerDiameter / 2, 0.0005);

  return (
    <group>
      {geo.turns.map((turn, i) => (
        <TurnTube key={i} turn={turn} color={color} radius={tubeRadius} tubularSegments={4} />
      ))}
    </group>
  );
}
