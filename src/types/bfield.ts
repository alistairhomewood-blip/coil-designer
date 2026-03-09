export type SamplePlane = 'plane_xy' | 'plane_xz' | 'plane_yz';

export interface BFieldSampleGrid {
  type: SamplePlane;
  center: [number, number, number];
  /** Physical size of the grid (square), meters */
  size: number;
  /** Number of sample points per axis */
  resolution: number;
}

export interface BFieldResult {
  /** Flat [x,y,z,...] world-space sample positions */
  samplePositions: Float32Array;
  /** Flat [Bx,By,Bz,...] field vectors at each sample, Tesla */
  fieldVectors: Float32Array;
  maxMagnitude: number;
  gridInfo: BFieldSampleGrid;
}

export type WorkerStatus = 'idle' | 'computing' | 'done' | 'error';

// Worker message protocol
export interface BFieldWorkerRequest {
  type: 'COMPUTE_FIELD';
  coilWirePaths: Array<{
    points: Float32Array;
    currentAmps: number;
    currentDirection: 1 | -1;
  }>;
  samplePositions: Float32Array;
}

export interface BFieldWorkerResponse {
  type: 'FIELD_RESULT';
  fieldVectors: Float32Array;
  maxMagnitude: number;
}

export interface BFieldWorkerError {
  type: 'ERROR';
  message: string;
}
