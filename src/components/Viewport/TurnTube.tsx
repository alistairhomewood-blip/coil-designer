import * as THREE from 'three';
import { useMemo } from 'react';
import type { TurnGeometry } from '../../types/geometry';

interface Props {
  turn: TurnGeometry;
  color: THREE.Color;
  radius: number;
  tubularSegments?: number;
}

class ArrayCurve extends THREE.Curve<THREE.Vector3> {
  private pts: THREE.Vector3[];
  constructor(points: Float32Array) {
    super();
    this.pts = [];
    for (let i = 0; i < points.length; i += 3) {
      this.pts.push(new THREE.Vector3(points[i], points[i+1], points[i+2]));
    }
  }
  getPoint(t: number): THREE.Vector3 {
    const pts = this.pts;
    if (pts.length < 2) return pts[0] ?? new THREE.Vector3();
    const scaled = t * (pts.length - 1);
    const i = Math.min(Math.floor(scaled), pts.length - 2);
    const f = scaled - i;
    return new THREE.Vector3().lerpVectors(pts[i], pts[i+1], f);
  }
}

export function TurnTube({ turn, color, radius, tubularSegments = 6 }: Props) {
  const geometry = useMemo(() => {
    const curve = new ArrayCurve(turn.points);
    const n = Math.max(4, turn.points.length / 3);
    return new THREE.TubeGeometry(curve, n, radius, tubularSegments, turn.closed);
  }, [turn, radius, tubularSegments]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
    </mesh>
  );
}
