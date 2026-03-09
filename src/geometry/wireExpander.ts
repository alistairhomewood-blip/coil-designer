import * as THREE from 'three';
import type { CoilDefinition } from '../types/coil';
import type { ExpandedCoilGeometry, TurnGeometry } from '../types/geometry';
import type { Transform3D } from '../types/transform';
import { hashObject } from '../utils/math';
import { generateCircularTurns } from './generators/circularCoilGenerator';
import { generateRectangularTurns } from './generators/rectangularCoilGenerator';
import { generateRacetrackTurns } from './generators/racetrackCoilGenerator';
import { generateEllipticalTurns } from './generators/ellipticalCoilGenerator';
import { generatePolylineTurns } from './generators/polylineCoilGenerator';

function generateLocalTurns(coil: CoilDefinition): TurnGeometry[] {
  const { shape, winding, conductor } = coil;
  switch (shape.type) {
    case 'circular':    return generateCircularTurns(shape, winding, conductor);
    case 'rectangular': return generateRectangularTurns(shape, winding, conductor);
    case 'racetrack':   return generateRacetrackTurns(shape, winding, conductor);
    case 'elliptical':  return generateEllipticalTurns(shape, winding, conductor);
    case 'polyline':    return generatePolylineTurns(shape, winding, conductor);
  }
}

function buildMatrix(transform: Transform3D): THREE.Matrix4 {
  const { position, rotation, scale } = transform;
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rotation[0], rotation[1], rotation[2], 'XYZ'));
  m.scale(new THREE.Vector3(scale[0], scale[1], scale[2]));
  m.setPosition(position[0], position[1], position[2]);
  return m;
}

function transformPoints(pts: Float32Array, matrix: THREE.Matrix4): Float32Array {
  const out = new Float32Array(pts.length);
  const v = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) {
    v.set(pts[i], pts[i+1], pts[i+2]).applyMatrix4(matrix);
    out[i] = v.x; out[i+1] = v.y; out[i+2] = v.z;
  }
  return out;
}

function computeArcLength(pts: Float32Array): number {
  let len = 0;
  for (let i = 3; i < pts.length; i += 3) {
    const dx = pts[i]-pts[i-3], dy = pts[i+1]-pts[i-2], dz = pts[i+2]-pts[i-1];
    len += Math.sqrt(dx*dx+dy*dy+dz*dz);
  }
  return len;
}

type BBox = [number,number,number,number,number,number];

export function expandCoil(coil: CoilDefinition): ExpandedCoilGeometry {
  const localTurns = generateLocalTurns(coil);
  const matrix = buildMatrix(coil.transform);
  const [sx,sy,sz] = coil.transform.scale;
  const hasScale = sx !== 1 || sy !== 1 || sz !== 1;

  const worldTurns: TurnGeometry[] = localTurns.map(t => {
    const points = transformPoints(t.points, matrix);
    return { ...t, points, arcLength: hasScale ? computeArcLength(points) : t.arcLength };
  });

  const bbox: BBox = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  let totalWireLength = 0;

  for (const turn of worldTurns) {
    totalWireLength += turn.arcLength;
    for (let i = 0; i < turn.points.length; i += 3) {
      const x=turn.points[i], y=turn.points[i+1], z=turn.points[i+2];
      if (x < bbox[0]) bbox[0]=x; if (y < bbox[1]) bbox[1]=y; if (z < bbox[2]) bbox[2]=z;
      if (x > bbox[3]) bbox[3]=x; if (y > bbox[4]) bbox[4]=y; if (z > bbox[5]) bbox[5]=z;
    }
  }
  if (worldTurns.length === 0) bbox.fill(0);

  return { coilId: coil.id, sourceHash: hashObject(coil), turns: worldTurns, totalWireLength, boundingBox: bbox };
}
