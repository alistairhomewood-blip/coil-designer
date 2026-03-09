import type { RacetrackCoilParams, WindingParams, ConductorSpec } from '../../types/coil';
import type { TurnGeometry } from '../../types/geometry';

const LAYER_GAP = 0.0001;

export function generateRacetrackTurns(
  shape: RacetrackCoilParams,
  winding: WindingParams,
  conductor: ConductorSpec,
  pointsPerSemicircle = 64,
): TurnGeometry[] {
  const { straightLength } = shape;
  const { turns, pitch, layers, handedness, currentDirection } = winding;
  const { outerDiameter } = conductor;
  const results: TurnGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const endR = shape.endRadius + layer * (outerDiameter + LAYER_GAP);
    const layerHandedness = (layer % 2 === 0 ? handedness : -handedness) as 1 | -1;
    const yBase = layer % 2 === 0 ? 0 : (turns - 1) * Math.abs(pitch);
    const totalArcLength = 2 * straightLength + 2 * Math.PI * endR;
    const halfS = straightLength / 2;

    for (let turn = 0; turn < turns; turn++) {
      const y = yBase + turn * pitch * layerHandedness;
      const path: [number, number, number][] = [];
      const n = pointsPerSemicircle;

      if (currentDirection === 1) {
        for (let i = 0; i <= n; i++) {
          const a = Math.PI / 2 - Math.PI * (i / n);
          path.push([halfS + endR * Math.cos(a), y, endR * Math.sin(a)]);
        }
        for (let i = 1; i <= n; i++) {
          path.push([halfS - straightLength * (i / n), y, -endR]);
        }
        for (let i = 1; i <= n; i++) {
          const a = -Math.PI / 2 + Math.PI * (i / n);
          path.push([-halfS + endR * Math.cos(a), y, endR * Math.sin(a)]);
        }
        for (let i = 1; i <= n; i++) {
          path.push([-halfS + straightLength * (i / n), y, endR]);
        }
      } else {
        for (let i = 0; i <= n; i++) {
          const a = Math.PI / 2 + Math.PI * (i / n);
          path.push([-halfS + endR * Math.cos(a), y, endR * Math.sin(a)]);
        }
        for (let i = 1; i <= n; i++) {
          path.push([-halfS + straightLength * (i / n), y, -endR]);
        }
        for (let i = 1; i <= n; i++) {
          const a = -Math.PI / 2 - Math.PI * (i / n);
          path.push([halfS + endR * Math.cos(a), y, endR * Math.sin(a)]);
        }
        for (let i = 1; i <= n; i++) {
          path.push([halfS - straightLength * (i / n), y, endR]);
        }
      }
      path.push([...path[0]] as [number, number, number]);

      const pts = new Float32Array(path.length * 3);
      for (let i = 0; i < path.length; i++) {
        pts[i*3] = path[i][0]; pts[i*3+1] = path[i][1]; pts[i*3+2] = path[i][2];
      }
      results.push({ turnIndex: layer * turns + turn, layerIndex: layer, points: pts, arcLength: totalArcLength, closed: true });
    }
  }
  return results;
}
