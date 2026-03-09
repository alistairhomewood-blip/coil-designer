import { MU_0 } from '../constants/physics';

const MU_0_OVER_4PI = MU_0 / (4 * Math.PI);

export interface WirePath {
  points: Float32Array; // flat [x,y,z,...]
  currentAmps: number;
  currentDirection: 1 | -1;
}

/**
 * Computes B-field at a single sample point from all wire paths.
 * Uses finite-segment Biot-Savart: dB = (μ₀/4π) * I * (dl × r̂) / |r|²
 */
export function computeFieldAtPoint(
  wx: number, wy: number, wz: number,
  wires: WirePath[]
): [number, number, number] {
  let Bx = 0, By = 0, Bz = 0;

  for (const wire of wires) {
    const { points, currentAmps, currentDirection } = wire;
    const I = currentAmps * currentDirection;
    const n = points.length / 3;
    if (n < 2) continue;

    for (let i = 0; i < n - 1; i++) {
      const ax = points[i*3],   ay = points[i*3+1],   az = points[i*3+2];
      const bx = points[i*3+3], by = points[i*3+4], bz = points[i*3+5];

      // Segment midpoint → sample vector
      const mx = (ax+bx)*0.5, my = (ay+by)*0.5, mz = (az+bz)*0.5;
      const rx = wx-mx, ry = wy-my, rz = wz-mz;
      const r2 = rx*rx + ry*ry + rz*rz;
      if (r2 < 1e-20) continue;
      const r3 = r2 * Math.sqrt(r2);

      // dl = b - a
      const dlx = bx-ax, dly = by-ay, dlz = bz-az;

      // dl × r
      const cx = dly*rz - dlz*ry;
      const cy = dlz*rx - dlx*rz;
      const cz = dlx*ry - dly*rx;

      const k = MU_0_OVER_4PI * I / r3;
      Bx += k * cx;
      By += k * cy;
      Bz += k * cz;
    }
  }

  return [Bx, By, Bz];
}

/**
 * Computes B-field at all sample points. Returns flat [Bx,By,Bz,...] array.
 */
export function computeField(
  samplePositions: Float32Array,
  wires: WirePath[]
): { fieldVectors: Float32Array; maxMagnitude: number } {
  const nSamples = samplePositions.length / 3;
  const fieldVectors = new Float32Array(nSamples * 3);
  let maxMagnitude = 0;

  for (let j = 0; j < nSamples; j++) {
    const wx = samplePositions[j*3], wy = samplePositions[j*3+1], wz = samplePositions[j*3+2];
    const [Bx, By, Bz] = computeFieldAtPoint(wx, wy, wz, wires);
    fieldVectors[j*3]   = Bx;
    fieldVectors[j*3+1] = By;
    fieldVectors[j*3+2] = Bz;
    const mag = Math.sqrt(Bx*Bx + By*By + Bz*Bz);
    if (mag > maxMagnitude) maxMagnitude = mag;
  }

  return { fieldVectors, maxMagnitude };
}
