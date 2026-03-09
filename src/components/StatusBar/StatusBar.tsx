import { useEditorStore } from '../../stores/useEditorStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useBFieldStore } from '../../stores/useBFieldStore';
import styles from './StatusBar.module.css';

export function StatusBar() {
  const selectedIds = useEditorStore(s => s.selectedIds);
  const mousePos = useEditorStore(s => s.mouseWorldPosition);
  const coils = useSceneStore(s => s.coils);
  const bfieldStatus = useBFieldStore(s => s.status);
  const bfieldEnabled = useEditorStore(s => s.bfieldEnabled);
  const validationResults = useSceneStore(s => s.validationResults);

  const totalErrors = Object.values(validationResults).reduce(
    (acc, r) => acc + r.violations.filter(v => v.severity === 'error').length, 0
  );
  const totalWarns = Object.values(validationResults).reduce(
    (acc, r) => acc + r.violations.filter(v => v.severity === 'warn').length, 0
  );

  const pos = mousePos
    ? `(${mousePos[0].toFixed(3)}, ${mousePos[1].toFixed(3)}, ${mousePos[2].toFixed(3)}) m`
    : '—';

  return (
    <div className={styles.bar}>
      <span className={styles.item}>Cursor: {pos}</span>
      <span className={styles.sep}>|</span>
      <span className={styles.item}>
        {Object.keys(coils).length} coil{Object.keys(coils).length !== 1 ? 's' : ''}
        {selectedIds.length > 0 ? `, ${selectedIds.length} selected` : ''}
      </span>
      {bfieldEnabled && (
        <>
          <span className={styles.sep}>|</span>
          <span className={styles.item}>
            B-field: {bfieldStatus === 'computing' ? 'computing…' : bfieldStatus}
          </span>
        </>
      )}
      {(totalErrors > 0 || totalWarns > 0) && (
        <>
          <span className={styles.sep}>|</span>
          {totalErrors > 0 && (
            <span className={`${styles.item} ${styles.error}`}>✕ {totalErrors} bend error{totalErrors !== 1 ? 's' : ''}</span>
          )}
          {totalWarns > 0 && (
            <span className={`${styles.item} ${styles.warn}`}>⚠ {totalWarns} bend warning{totalWarns !== 1 ? 's' : ''}</span>
          )}
        </>
      )}
    </div>
  );
}
