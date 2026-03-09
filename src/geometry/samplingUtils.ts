export function resamplePath(points: Float32Array, n: number): Float32Array {
  const inCount = points.length / 3;
  if (n < 2) throw new RangeError('n must be ≥ 2');
  if (inCount < 2) {
    const out = new Float32Array(n * 3);
    out.set(points.subarray(0, Math.min(points.length, n * 3)));
    return out;
  }

  const cumLen = new Float32Array(inCount);
  for (let i = 1; i < inCount; i++) {
    const dx=points[i*3]-points[(i-1)*3], dy=points[i*3+1]-points[(i-1)*3+1], dz=points[i*3+2]-points[(i-1)*3+2];
    cumLen[i] = cumLen[i-1] + Math.sqrt(dx*dx+dy*dy+dz*dz);
  }
  const totalLen = cumLen[inCount - 1];
  const out = new Float32Array(n * 3);
  let seg = 0;

  for (let j = 0; j < n; j++) {
    const target = (j / (n - 1)) * totalLen;
    while (seg < inCount - 2 && cumLen[seg + 1] < target) seg++;
    const segLen = cumLen[seg+1] - cumLen[seg];
    let t = segLen > 1e-15 ? (target - cumLen[seg]) / segLen : 0;
    t = Math.max(0, Math.min(1, t));
    const i0=seg, i1=seg+1;
    out[j*3]   = points[i0*3]   + (points[i1*3]   - points[i0*3])   * t;
    out[j*3+1] = points[i0*3+1] + (points[i1*3+1] - points[i0*3+1]) * t;
    out[j*3+2] = points[i0*3+2] + (points[i1*3+2] - points[i0*3+2]) * t;
  }
  return out;
}

export function sampleTurnIndices(totalTurns: number, n: number): number[] {
  if (totalTurns <= 0) return [];
  const count = Math.max(1, Math.min(n, totalTurns));
  if (count === 1) return [0];
  if (count >= totalTurns) return Array.from({ length: totalTurns }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(Math.round((i / (count - 1)) * (totalTurns - 1)));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}
