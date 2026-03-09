export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function deg2rad(deg: number): number {
  return deg * DEG2RAD;
}

export function rad2deg(rad: number): number {
  return rad * RAD2DEG;
}

export function snapTo(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/**
 * Simple string hash for change detection.
 * Not cryptographic — only used to detect CoilDefinition staleness.
 */
export function hashObject(obj: unknown): string {
  const str = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** Cross product of two 3-vectors given as flat arrays at offsets */
export function cross3(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

export function dot3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  return ax * bx + ay * by + az * bz;
}

export function len3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}
