import { create } from 'zustand';

export interface ICommand {
  execute(): void;
  undo(): void;
  readonly description: string;
}

interface HistoryStore {
  past: ICommand[][];
  future: ICommand[][];
  canUndo: boolean;
  canRedo: boolean;
  execute: (cmd: ICommand | ICommand[]) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  execute: (cmd) => {
    const batch = Array.isArray(cmd) ? cmd : [cmd];
    batch.forEach(c => c.execute());
    set(s => {
      const past = [...s.past, batch];
      return { past, future: [], canUndo: true, canRedo: false };
    });
  },

  undo: () => {
    const { past } = get();
    if (past.length === 0) return;
    const batch = past[past.length - 1];
    [...batch].reverse().forEach(c => c.undo());
    set(s => {
      const newPast = s.past.slice(0, -1);
      const future = [batch, ...s.future];
      return { past: newPast, future, canUndo: newPast.length > 0, canRedo: true };
    });
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return;
    const batch = future[0];
    batch.forEach(c => c.execute());
    set(s => {
      const past = [...s.past, batch];
      const newFuture = s.future.slice(1);
      return { past, future: newFuture, canUndo: true, canRedo: newFuture.length > 0 };
    });
  },

  clear: () => set({ past: [], future: [], canUndo: false, canRedo: false }),
}));
