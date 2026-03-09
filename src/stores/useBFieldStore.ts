import { create } from 'zustand';
import type { BFieldResult, BFieldSampleGrid, WorkerStatus } from '../types/bfield';

interface BFieldStore {
  status: WorkerStatus;
  result: BFieldResult | null;
  gridConfig: BFieldSampleGrid;
  setStatus: (s: WorkerStatus) => void;
  setResult: (r: BFieldResult) => void;
  updateGridConfig: (patch: Partial<BFieldSampleGrid>) => void;
  clearResult: () => void;
}

export const useBFieldStore = create<BFieldStore>((set) => ({
  status: 'idle',
  result: null,
  gridConfig: {
    type: 'plane_xy',
    center: [0, 0, 0],
    size: 0.5,
    resolution: 15,
  },
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result }),
  updateGridConfig: (patch) => set(s => ({ gridConfig: { ...s.gridConfig, ...patch } })),
  clearResult: () => set({ result: null, status: 'idle' }),
}));
