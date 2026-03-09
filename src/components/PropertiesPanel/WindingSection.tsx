import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { UpdateCoilCommand } from '../../commands/UpdateCoilCommand';
import { NumberInput } from '../common/NumberInput';
import { SectionHeader } from '../common/SectionHeader';
import type { WindingParams } from '../../types/coil';

interface Props { coilId: string; }

export function WindingSection({ coilId }: Props) {
  const coil = useSceneStore(s => s.coils[coilId]);
  const execute = useHistoryStore(s => s.execute);
  if (!coil) return null;

  const { winding } = coil;
  const upd = (patch: Partial<WindingParams>) => {
    execute(new UpdateCoilCommand(coilId, { winding }, { winding: { ...winding, ...patch } }));
  };

  return (
    <SectionHeader title="Winding">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NumberInput label="N" value={winding.turns} step={1} min={1} decimals={0}
          onChange={v => upd({ turns: Math.max(1, Math.round(v)) })} />
        <NumberInput label="P" unit="m" value={winding.pitch} step={0.0001} min={0.0001} decimals={4}
          onChange={v => upd({ pitch: v })} />
        <NumberInput label="Ly" value={winding.layers} step={1} min={1} decimals={0}
          onChange={v => upd({ layers: Math.max(1, Math.round(v)) })} />
        <NumberInput label="I" unit="A" value={coil.currentAmps} step={1} decimals={2}
          onChange={v => execute(new UpdateCoilCommand(coilId, { currentAmps: coil.currentAmps }, { currentAmps: v }))} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#aaa' }}>
          <span>Hand:</span>
          <button
            onClick={() => upd({ handedness: winding.handedness === 1 ? -1 : 1 })}
            style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #3a3a3a', background: '#242424', color: '#aaa', borderRadius: 4, cursor: 'pointer' }}
          >
            {winding.handedness === 1 ? 'RH' : 'LH'}
          </button>
          <span>Dir:</span>
          <button
            onClick={() => upd({ currentDirection: winding.currentDirection === 1 ? -1 : 1 })}
            style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #3a3a3a', background: '#242424', color: '#aaa', borderRadius: 4, cursor: 'pointer' }}
          >
            {winding.currentDirection === 1 ? '+' : '−'}
          </button>
        </div>
      </div>
    </SectionHeader>
  );
}
