import { nanoid } from 'nanoid';

export function generateId(prefix = 'coil'): string {
  return `${prefix}-${nanoid(8)}`;
}
