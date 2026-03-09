import { useSceneStore } from '../../stores/useSceneStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { RemoveCoilCommand } from '../../commands/RemoveCoilCommand';
import { UpdateCoilCommand } from '../../commands/UpdateCoilCommand';
import styles from './SceneList.module.css';

interface Props { coilId: string; }

export function SceneListItem({ coilId }: Props) {
  const coil = useSceneStore(s => s.coils[coilId]);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const select = useEditorStore(s => s.select);
  const execute = useHistoryStore(s => s.execute);
  const validationResults = useSceneStore(s => s.validationResults[coilId]);

  if (!coil) return null;
  const selected = selectedIds.includes(coilId);
  const hasError = validationResults?.hasErrors;
  const hasWarn = validationResults?.hasWarnings;

  const handleClick = (e: React.MouseEvent) => {
    select([coilId], e.ctrlKey || e.metaKey);
  };

  const toggleVisible = (e: React.MouseEvent) => {
    e.stopPropagation();
    execute(new UpdateCoilCommand(coilId, { visible: coil.visible }, { visible: !coil.visible }));
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    execute(new RemoveCoilCommand(coil));
  };

  return (
    <div
      className={`${styles.item} ${selected ? styles.selected : ''}`}
      onClick={handleClick}
    >
      <span
        className={styles.colorDot}
        style={{ background: coil.color }}
      />
      <span className={`${styles.name} ${!coil.visible ? styles.hidden : ''}`}>
        {coil.name}
      </span>
      {hasError && <span className={styles.errorDot} title="Bend radius errors" />}
      {!hasError && hasWarn && <span className={styles.warnDot} title="Bend radius warnings" />}
      <button className={styles.iconBtn} onClick={toggleVisible} title={coil.visible ? 'Hide' : 'Show'}>
        {coil.visible ? '●' : '○'}
      </button>
      <button className={styles.iconBtn} onClick={handleDelete} title="Delete">✕</button>
    </div>
  );
}
