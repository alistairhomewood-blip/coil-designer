import { useEditorStore } from '../../stores/useEditorStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { TransformSection } from './TransformSection';
import { ShapeSection } from './ShapeSection';
import { WindingSection } from './WindingSection';
import { ConductorSection } from './ConductorSection';
import { ViolationsSection } from './ViolationsSection';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useEditorStore(s => s.selectedIds);
  const coils = useSceneStore(s => s.coils);

  if (selectedIds.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Properties</div>
        <div className={styles.empty}>Select a coil to edit properties</div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Properties</div>
        <div className={styles.empty}>{selectedIds.length} coils selected</div>
      </div>
    );
  }

  const id = selectedIds[0];
  const coil = coils[id];

  if (!coil) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <input
          className={styles.nameInput}
          value={coil.name}
          onChange={() => {}} // handled via UpdateCoilCommand
          placeholder="Coil name"
        />
      </div>
      <div className={styles.sections}>
        <TransformSection coilId={id} />
        <ShapeSection coilId={id} />
        <WindingSection coilId={id} />
        <ConductorSection coilId={id} />
        <ViolationsSection coilId={id} />
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span>Wire length</span>
            <span>{(useSceneStore.getState().expandedGeometry[id]?.totalWireLength ?? 0).toFixed(3)} m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
