import { computeField } from './biotSavart';
import type { BFieldWorkerRequest, BFieldWorkerResponse } from '../types/bfield';

self.onmessage = (e: MessageEvent<BFieldWorkerRequest>) => {
  const { coilWirePaths, samplePositions } = e.data;

  const wires = coilWirePaths.map(w => ({
    points: w.points,
    currentAmps: w.currentAmps,
    currentDirection: w.currentDirection,
  }));

  const { fieldVectors, maxMagnitude } = computeField(samplePositions, wires);

  const response: BFieldWorkerResponse = {
    type: 'FIELD_RESULT',
    fieldVectors,
    maxMagnitude,
  };

  (self as unknown as Worker).postMessage(response, { transfer: [fieldVectors.buffer] });
};
