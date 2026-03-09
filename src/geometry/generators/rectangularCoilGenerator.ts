import type { RectangularCoilParams, WindingParams, ConductorSpec } from '../../types/coil';
import type { TurnGeometry } from '../../types/geometry';

const LAYER_GAP = 0.0001;

export function generateRectangularTurns(
  shape: RectangularCoilParams,
  winding: WindingParams,
  conductor: ConductorSpec,
  pointsPerSegment = 32,
): TurnGeometry[] {
  const { cornerRadius } = shape;
  const { turns, pitch, layers, handedness, currentDirection } = winding;
  const { outerDiameter } = conductor;
  const cornersPerArc = Math.max(8, Math.floor(pointsPerSegment / 4));
  const results: TurnGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const layerHandedness = (layer % 2 === 0 ? handedness : -handedness) as 1 | -1;
    const yBase = layer % 2 === 0 ? 0 : (turns - 1) * Math.abs(pitch);
    const expand = layer * (outerDiameter + LAYER_GAP);
    const w = shape.width + 2 * expand;
    const h = shape.height + 2 * expand;
    const cr = Math.min(cornerRadius, w / 2 - 1e-9, h / 2 - 1e-9);
    const hw = w / 2, hh = h / 2;

    for (let turn = 0; turn < turns; turn++) {
      const y = yBase + turn * pitch * layerHandedness;
      const path: [number, number, number][] = [];

      const straight = (x0: number, z0: number, x1: number, z1: number, n: number) => {
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          path.push([x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t]);
        }
      };
      const arc = (cx: number, cz: number, a0: number, a1: number) => {
        const swept = a1 - a0;
        for (let i = 0; i <= cornersPerArc; i++) {
          const a = a0 + swept * (i / cornersPerArc);
          path.push([cx + cr * Math.cos(a), y, cz + cr * Math.sin(a)]);
        }
      };

      if (currentDirection === 1) {
        straight(-hw + cr, -hh, hw - cr, -hh, pointsPerSegment);
        arc(hw - cr, -hh + cr, -Math.PI / 2, 0);
        straight(hw, -hh + cr, hw, hh - cr, pointsPerSegment);
        arc(hw - cr, hh - cr, 0, Math.PI / 2);
        straight(hw - cr, hh, -hw + cr, hh, pointsPerSegment);
        arc(-hw + cr, hh - cr, Math.PI / 2, Math.PI);
        straight(-hw, hh - cr, -hw, -hh + cr, pointsPerSegment);
        arc(-hw + cr, -hh + cr, Math.PI, 3 * Math.PI / 2);
      } else {
        straight(-hw + cr, hh, hw - cr, hh, pointsPerSegment);
        arc(hw - cr, hh - cr, Math.PI / 2, 0);
        straight(hw, hh - cr, hw, -hh + cr, pointsPerSegment);
        arc(hw - cr, -hh + cr, 0, -Math.PI / 2);
        straight(hw - cr, -hh, -hw + cr, -hh, pointsPerSegment);
        arc(-hw + cr, -hh + cr, -Math.PI / 2, -Math.PI);
        straight(-hw, -hh + cr, -hw, hh - cr, pointsPerSegment);
        arc(-hw + cr, hh - cr, -Math.PI, -3 * Math.PI / 2);
      }
      path.push([...path[0]] as [number, number, number]);

      let arcLength = 0;
      for (let i = 1; i < path.length; i++) {
        const dx = path[i][0] - path[i-1][0], dy = path[i][1] - path[i-1][1], dz = path[i][2] - path[i-1][2];
        arcLength += Math.sqrt(dx*dx + dy*dy + dz*dz);
      }

      const pts = new Float32Array(path.length * 3);
      for (let i = 0; i < path.length; i++) {
        pts[i*3] = path[i][0]; pts[i*3+1] = path[i][1]; pts[i*3+2] = path[i][2];
      }
      results.push({ turnIndex: layer * turns + turn, layerIndex: layer, points: pts, arcLength, closed: true });
    }
  }
  return results;
}
