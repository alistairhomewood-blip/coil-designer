import { useEditorStore } from '../../stores/useEditorStore';
import { useSceneStore } from '../../stores/useSceneStore';
import { useHistoryStore } from '../../stores/useHistoryStore';
import { useUIStore } from '../../stores/useUIStore';
import { AddCoilCommand } from '../../commands/AddCoilCommand';
import { makeDefaultCoil } from '../../constants/defaults';
import { generateId } from '../../utils/id';
import { downloadProjectFile } from '../../io/projectSerializer';
import { downloadWireExport } from '../../io/wireExporter';
import { ToggleButton } from '../common/ToggleButton';
import { DisplayMode } from '../../types/display';
import styles from './Toolbar.module.css';

const COIL_TYPES = ['circular', 'rectangular', 'racetrack', 'elliptical', 'polyline'] as const;
const DISPLAY_MODES: { key: DisplayMode; label: string }[] = [
  { key: DisplayMode.Simplified, label: '1' },
  { key: DisplayMode.SampledTurns, label: '2' },
  { key: DisplayMode.FullExplicitWire, label: '3' },
];

export function Toolbar() {
  const tool = useEditorStore(s => s.tool);
  const setTool = useEditorStore(s => s.setTool);
  const renderOptions = useEditorStore(s => s.renderOptions);
  const setDisplayMode = useEditorStore(s => s.setDisplayMode);
  const bfieldEnabled = useEditorStore(s => s.bfieldEnabled);
  const toggleBField = useEditorStore(s => s.toggleBField);
  const execute = useHistoryStore(s => s.execute);
  const canUndo = useHistoryStore(s => s.canUndo);
  const canRedo = useHistoryStore(s => s.canRedo);
  const undo = useHistoryStore(s => s.undo);
  const redo = useHistoryStore(s => s.redo);
  const coils = useSceneStore(s => s.coils);
  const groups = useSceneStore(s => s.groups);
  const rootOrder = useSceneStore(s => s.rootOrder);
  const expandedGeometry = useSceneStore(s => s.expandedGeometry);
  const setActiveModal = useUIStore(s => s.setActiveModal);

  const addCoil = (type: typeof COIL_TYPES[number]) => {
    const id = generateId('coil');
    const coil = makeDefaultCoil(id, type.charAt(0).toUpperCase() + type.slice(1));
    (coil.shape as { type: string }).type = type;
    execute(new AddCoilCommand(coil));
  };

  const handleSave = () => {
    downloadProjectFile(coils, groups, rootOrder);
  };

  const handleExportWires = () => {
    downloadWireExport(Object.values(coils), Object.values(expandedGeometry));
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <button className={styles.btn} onClick={handleSave} title="Save project (Ctrl+S)">Save</button>
        <button className={styles.btn} onClick={() => setActiveModal('openProject')} title="Open project">Open</button>
        <button className={styles.btn} onClick={handleExportWires} title="Export wire geometry (Ctrl+E)">Export</button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <button className={styles.btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</button>
        <button className={styles.btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪</button>
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        {(['translate', 'rotate', 'scale'] as const).map(t => (
          <ToggleButton key={t} active={tool === t} onClick={() => setTool(t)} title={`${t} (${t[0].toUpperCase()})`}>
            {t === 'translate' ? 'T' : t === 'rotate' ? 'R' : 'S'}
          </ToggleButton>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>Add:</span>
        {COIL_TYPES.map(type => (
          <button key={type} className={styles.btn} onClick={() => addCoil(type)} title={`Add ${type} coil`}>
            {type.slice(0, 4)}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <span className={styles.label}>View:</span>
        {DISPLAY_MODES.map(({ key, label }) => (
          <ToggleButton key={key} active={renderOptions.displayMode === key} onClick={() => setDisplayMode(key)} title={key.replace('_', ' ')}>
            {label}
          </ToggleButton>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.group}>
        <ToggleButton active={bfieldEnabled} onClick={toggleBField} title="Toggle B-field preview">B</ToggleButton>
      </div>
    </div>
  );
}
