export interface BendViolation {
  coilId: string;
  turnIndex: number;
  /** Index into TurnGeometry.points / 3 (i.e., the point triple index) */
  pointIndex: number;
  worldPosition: [number, number, number];
  /** Detected bend radius at this location, meters */
  actualRadius: number;
  /** Conductor minimum bend radius, meters */
  minAllowedRadius: number;
  /** 'warn' = within 10% of limit, 'error' = actual violation */
  severity: 'warn' | 'error';
}

export interface ValidationResult {
  coilId: string;
  violations: BendViolation[];
  hasErrors: boolean;
  hasWarnings: boolean;
}
