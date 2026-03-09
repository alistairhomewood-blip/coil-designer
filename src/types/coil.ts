import type { Transform3D } from './transform';

// ─── Conductor spec ───────────────────────────────────────────────────────────

export interface ConductorSpec {
  /** Outer diameter including insulation, meters */
  outerDiameter: number;
  /** Bare conductor diameter, meters */
  conductorDiameter: number;
  /** Minimum allowable bend radius, meters */
  minBendRadius: number;
  /** Material label: Cu, Al, REBCO, etc. */
  material: string;
}

// ─── Winding parameters ───────────────────────────────────────────────────────

export interface WindingParams {
  /** Total number of turns */
  turns: number;
  /** Center-to-center axial pitch between turns, meters */
  pitch: number;
  /** Number of radial winding layers */
  layers: number;
  /** 1 = right-hand, -1 = left-hand */
  handedness: 1 | -1;
  /** 1 = positive current, -1 = reversed */
  currentDirection: 1 | -1;
}

// ─── Per-shape geometry parameters ────────────────────────────────────────────

export interface CircularCoilParams {
  type: 'circular';
  /** Mean winding radius, meters */
  radius: number;
}

export interface RectangularCoilParams {
  type: 'rectangular';
  /** Full width (X extent), meters */
  width: number;
  /** Full height (Y extent), meters */
  height: number;
  /** Corner fillet radius, meters */
  cornerRadius: number;
}

export interface RacetrackCoilParams {
  type: 'racetrack';
  /** Straight section length, meters */
  straightLength: number;
  /** End semi-circle radius, meters */
  endRadius: number;
}

export interface EllipticalCoilParams {
  type: 'elliptical';
  /** Semi-axis along local X, meters */
  semiAxisA: number;
  /** Semi-axis along local Y, meters */
  semiAxisB: number;
}

export interface PolylineCoilParams {
  type: 'polyline';
  /** Control points in local XY plane, meters */
  controlPoints: [number, number][];
  /** Whether to close the path back to start */
  closed: boolean;
}

export type CoilShapeParams =
  | CircularCoilParams
  | RectangularCoilParams
  | RacetrackCoilParams
  | EllipticalCoilParams
  | PolylineCoilParams;

export type CoilType = CoilShapeParams['type'];

// ─── Top-level coil definition ────────────────────────────────────────────────

export interface CoilDefinition {
  /** Stable UUID — never changes after creation */
  id: string;
  /** User-visible label */
  name: string;
  transform: Transform3D;
  shape: CoilShapeParams;
  winding: WindingParams;
  conductor: ConductorSpec;
  /** Nominal current magnitude, Amperes */
  currentAmps: number;
  visible: boolean;
  locked: boolean;
  /** Hex color string, e.g. "#4488ff" */
  color: string;
  groupId: string | null;
  materialTag: string;
  notes: string;
}
