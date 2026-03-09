import type { CoilDefinition, ConductorSpec, WindingParams } from '../types/coil';
import type { RenderOptions } from '../types/display';
import type { SnapSettings } from '../types/editor';
import { DisplayMode } from '../types/display';
import { DEFAULT_TRANSFORM } from '../types/transform';
import { getMinBendRadius } from './physics';

export const DEFAULT_CONDUCTOR: ConductorSpec = {
  outerDiameter: 0.002,       // 2 mm
  conductorDiameter: 0.0016,  // 1.6 mm bare
  minBendRadius: getMinBendRadius('Cu', 0.002), // 10 mm
  material: 'Cu',
};

export const DEFAULT_WINDING: WindingParams = {
  turns: 10,
  pitch: 0.0025,  // 2.5 mm
  layers: 1,
  handedness: 1,
  currentDirection: 1,
};

export function makeDefaultCoil(id: string, name: string): CoilDefinition {
  return {
    id,
    name,
    transform: { ...DEFAULT_TRANSFORM },
    shape: { type: 'circular', radius: 0.05 },
    winding: { ...DEFAULT_WINDING },
    conductor: { ...DEFAULT_CONDUCTOR },
    currentAmps: 1.0,
    visible: true,
    locked: false,
    color: '#4488ff',
    groupId: null,
    materialTag: '',
    notes: '',
  };
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  displayMode: DisplayMode.SampledTurns,
  sampledTurnCount: 5,
  tubeRadiusScale: 1.0,
  tubeSegments: 6,
  showGrid: true,
  showAxes: true,
  showBoundingBoxes: false,
  showViolationMarkers: true,
  showBFieldOverlay: false,
};

export const DEFAULT_SNAP: SnapSettings = {
  enabled: false,
  translationGrid: 0.005,  // 5 mm
  rotationGrid: Math.PI / 12, // 15°
};

export const COIL_COLORS = [
  '#4488ff', '#ff4444', '#44cc44', '#ffaa00',
  '#aa44ff', '#00cccc', '#ff44aa', '#88cc00',
];
