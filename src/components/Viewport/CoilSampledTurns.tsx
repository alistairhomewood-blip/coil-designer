import * as THREE from 'three';
import type { CoilDefinition } from '../../types/coil';
import type { ExpandedCoilGeometry } from '../../types/geometry';
import { sampleTurnIndices } from '../../geometry/samplingUtils';
import { TurnTube } from './TurnTube';

const MAX_SAMPLED = 5;

interface Props {
  coil: CoilDefinition;
  geo: ExpandedCoilGeometry;
  selected: boolean;
}

export function CoilSampledTurns({ coil, geo, selected }: Props) {
  const color = new THREE.Color(selected ? '#88bbff' : coil.color);
  const tubeRadius = coil.conductor.outerDiameter / 2;
  const indices = sampleTurnIndices(geo.turns.length, MAX_SAMPLED);

  return (
    <group>
      {indices.map(i => (
        <TurnTube key={i} turn={geo.turns[i]} color={color} radius={Math.max(tubeRadius, 0.001)} />
      ))}
    </group>
  );
}
