export type Axis = 'x' | 'y' | 'z';
export type CoordSpace = 'world' | 'local';

export interface Transform3D {
  position: [number, number, number]; // meters
  rotation: [number, number, number]; // Euler XYZ, radians
  scale: [number, number, number];    // dimensionless
}

export const DEFAULT_TRANSFORM: Transform3D = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
};
