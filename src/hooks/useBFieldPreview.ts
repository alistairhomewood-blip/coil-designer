import { useEffect, useRef } from 'react';
import { useSceneStore } from '../stores/useSceneStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useBFieldStore } from '../stores/useBFieldStore';
import { generateSamplePositions } from '../bfield/sampleGrid';
import { requestField } from '../bfield/workerBridge';

export function useBFieldPreview(): void {
  const bfieldEnabled = useEditorStore(s => s.bfieldEnabled);
  const gridConfig = useBFieldStore(s => s.gridConfig);
  const setStatus = useBFieldStore(s => s.setStatus);
  const setResult = useBFieldStore(s => s.setResult);
  const expandedGeometry = useSceneStore(s => s.expandedGeometry);
  const coils = useSceneStore(s => s.coils);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bfieldEnabled) { setStatus('idle'); return; }

    // Debounce 300ms
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const wirePaths = Object.values(coils)
        .filter(c => c.visible)
        .flatMap(coil => {
          const geo = expandedGeometry[coil.id];
          if (!geo) return [];
          return geo.turns.map(t => ({
            points: t.points,
            currentAmps: coil.currentAmps,
            currentDirection: coil.winding.currentDirection,
          }));
        });

      if (wirePaths.length === 0) { setStatus('idle'); return; }

      setStatus('computing');
      const samplePositions = generateSamplePositions(gridConfig);
      const coilWirePaths = wirePaths.map(w => ({
        points: w.points,
        currentAmps: w.currentAmps,
        currentDirection: w.currentDirection as 1 | -1,
      }));

      requestField(coilWirePaths, samplePositions, gridConfig, (result) => {
        setResult(result);
        setStatus('done');
      });
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bfieldEnabled, gridConfig, coils, expandedGeometry]); // eslint-disable-line react-hooks/exhaustive-deps
}
