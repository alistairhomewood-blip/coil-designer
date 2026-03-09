import { useSceneStore } from '../../stores/useSceneStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { SceneListItem } from './SceneListItem';
import styles from './SceneList.module.css';

export function SceneList() {
  const rootOrder = useSceneStore(s => s.rootOrder);
  const coils = useSceneStore(s => s.coils);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Scene</div>
      <div className={styles.list}>
        {rootOrder.map(id => {
          const coil = coils[id];
          if (!coil) return null;
          return <SceneListItem key={id} coilId={id} />;
        })}
        {rootOrder.length === 0 && (
          <div className={styles.empty}>No coils — use toolbar to add</div>
        )}
      </div>
    </div>
  );
}
