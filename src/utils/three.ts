import * as THREE from 'three';

/** Convert a flat Float32Array [x,y,z,...] to an array of THREE.Vector3 */
export function flatToVectors(flat: Float32Array): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < flat.length; i += 3) {
    out.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
  }
  return out;
}

/** Convert [number,number,number] tuple to THREE.Vector3 */
export function tupleToVector(t: [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(t[0], t[1], t[2]);
}

/** Convert [number,number,number] Euler XYZ radians to THREE.Euler */
export function tupleToEuler(t: [number, number, number]): THREE.Euler {
  return new THREE.Euler(t[0], t[1], t[2], 'XYZ');
}

/** Build a THREE.Matrix4 from position + euler rotation */
export function makeMatrix(
  position: [number, number, number],
  rotation: [number, number, number]
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(tupleToEuler(rotation));
  m.setPosition(position[0], position[1], position[2]);
  return m;
}
