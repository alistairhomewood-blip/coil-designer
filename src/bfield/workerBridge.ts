import type { BFieldWorkerRequest, BFieldWorkerResponse, BFieldResult, BFieldSampleGrid } from '../types/bfield';

type ResultCallback = (result: BFieldResult) => void;

let worker: Worker | null = null;
let pendingCallback: ResultCallback | null = null;
let pendingGrid: BFieldSampleGrid | null = null;
let pendingSamples: Float32Array | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./biotSavartWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<BFieldWorkerResponse>) => {
      const { fieldVectors, maxMagnitude } = e.data;
      if (pendingCallback && pendingGrid && pendingSamples) {
        const result: BFieldResult = {
          samplePositions: pendingSamples,
          fieldVectors,
          maxMagnitude,
          gridInfo: pendingGrid,
        };
        pendingCallback(result);
        pendingCallback = null;
        pendingGrid = null;
        pendingSamples = null;
      }
    };
    worker.onerror = (err) => {
      console.error('BField worker error:', err);
      pendingCallback = null;
    };
  }
  return worker;
}

export function requestField(
  coilWirePaths: BFieldWorkerRequest['coilWirePaths'],
  samplePositions: Float32Array,
  grid: BFieldSampleGrid,
  onResult: ResultCallback
): void {
  pendingCallback = onResult;
  pendingGrid = grid;
  // Keep a copy since we transfer the original buffer
  pendingSamples = samplePositions.slice();

  const msg: BFieldWorkerRequest = {
    type: 'COMPUTE_FIELD',
    coilWirePaths,
    samplePositions,
  };

  getWorker().postMessage(msg, { transfer: [samplePositions.buffer] });
}

export function terminateWorker(): void {
  worker?.terminate();
  worker = null;
  pendingCallback = null;
}
