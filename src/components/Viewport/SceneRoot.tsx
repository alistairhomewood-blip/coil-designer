import { useSceneStore } from '../../stores/useSceneStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { CoilObject } from './CoilObject';
import { ViolationMarkers } from './ViolationMarkers';
import { BFieldOverlay } from './BFieldOverlay';
import { GizmoController } from './GizmoController';

export function SceneRoot() {
  const coils = useSceneStore(s => s.coils);
  const rootOrder = useSceneStore(s => s.rootOrder);
  const select = useEditorStore(s => s.select);
  const deselect = useEditorStore(s => s.deselect);

  const handleCoilClick = (id: string, additive: boolean) => {
    select([id], additive);
  };

  const handleBackgroundClick = () => {
    deselect();
  };

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <pointLight position={[-5, -5, -5]} intensity={0.3} />

      {/* Grid and Axes */}
      <gridHelper args={[2, 20, '#333333', '#2a2a2a']} />
      <axesHelper args={[0.5]} />

      {/* Background click to deselect */}
      <mesh visible={false} onClick={handleBackgroundClick}>
        <planeGeometry args={[1000, 1000]} />
      </mesh>

      {/* Coils */}
      {rootOrder.map(id => {
        const coil = coils[id];
        if (!coil) return null;
        return <CoilObject key={id} coil={coil} onClick={handleCoilClick} />;
      })}

      {/* Overlays */}
      <ViolationMarkers />
      <BFieldOverlay />
      <GizmoController />
    </>
  );
}
