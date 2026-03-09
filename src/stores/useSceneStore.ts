import { create } from 'zustand';
import type { CoilDefinition } from '../types/coil';
import type { GroupNode } from '../types/scene';
import type { ExpandedCoilGeometry } from '../types/geometry';
import type { ValidationResult } from '../types/violations';

interface SceneStore {
  coils: Record<string, CoilDefinition>;
  groups: Record<string, GroupNode>;
  rootOrder: string[]; // ordered list of top-level IDs (coil or group)
  expandedGeometry: Record<string, ExpandedCoilGeometry>;
  validationResults: Record<string, ValidationResult>;

  // Coil mutations
  addCoil: (def: CoilDefinition) => void;
  removeCoils: (ids: string[]) => void;
  updateCoil: (id: string, patch: Partial<CoilDefinition>) => void;

  // Geometry cache
  setExpandedGeometry: (id: string, geo: ExpandedCoilGeometry) => void;
  setValidationResult: (id: string, result: ValidationResult) => void;

  // Ordering
  reorderRoot: (ids: string[]) => void;

  // Groups
  createGroup: (name: string, childIds: string[], groupId: string) => void;
  dissolveGroup: (groupId: string) => void;
  toggleGroupExpanded: (groupId: string) => void;

  // Helpers
  getCoil: (id: string) => CoilDefinition | undefined;
  getAllCoils: () => CoilDefinition[];
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  coils: {},
  groups: {},
  rootOrder: [],
  expandedGeometry: {},
  validationResults: {},

  addCoil: (def) => set((s) => ({
    coils: { ...s.coils, [def.id]: def },
    rootOrder: def.groupId ? s.rootOrder : [...s.rootOrder, def.id],
  })),

  removeCoils: (ids) => set((s) => {
    const coils = { ...s.coils };
    const expGeo = { ...s.expandedGeometry };
    const valRes = { ...s.validationResults };
    ids.forEach((id) => {
      delete coils[id];
      delete expGeo[id];
      delete valRes[id];
    });
    return {
      coils,
      expandedGeometry: expGeo,
      validationResults: valRes,
      rootOrder: s.rootOrder.filter((id) => !ids.includes(id)),
    };
  }),

  updateCoil: (id, patch) => set((s) => ({
    coils: { ...s.coils, [id]: { ...s.coils[id], ...patch } },
    // Invalidate cached geometry when definition changes
    expandedGeometry: (() => {
      const e = { ...s.expandedGeometry };
      delete e[id];
      return e;
    })(),
  })),

  setExpandedGeometry: (id, geo) => set((s) => ({
    expandedGeometry: { ...s.expandedGeometry, [id]: geo },
  })),

  setValidationResult: (id, result) => set((s) => ({
    validationResults: { ...s.validationResults, [id]: result },
  })),

  reorderRoot: (ids) => set({ rootOrder: ids }),

  createGroup: (name, childIds, groupId) => set((s) => {
    const group: GroupNode = { kind: 'group', id: groupId, name, childIds, expanded: true };
    const groups = { ...s.groups, [groupId]: group };
    // Remove children from root, add group
    const rootOrder = [...s.rootOrder.filter((id) => !childIds.includes(id)), groupId];
    // Update coil groupId references
    const coils = { ...s.coils };
    childIds.forEach((id) => {
      if (coils[id]) coils[id] = { ...coils[id], groupId };
    });
    return { groups, rootOrder, coils };
  }),

  dissolveGroup: (groupId) => set((s) => {
    const group = s.groups[groupId];
    if (!group) return s;
    const groups = { ...s.groups };
    delete groups[groupId];
    // Clear groupId on children, add them back to rootOrder
    const coils = { ...s.coils };
    group.childIds.forEach((id) => {
      if (coils[id]) coils[id] = { ...coils[id], groupId: null };
    });
    const rootOrder = [...s.rootOrder.filter((id) => id !== groupId), ...group.childIds];
    return { groups, rootOrder, coils };
  }),

  toggleGroupExpanded: (groupId) => set((s) => {
    const group = s.groups[groupId];
    if (!group) return s;
    return { groups: { ...s.groups, [groupId]: { ...group, expanded: !group.expanded } } };
  }),

  getCoil: (id) => get().coils[id],
  getAllCoils: () => Object.values(get().coils),
}));
