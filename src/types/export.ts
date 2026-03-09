import type { CoilDefinition } from './coil';
import type { GroupNode } from './scene';

export interface ProjectFileMeta {
  created: string;
  units: 'meters';
  description: string;
}

export interface ProjectFile {
  version: '1.0';
  schema: 'coil-geometry-editor-project';
  meta: ProjectFileMeta;
  scene: {
    rootOrder: string[];
    groups: Record<string, GroupNode>;
    coils: Record<string, CoilDefinition>;
  };
}

// Wire export — for Python magnetic-field pipeline

export interface WireExportTurn {
  turnIndex: number;
  layerIndex: number;
  arcLength: number;
  closed: boolean;
  /** Array of [x, y, z] triples — nested for Python readability */
  points: [number, number, number][];
}

export interface WireExportCoil {
  id: string;
  name: string;
  currentAmps: number;
  currentDirection: number;
  conductorOuterDiameter: number;
  totalTurns: number;
  totalWireLength: number;
  turns: WireExportTurn[];
}

export interface WireExportFile {
  version: '1.0';
  schema: 'coil-geometry-editor-wires';
  meta: {
    units: 'meters';
    coordinateSystem: 'right-hand';
    exportedAt: string;
  };
  coils: WireExportCoil[];
}
