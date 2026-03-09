import { Toolbar } from '../Toolbar/Toolbar';
import { SceneList } from '../SceneList/SceneList';
import { PropertiesPanel } from '../PropertiesPanel/PropertiesPanel';
import { Viewport } from '../Viewport/Viewport';
import { StatusBar } from '../StatusBar/StatusBar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import styles from './AppLayout.module.css';

export function AppLayout() {
  useKeyboardShortcuts();

  return (
    <div className={styles.shell}>
      <div className={styles.toolbar}>
        <Toolbar />
      </div>
      <div className={styles.main}>
        <div className={styles.left}>
          <SceneList />
        </div>
        <div className={styles.center}>
          <Viewport />
        </div>
        <div className={styles.right}>
          <PropertiesPanel />
        </div>
      </div>
      <div className={styles.status}>
        <StatusBar />
      </div>
    </div>
  );
}
