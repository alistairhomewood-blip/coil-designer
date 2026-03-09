import { useSceneStore } from '../../stores/useSceneStore';

export function ViolationMarkers() {
  const validationResults = useSceneStore(s => s.validationResults);

  const markers: Array<{ pos: [number,number,number]; color: string; key: string }> = [];

  for (const result of Object.values(validationResults)) {
    for (const v of result.violations) {
      markers.push({
        pos: v.worldPosition,
        color: v.severity === 'error' ? '#ff3333' : '#ffaa00',
        key: `${v.coilId}-${v.turnIndex}-${v.pointIndex}`,
      });
    }
  }

  if (markers.length === 0) return null;

  return (
    <group>
      {markers.map(m => (
        <mesh key={m.key} position={m.pos}>
          <sphereGeometry args={[0.003, 8, 8]} />
          <meshBasicMaterial color={m.color} />
        </mesh>
      ))}
    </group>
  );
}
