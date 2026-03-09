import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { UpdateCoilCommand } from '../../commands/UpdateCoilCommand';
import { NumberInput } from '../common/NumberInput';
import { SectionHeader } from '../common/SectionHeader';
import { getMinBendRadius, BEND_RADIUS_MULTIPLIERS } from '../../constants/physics';
import type { ConductorSpec } from '../../types/coil';

interface Props { coilId: string; }

const MATERIALS = Object.keys(BEND_RADIUS_MULTIPLIERS).filter(k => k !== 'default');

export function ConductorSection({ coilId }: Props) {
  const coil = useSceneStore(s => s.coils[coilId]);
  const execute = useHistoryStore(s => s.execute);
  if (!coil) return null;

  const { conductor } = coil;
  const upd = (patch: Partial<ConductorSpec>) => {
    const next = { ...conductor, ...patch };
    // Auto-compute minBendRadius from material
    if (patch.material || patch.outerDiameter) {
      next.minBendRadius = getMinBendRadius(next.material, next.outerDiameter);
    }
    execute(new UpdateCoilCommand(coilId, { conductor }, { conductor: next }));
  };

  return (
    <SectionHeader title="Conductor">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {MATERIALS.map(m => (
            <button key={m} onClick={() => upd({ material: m })}
              style={{
                padding: '2px 7px', fontSize: 11, border: '1px solid',
                borderColor: conductor.material === m ? '#4488ff' : '#3a3a3a',
                background: conductor.material === m ? '#2a3f6f' : '#242424',
                color: conductor.material === m ? '#88bbff' : '#aaa',
                borderRadius: 4, cursor: 'pointer'
              }}>
              {m}
            </button>
          ))}
        </div>
        <NumberInput label="OD" unit="m" value={conductor.outerDiameter} step={0.0001} min={0.0001} decimals={4}
          onChange={v => upd({ outerDiameter: v })} />
        <NumberInput label="CD" unit="m" value={conductor.conductorDiameter} step={0.0001} min={0.0001} decimals={4}
          onChange={v => upd({ conductorDiameter: v })} />
        <NumberInput label="Rbend" unit="m" value={conductor.minBendRadius} step={0.001} min={0} decimals={4}
          onChange={v => upd({ minBendRadius: v })} />
      </div>
    </SectionHeader>
  );
}
