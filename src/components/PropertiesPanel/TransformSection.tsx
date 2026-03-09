import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { TransformCoilCommand } from '../../commands/TransformCoilCommand';
import { VectorInput } from '../common/VectorInput';
import { SectionHeader } from '../common/SectionHeader';
import { rad2deg, deg2rad } from '../../utils/math';

interface Props { coilId: string; }

export function TransformSection({ coilId }: Props) {
  const coil = useSceneStore(s => s.coils[coilId]);
  const execute = useHistoryStore(s => s.execute);
  if (!coil) return null;

  const { position, rotation, scale } = coil.transform;
  const rotDeg: [number,number,number] = [rad2deg(rotation[0]), rad2deg(rotation[1]), rad2deg(rotation[2])];

  const applyPos = (pos: [number,number,number]) => {
    execute(new TransformCoilCommand(coilId, coil.transform, { ...coil.transform, position: pos }));
  };
  const applyRot = (deg: [number,number,number]) => {
    const rot: [number,number,number] = [deg2rad(deg[0]), deg2rad(deg[1]), deg2rad(deg[2])];
    execute(new TransformCoilCommand(coilId, coil.transform, { ...coil.transform, rotation: rot }));
  };
  const applyScale = (s: [number,number,number]) => {
    execute(new TransformCoilCommand(coilId, coil.transform, { ...coil.transform, scale: s }));
  };

  return (
    <SectionHeader title="Transform">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Position (m)</div>
          <VectorInput value={position} onChange={applyPos} unit="m" step={0.001} decimals={4} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Rotation (°)</div>
          <VectorInput value={rotDeg} onChange={applyRot} unit="°" step={1} decimals={2} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Scale</div>
          <VectorInput value={scale} onChange={applyScale} step={0.1} decimals={3} />
        </div>
      </div>
    </SectionHeader>
  );
}
