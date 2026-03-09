import { useSceneStore } from '../../stores/useSceneStore';
import { SectionHeader } from '../common/SectionHeader';

interface Props { coilId: string; }

export function ViolationsSection({ coilId }: Props) {
  const result = useSceneStore(s => s.validationResults[coilId]);
  const geo = useSceneStore(s => s.expandedGeometry[coilId]);

  if (!result || result.violations.length === 0) {
    return (
      <SectionHeader title="Violations">
        <div style={{ fontSize: 12, color: '#555' }}>
          {geo ? '✓ No bend radius violations' : 'Computing…'}
        </div>
      </SectionHeader>
    );
  }

  const errors = result.violations.filter(v => v.severity === 'error');
  const warns  = result.violations.filter(v => v.severity === 'warn');

  return (
    <SectionHeader title={`Violations (${result.violations.length})`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {errors.length > 0 && (
          <div style={{ fontSize: 12, color: '#ff6666' }}>
            ✕ {errors.length} bend error{errors.length > 1 ? 's' : ''} — radius too small
          </div>
        )}
        {warns.length > 0 && (
          <div style={{ fontSize: 12, color: '#ffaa44' }}>
            ⚠ {warns.length} bend warning{warns.length > 1 ? 's' : ''} — near limit
          </div>
        )}
        <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
          Min allowed: {result.violations[0]?.minAllowedRadius.toFixed(4)} m
        </div>
        {result.violations.slice(0, 5).map((v, i) => (
          <div key={i} style={{ fontSize: 11, color: v.severity === 'error' ? '#ff6666' : '#ffaa44' }}>
            Turn {v.turnIndex}, pt {v.pointIndex}: R={v.actualRadius.toFixed(4)} m
          </div>
        ))}
        {result.violations.length > 5 && (
          <div style={{ fontSize: 11, color: '#555' }}>…and {result.violations.length - 5} more</div>
        )}
      </div>
    </SectionHeader>
  );
}
