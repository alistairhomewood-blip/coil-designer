export enum DisplayMode {
  /** One representative shape per coil — fastest */
  Simplified = 'simplified',
  /** N evenly-spaced sample turns per coil */
  SampledTurns = 'sampled_turns',
  /** Every individual turn as explicit tube geometry */
  FullExplicitWire = 'full_explicit_wire',
}

export interface RenderOptions {
  displayMode: DisplayMode;
  /** Number of turns to show in SampledTurns mode (1–20) */
  sampledTurnCount: number;
  /** Tube radius as a multiplier of conductor outerDiameter */
  tubeRadiusScale: number;
  /** Radial segments for TubeGeometry (3–12) */
  tubeSegments: number;
  showGrid: boolean;
  showAxes: boolean;
  showBoundingBoxes: boolean;
  showViolationMarkers: boolean;
  showBFieldOverlay: boolean;
}
