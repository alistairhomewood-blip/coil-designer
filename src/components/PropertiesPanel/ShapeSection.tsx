import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { UpdateCoilCommand } from '../../commands/UpdateCoilCommand';
import { NumberInput } from '../common/NumberInput';
import { SectionHeader } from '../common/SectionHeader';
import type { CoilShapeParams } from '../../types/coil';

interface Props { coilId: string; }

const SHAPE_TYPES = ['circular', 'rectangular', 'racetrack', 'elliptical', 'polyline'] as const;

export function ShapeSection({ coilId }: Props) {
  const coil = useSceneStore(s => s.coils[coilId]);
  const execute = useHistoryStore(s => s.execute);
  if (!coil) return null;

  const { shape } = coil;

  const update = (patch: Partial<CoilShapeParams>) => {
    const newShape = { ...shape, ...patch } as CoilShapeParams;
    execute(new UpdateCoilCommand(coilId, { shape }, { shape: newShape }));
  };

  const setType = (type: typeof SHAPE_TYPES[number]) => {
    let newShape: CoilShapeParams;
    switch (type) {
      case 'circular':    newShape = { type: 'circular', radius: 0.05 }; break;
      case 'rectangular': newShape = { type: 'rectangular', width: 0.1, height: 0.08, cornerRadius: 0.005 }; break;
      case 'racetrack':   newShape = { type: 'racetrack', straightLength: 0.08, endRadius: 0.025 }; break;
      case 'elliptical':  newShape = { type: 'elliptical', semiAxisA: 0.06, semiAxisB: 0.04 }; break;
      case 'polyline':    newShape = { type: 'polyline', controlPoints: [[0.05,0],[0,0.05],[-0.05,0],[0,-0.05]], closed: true }; break;
    }
    execute(new UpdateCoilCommand(coilId, { shape }, { shape: newShape }));
  };

  return (
    <SectionHeader title="Shape">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SHAPE_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: '3px 8px', fontSize: 11, border: '1px solid',
                borderColor: shape.type === t ? '#4488ff' : '#3a3a3a',
                background: shape.type === t ? '#2a3f6f' : '#242424',
                color: shape.type === t ? '#88bbff' : '#aaa',
                borderRadius: 4, cursor: 'pointer'
              }}
            >{t}</button>
          ))}
        </div>

        {shape.type === 'circular' && (
          <NumberInput label="R" unit="m" value={shape.radius} step={0.001} decimals={4} onChange={v => update({ radius: v })} />
        )}
        {shape.type === 'rectangular' && (<>
          <NumberInput label="W" unit="m" value={shape.width} step={0.001} decimals={4} onChange={v => update({ width: v })} />
          <NumberInput label="H" unit="m" value={shape.height} step={0.001} decimals={4} onChange={v => update({ height: v })} />
          <NumberInput label="R" unit="m" value={shape.cornerRadius} step={0.001} decimals={4} onChange={v => update({ cornerRadius: v })} />
        </>)}
        {shape.type === 'racetrack' && (<>
          <NumberInput label="L" unit="m" value={shape.straightLength} step={0.001} decimals={4} onChange={v => update({ straightLength: v })} />
          <NumberInput label="R" unit="m" value={shape.endRadius} step={0.001} decimals={4} onChange={v => update({ endRadius: v })} />
        </>)}
        {shape.type === 'elliptical' && (<>
          <NumberInput label="A" unit="m" value={shape.semiAxisA} step={0.001} decimals={4} onChange={v => update({ semiAxisA: v })} />
          <NumberInput label="B" unit="m" value={shape.semiAxisB} step={0.001} decimals={4} onChange={v => update({ semiAxisB: v })} />
        </>)}
        {shape.type === 'polyline' && (
          <div style={{ fontSize: 11, color: '#666' }}>
            {shape.controlPoints.length} control points (edit in viewport — coming soon)
          </div>
        )}
      </div>
    </SectionHeader>
  );
}
