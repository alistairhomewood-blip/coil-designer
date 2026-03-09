import type { CoilDefinition } from '../types/coil';

export type AlignAxis = 'x' | 'y' | 'z';
export type AlignMode = 'min' | 'center' | 'max';
const AXIS_INDEX: Record<AlignAxis, 0|1|2> = { x:0, y:1, z:2 };

export function alignCoils(coils: CoilDefinition[], axis: AlignAxis, mode: AlignMode): CoilDefinition[] {
  if (!coils.length) return [];
  const idx = AXIS_INDEX[axis];
  const vals = coils.map(c => c.transform.position[idx]);
  const min = Math.min(...vals), max = Math.max(...vals);
  const target = mode === 'min' ? min : mode === 'max' ? max : (min+max)/2;
  return coils.map(c => {
    const pos = [...c.transform.position] as [number,number,number];
    pos[idx] = target;
    return { ...c, transform: { ...c.transform, position: pos } };
  });
}

export function distributeCoils(coils: CoilDefinition[], axis: AlignAxis): CoilDefinition[] {
  if (coils.length < 3) return coils.map(c => ({...c}));
  const idx = AXIS_INDEX[axis];
  const sorted = [...coils].sort((a,b) => a.transform.position[idx] - b.transform.position[idx]);
  const first = sorted[0].transform.position[idx], last = sorted[sorted.length-1].transform.position[idx];
  const posMap = new Map(sorted.map((c,i) => {
    const pos = [...c.transform.position] as [number,number,number];
    pos[idx] = first + (i/(sorted.length-1))*(last-first);
    return [c.id, pos];
  }));
  return coils.map(c => ({ ...c, transform: { ...c.transform, position: posMap.get(c.id)! } }));
}
