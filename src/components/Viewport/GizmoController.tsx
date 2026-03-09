import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useEditorStore } from '../../stores/useEditorStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { TransformCoilCommand } from '../../commands/TransformCoilCommand';
import type { Transform3D } from '../../types/transform';
import * as THREE from 'three';

export function GizmoController() {
  const activeId = useEditorStore(s => s.activeId);
  const tool = useEditorStore(s => s.tool);
  const coil = useSceneStore(s => activeId ? s.coils[activeId] : null);
  const execute = useHistoryStore(s => s.execute);
  const beforeRef = useRef<Transform3D | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  if (!activeId || !coil || tool === 'select') return null;

  const [px, py, pz] = coil.transform.position;
  const [rx, ry, rz] = coil.transform.rotation;
  const [sx, sy, sz] = coil.transform.scale;

  return (
    <group ref={groupRef} position={[px, py, pz]} rotation={[rx, ry, rz]} scale={[sx, sy, sz]}>
      <TransformControls
        mode={tool}
        onMouseDown={() => { beforeRef.current = { ...coil.transform }; }}
        onChange={() => {
          if (!groupRef.current) return;
          const pos = groupRef.current.position;
          const rot = groupRef.current.rotation;
          const sc = groupRef.current.scale;
          const next: Transform3D = {
            position: [pos.x, pos.y, pos.z],
            rotation: [rot.x, rot.y, rot.z],
            scale: [sc.x, sc.y, sc.z],
          };
          // Live update without adding to history
          useSceneStore.getState().updateCoil(activeId, { transform: next });
        }}
        onMouseUp={() => {
          if (!beforeRef.current || !groupRef.current) return;
          const pos = groupRef.current.position;
          const rot = groupRef.current.rotation;
          const sc = groupRef.current.scale;
          const after: Transform3D = {
            position: [pos.x, pos.y, pos.z],
            rotation: [rot.x, rot.y, rot.z],
            scale: [sc.x, sc.y, sc.z],
          };
          execute(new TransformCoilCommand(activeId, beforeRef.current, after));
          beforeRef.current = null;
        }}
      >
        <mesh visible={false}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
        </mesh>
      </TransformControls>
    </group>
  );
}
