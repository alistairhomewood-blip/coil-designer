/**
 * Minimum bend radius multipliers by material.
 * minBendRadius = K * outerDiameter
 *
 * Sources:
 *  - IEC 60228 / NEC guidelines for copper wire
 *  - REBCO tape manufacturer specs (typical)
 */
export const BEND_RADIUS_MULTIPLIERS: Record<string, number> = {
  Cu: 5,        // Solid copper (single core)
  'Cu-stranded': 7, // Stranded copper
  Al: 8,        // Aluminium
  REBCO: 30,    // REBCO HTS tape (critical axis)
  NbTi: 10,     // NbTi superconductor strand
  default: 10,
};

/** Warn when within this fraction of the limit (10% margin) */
export const BEND_WARN_MARGIN = 0.10;

/** μ₀ — magnetic permeability of free space, T·m/A (exact SI definition) */
export const MU_0 = 4 * Math.PI * 1e-7;

export function getMinBendRadius(material: string, outerDiameter: number): number {
  const k = BEND_RADIUS_MULTIPLIERS[material] ?? BEND_RADIUS_MULTIPLIERS.default;
  return k * outerDiameter;
}
