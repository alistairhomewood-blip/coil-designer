import { z } from 'zod';
import type { ProjectFile } from '../types/export';
import type { CoilDefinition } from '../types/coil';
import type { GroupNode } from '../types/scene';

const CURRENT_VERSION = '1.0';

export function serializeProject(
  coils: Record<string, CoilDefinition>,
  groups: Record<string, GroupNode>,
  rootOrder: string[]
): ProjectFile {
  return {
    version: CURRENT_VERSION,
    schema: 'coil-geometry-editor-project',
    meta: {
      created: new Date().toISOString(),
      units: 'meters',
      description: '',
    },
    scene: { rootOrder, groups, coils },
  };
}

export function serializeProjectToString(
  coils: Record<string, CoilDefinition>,
  groups: Record<string, GroupNode>,
  rootOrder: string[]
): string {
  return JSON.stringify(serializeProject(coils, groups, rootOrder), null, 2);
}

// Minimal validation schema
const ProjectFileSchema = z.object({
  version: z.string(),
  schema: z.literal('coil-geometry-editor-project'),
  meta: z.object({
    created: z.string(),
    units: z.string(),
    description: z.string(),
  }),
  scene: z.object({
    rootOrder: z.array(z.string()),
    groups: z.record(z.any()),
    coils: z.record(z.any()),
  }),
});

export type ParseResult =
  | { ok: true; data: ProjectFile }
  | { ok: false; error: string };

export function parseProjectFromString(json: string): ParseResult {
  try {
    const raw = JSON.parse(json);
    const parsed = ProjectFileSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.message };
    }
    return { ok: true, data: parsed.data as ProjectFile };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function downloadProjectFile(
  coils: Record<string, CoilDefinition>,
  groups: Record<string, GroupNode>,
  rootOrder: string[]
): void {
  const json = serializeProjectToString(coils, groups, rootOrder);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.coilproject.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function openProjectFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.coilproject.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
