import type { CircularCoilParams, WindingParams, ConductorSpec } from '../../types/coil';
import type { TurnGeometry } from '../../types/geometry';

const LAYER_GAP = 0.0001;

export function generateCircularTurns(
  shape: CircularCoilParams,
  winding: WindingParams,
  conductor: ConductorSpec,
  pointsPerTurn = 128,
): TurnGeometry[] {
  const { radius } = shape;
  const { turns, pitch, layers, handedness, currentDirection } = winding;
  const { outerDiameter } = conductor;
  const TWO_PI = 2 * Math.PI;
  const results: TurnGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const r = radius + layer * (outerDiameter + LAYER_GAP);
    const circumference = TWO_PI * r;
    const layerHandedness = (layer % 2 === 0 ? handedness : -handedness) as 1 | -1;
    const yBase = layer % 2 === 0 ? 0 : (turns - 1) * Math.abs(pitch);

    for (let turn = 0; turn < turns; turn++) {
      const y = yBase + turn * pitch * layerHandedness;
      const count = pointsPerTurn + 1;
      const pts = new Float32Array(count * 3);

      for (let i = 0; i < pointsPerTurn; i++) {
        const angle = (TWO_PI * i / pointsPerTurn) * currentDirection;
        pts[i * 3]     = r * Math.cos(angle);
        pts[i * 3 + 1] = y;
        pts[i * 3 + 2] = r * Math.sin(angle);
      }
      pts[pointsPerTurn * 3]     = pts[0];
      pts[pointsPerTurn * 3 + 1] = pts[1];
      pts[pointsPerTurn * 3 + 2] = pts[2];

      results.push({ turnIndex: layer * turns + turn, layerIndex: layer, points: pts, arcLength: circumference, closed: true });
    }
  }
  return results;
}
