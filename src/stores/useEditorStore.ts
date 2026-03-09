import { create } from 'zustand';
import type { CoordSpace } from '../types/transform';
import type { ToolMode, SnapSettings } from '../types/editor';
import type { RenderOptions } from '../types/display';
import { DisplayMode } from '../types/display';
import { DEFAULT_RENDER_OPTIONS, DEFAULT_SNAP } from '../constants/defaults';

interface EditorStore {
  tool: ToolMode;
  coordSpace: CoordSpace;
  snap: SnapSettings;
  selectedIds: string[];
  activeId: string | null;
  renderOptions: RenderOptions;
  bfieldEnabled: boolean;
  mouseWorldPosition: [number, number, number] | null;

  setTool: (tool: ToolMode) => void;
  setCoordSpace: (space: CoordSpace) => void;
  setSnap: (patch: Partial<SnapSettings>) => void;
  select: (ids: string[], additive?: boolean) => void;
  deselect: (ids?: string[]) => void;
  setActiveId: (id: string | null) => void;
  setRenderOptions: (patch: Partial<RenderOptions>) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleBField: () => void;
  setMouseWorldPosition: (pos: [number, number, number] | null) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  tool: 'select',
  coordSpace: 'world',
  snap: { ...DEFAULT_SNAP },
  selectedIds: [],
  activeId: null,
  renderOptions: { ...DEFAULT_RENDER_OPTIONS },
  bfieldEnabled: false,
  mouseWorldPosition: null,

  setTool: (tool) => set({ tool }),
  setCoordSpace: (coordSpace) => set({ coordSpace }),
  setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),

  select: (ids, additive = false) => set((s) => {
    if (additive) {
      const merged = Array.from(new Set([...s.selectedIds, ...ids]));
      return { selectedIds: merged, activeId: ids[ids.length - 1] ?? s.activeId };
    }
    return { selectedIds: ids, activeId: ids[ids.length - 1] ?? null };
  }),

  deselect: (ids) => set((s) => {
    if (!ids) return { selectedIds: [], activeId: null };
    const selectedIds = s.selectedIds.filter((id) => !ids.includes(id));
    return { selectedIds, activeId: selectedIds.includes(s.activeId ?? '') ? s.activeId : (selectedIds[0] ?? null) };
  }),

  setActiveId: (activeId) => set({ activeId }),
  setRenderOptions: (patch) => set((s) => ({ renderOptions: { ...s.renderOptions, ...patch } })),
  setDisplayMode: (mode) => set((s) => ({ renderOptions: { ...s.renderOptions, displayMode: mode } })),
  toggleBField: () => set((s) => ({ bfieldEnabled: !s.bfieldEnabled })),
  setMouseWorldPosition: (mouseWorldPosition) => set({ mouseWorldPosition }),
}));
