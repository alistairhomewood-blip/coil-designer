/**
 * A single wire turn represented as an ordered list of world-space 3D points.
 * Points are stored as a flat Float32Array: [x0,y0,z0, x1,y1,z1, ...]
 *
 * This is the fundamental output of the geometry expansion layer and maps
 * directly to TubeGeometry in Three.js.
 */
export interface TurnGeometry {
  /** 0-based index within the coil winding order */
  turnIndex: number;
  /** 0-based radial layer index */
  layerIndex: number;
  /** World-space path: flat [x,y,z,...] */
  points: Float32Array;
  /** True arc length of this turn, meters */
  arcLength: number;
  /** Whether the path closes back to its first point */
  closed: boolean;
}

/**
 * Complete expanded geometry for one CoilDefinition.
 * Recomputed whenever the CoilDefinition changes.
 */
export interface ExpandedCoilGeometry {
  /** Matches CoilDefinition.id */
  coilId: string;
  /** Hash of the source CoilDefinition — used to detect staleness */
  sourceHash: string;
  /** All turns in winding order */
  turns: TurnGeometry[];
  /** Sum of all turn arcLengths, meters */
  totalWireLength: number;
  /** World-space AABB: [minX, minY, minZ, maxX, maxY, maxZ] */
  boundingBox: [number, number, number, number, number, number];
}
