import type { ExpandedCoilGeometry } from '../types/geometry';
import type { ConductorSpec } from '../types/coil';
import type { ValidationResult, BendViolation } from '../types/violations';
import { cross3, len3 } from '../utils/math';
import { BEND_WARN_MARGIN } from '../constants/physics';

const COLLINEAR_EPS = 1e-12;

export function checkBendRadius(geo: ExpandedCoilGeometry, conductor: ConductorSpec): ValidationResult {
  const { coilId, turns } = geo;
  const { minBendRadius } = conductor;
  const warnThreshold = minBendRadius * (1 + BEND_WARN_MARGIN);
  const violations: BendViolation[] = [];

  for (const turn of turns) {
    const { points, turnIndex } = turn;
    const n = points.length / 3;
    if (n < 3) continue;
    const limit = turn.closed ? n - 1 : n;

    for (let bi = 1; bi < limit - 1; bi++) {
      const ai = bi - 1, ci = bi + 1;
      const ax=points[ai*3], ay=points[ai*3+1], az=points[ai*3+2];
      const bx=points[bi*3], by=points[bi*3+1], bz=points[bi*3+2];
      const cx=points[ci*3], cy=points[ci*3+1], cz=points[ci*3+2];

      const ABx=bx-ax, ABy=by-ay, ABz=bz-az;
      const BCx=cx-bx, BCy=cy-by, BCz=cz-bz;
      const ACx=cx-ax, ACy=cy-ay, ACz=cz-az;

      const [crX,crY,crZ] = cross3(ABx,ABy,ABz, BCx,BCy,BCz);
      const crossMag = len3(crX,crY,crZ);
      if (crossMag < COLLINEAR_EPS) continue;

      // Menger circumradius: R = |AB|*|BC|*|AC| / (2*|AB×BC|)
      const R = (len3(ABx,ABy,ABz) * len3(BCx,BCy,BCz) * len3(ACx,ACy,ACz)) / (2 * crossMag);

      const isError = R < minBendRadius;
      const isWarn  = !isError && R < warnThreshold;
      if (isError || isWarn) {
        violations.push({ coilId, turnIndex, pointIndex: bi, worldPosition: [bx,by,bz], actualRadius: R, minAllowedRadius: minBendRadius, severity: isError ? 'error' : 'warn' });
      }
    }
  }
  return { coilId, violations, hasErrors: violations.some(v => v.severity==='error'), hasWarnings: violations.some(v => v.severity==='warn') };
}
