import type { PolylineCoilParams, WindingParams, ConductorSpec } from '../../types/coil';
import type { TurnGeometry } from '../../types/geometry';

const LAYER_GAP = 0.0001;

function centroid(pts: [number,number][]): [number,number] {
  return [pts.reduce((s,p) => s+p[0], 0)/pts.length, pts.reduce((s,p) => s+p[1], 0)/pts.length];
}

function offsetPoints(pts: [number,number][], cx: number, cz: number, amount: number): [number,number][] {
  return pts.map(([x,z]) => {
    const dx = x-cx, dz = z-cz, len = Math.sqrt(dx*dx+dz*dz);
    if (len < 1e-12) return [x,z];
    const s = (len+amount)/len;
    return [cx+dx*s, cz+dz*s] as [number,number];
  });
}

export function generatePolylineTurns(
  shape: PolylineCoilParams,
  winding: WindingParams,
  conductor: ConductorSpec,
): TurnGeometry[] {
  const { controlPoints, closed } = shape;
  if (controlPoints.length < 2) return [];
  const { turns, pitch, layers, handedness } = winding;
  const [cx, cz] = centroid(controlPoints);
  const results: TurnGeometry[] = [];

  for (let layer = 0; layer < layers; layer++) {
    const expand = layer * (conductor.outerDiameter + LAYER_GAP);
    const layerPts = expand > 0 ? offsetPoints(controlPoints, cx, cz, expand) : controlPoints;
    const layerHandedness = (layer % 2 === 0 ? handedness : -handedness) as 1 | -1;
    const yBase = layer % 2 === 0 ? 0 : (turns-1) * Math.abs(pitch);

    for (let turn = 0; turn < turns; turn++) {
      const y = yBase + turn * pitch * layerHandedness;
      const path: [number,number,number][] = layerPts.map(([x,z]) => [x,y,z]);
      if (closed) path.push([...path[0]] as [number,number,number]);
      let arcLength = 0;
      for (let i = 1; i < path.length; i++) {
        const dx=path[i][0]-path[i-1][0], dy=path[i][1]-path[i-1][1], dz=path[i][2]-path[i-1][2];
        arcLength += Math.sqrt(dx*dx+dy*dy+dz*dz);
      }
      const pts = new Float32Array(path.length * 3);
      for (let i = 0; i < path.length; i++) { pts[i*3]=path[i][0]; pts[i*3+1]=path[i][1]; pts[i*3+2]=path[i][2]; }
      results.push({ turnIndex: layer*turns+turn, layerIndex: layer, points: pts, arcLength, closed });
    }
  }
  return results;
}
