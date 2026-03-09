import * as THREE from 'three';
import { useMemo } from 'react';
import { useBFieldStore } from '../../stores/useBFieldStore';
import { useEditorStore } from '../../stores/useEditorStore';

export function BFieldOverlay() {
  const bfieldEnabled = useEditorStore(s => s.bfieldEnabled);
  const result = useBFieldStore(s => s.result);
  const status = useBFieldStore(s => s.status);

  const arrows = useMemo(() => {
    if (!result || !bfieldEnabled) return [];
    const { fieldVectors, maxMagnitude } = result;
    // Note: samplePositions are stored separately; we'd need them here
    // For now, draw arrows at origin as placeholder — in production
    // we'd store positions alongside vectors in BFieldResult
    return [];
  }, [result, bfieldEnabled]);

  if (!bfieldEnabled || status === 'idle') return null;

  if (status === 'computing') {
    return null; // Status bar shows computing state
  }

  return (
    <group>
      {arrows.map((a, i) => (
        <arrowHelper key={i} />
      ))}
    </group>
  );
}
