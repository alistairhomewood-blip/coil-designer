import { useEffect } from 'react';
import { useSceneStore } from '../stores/useSceneStore';
import { expandCoil } from '../geometry/wireExpander';
import { checkBendRadius } from '../geometry/bendRadiusChecker';

/**
 * Watches coil definitions and recomputes ExpandedCoilGeometry when they change.
 * Runs in the background; updates are committed to the store.
 */
export function useCoilExpansion(): void {
  const coils = useSceneStore(s => s.coils);
  const expandedGeometry = useSceneStore(s => s.expandedGeometry);
  const setExpandedGeometry = useSceneStore(s => s.setExpandedGeometry);
  const setValidationResult = useSceneStore(s => s.setValidationResult);

  useEffect(() => {
    const allCoils = Object.values(coils);
    for (const coil of allCoils) {
      const existing = expandedGeometry[coil.id];
      if (existing && existing.sourceHash === coil.id) {
        // Already up to date — sourceHash is set to coil id as a placeholder
        // The real check is done via hashObject in wireExpander
      }
      // Always expand (wireExpander does its own hash check internally via sourceHash)
      try {
        const geo = expandCoil(coil);
        // Only update if hash changed
        if (!existing || existing.sourceHash !== geo.sourceHash) {
          setExpandedGeometry(coil.id, geo);
          const validation = checkBendRadius(geo, coil.conductor);
          setValidationResult(coil.id, validation);
        }
      } catch (e) {
        console.error(`Failed to expand coil ${coil.id}:`, e);
      }
    }
  }, [coils]); // eslint-disable-line react-hooks/exhaustive-deps
}
