import type { EllipticalCoilParams, WindingParams, ConductorSpec } from '../../types/coil';
import type { TurnGeometry } from '../../types/geometry';

const LAYER_GAP = 0.0001;

function ellipseArcLength(a: number, b: number, n: number): number {
  let len = 0;
  let px = a, pz = 0;
  for (let i = 1; i <= n; i++) {
    const angle = 2 * Math.PI * i / n;
    const x = a * Math.cos(angle), z = b * Math.sin(angle);
    len += Math.sqrt((x-px)**2 + (z-pz)**2);
    px = x; pz = z;
  }
  return len;
}

export function generateEllipticalTurns(
  shape: EllipticalCoilParams,
  winding: WindingParams,
  conductor: ConductorSpec,
  pointsPerTurn = 128,
): TurnGeometry[] {
  const { semiAxisA, semiAxisB } = shape;
  const { turns, pitch, layers, handedness, currentDirection } = winding;
  const { outerDiameter } = conductor;
  const TWO_PI = 2 * Math.PI;
  const results: TurnGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const expand = layer * (outerDiameter + LAYER_GAP);
    const a = semiAxisA + expand, b = semiAxisB + expand;
    const circumference = ellipseArcLength(a, b, pointsPerTurn);
    const layerHandedness = (layer % 2 === 0 ? handedness : -handedness) as 1 | -1;
    const yBase = layer % 2 === 0 ? 0 : (turns - 1) * Math.abs(pitch);

    for (let turn = 0; turn < turns; turn++) {
      const y = yBase + turn * pitch * layerHandedness;
      const pts = new Float32Array((pointsPerTurn + 1) * 3);
      for (let i = 0; i < pointsPerTurn; i++) {
        const angle = (TWO_PI * i / pointsPerTurn) * currentDirection;
        pts[i*3] = a * Math.cos(angle); pts[i*3+1] = y; pts[i*3+2] = b * Math.sin(angle);
      }
      pts[pointsPerTurn*3] = pts[0]; pts[pointsPerTurn*3+1] = pts[1]; pts[pointsPerTurn*3+2] = pts[2];
      results.push({ turnIndex: layer * turns + turn, layerIndex: layer, points: pts, arcLength: circumference, closed: true });
    }
  }
  return results;
}
