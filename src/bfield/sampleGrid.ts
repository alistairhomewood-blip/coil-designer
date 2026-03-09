import type { BFieldSampleGrid } from '../types/bfield';

/**
 * Generates flat [x,y,z,...] sample positions from a grid config.
 */
export function generateSamplePositions(grid: BFieldSampleGrid): Float32Array {
  const { type, size, resolution, center } = grid;
  const n = resolution;
  const half = size / 2;
  const step = n > 1 ? size / (n - 1) : 0;
  const [cx, cy, cz] = center;

  const total = n * n;
  const positions = new Float32Array(total * 3);
  let idx = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = -half + i * step;
      const v = -half + j * step;
      let x = cx, y = cy, z = cz;
      if (type === 'plane_xy') { x = cx+u; y = cy+v; z = cz; }
      else if (type === 'plane_xz') { x = cx+u; y = cy; z = cz+v; }
      else { x = cx; y = cy+u; z = cz+v; } // yz
      positions[idx++] = x;
      positions[idx++] = y;
      positions[idx++] = z;
    }
  }

  return positions;
}
