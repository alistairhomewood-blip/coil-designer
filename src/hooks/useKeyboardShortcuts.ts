import { useEffect } from 'react';
import { useSceneStore } from '../stores/useSceneStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useHistoryStore } from '../stores/useHistoryStore';
import { DisplayMode } from '../types/display';

export function useKeyboardShortcuts(): void {
  const select = useEditorStore(s => s.select);
  const deselect = useEditorStore(s => s.deselect);
  const setTool = useEditorStore(s => s.setTool);
  const setDisplayMode = useEditorStore(s => s.setDisplayMode);
  const selectedIds = useEditorStore(s => s.selectedIds);
  const removeCoils = useSceneStore(s => s.removeCoils);
  const coils = useSceneStore(s => s.coils);
  const undo = useHistoryStore(s => s.undo);
  const redo = useHistoryStore(s => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === 'a') { e.preventDefault(); select(Object.keys(coils)); return; }

      if (e.key === 'Escape') { deselect(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) { removeCoils(selectedIds); deselect(); }
        return;
      }

      if (!ctrl) {
        switch (e.key) {
          case 't': case 'T': setTool('translate'); break;
          case 'r': case 'R': setTool('rotate'); break;
          case 's': case 'S': setTool('scale'); break;
          case '1': setDisplayMode(DisplayMode.Simplified); break;
          case '2': setDisplayMode(DisplayMode.SampledTurns); break;
          case '3': setDisplayMode(DisplayMode.FullExplicitWire); break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [coils, selectedIds, select, deselect, setTool, setDisplayMode, removeCoils, undo, redo]);
}
