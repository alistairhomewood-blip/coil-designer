import type { CoordSpace } from './transform';
import type { RenderOptions } from './display';

export type ToolMode = 'select' | 'translate' | 'rotate' | 'scale';

export interface SnapSettings {
  enabled: boolean;
  /** Translation snap grid size, meters */
  translationGrid: number;
  /** Rotation snap angle, radians */
  rotationGrid: number;
}

export interface EditorState {
  tool: ToolMode;
  coordSpace: CoordSpace;
  snap: SnapSettings;
  selectedIds: string[];
  activeId: string | null;
  renderOptions: RenderOptions;
  bfieldEnabled: boolean;
  mouseWorldPosition: [number, number, number] | null;
}
