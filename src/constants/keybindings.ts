export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: string;
}

export const KEYBINDINGS: KeyBinding[] = [
  { key: 'KeyT', description: 'Translate mode', action: 'tool.translate' },
  { key: 'KeyR', description: 'Rotate mode', action: 'tool.rotate' },
  { key: 'KeyS', description: 'Scale mode', action: 'tool.scale' },
  { key: 'KeyG', description: 'Toggle grid', action: 'view.toggleGrid' },
  { key: 'KeyF', description: 'Frame selected', action: 'view.frameSelected' },
  { key: 'KeyH', description: 'Hide/show selected', action: 'coil.toggleVisible' },
  { key: 'KeyL', description: 'Lock/unlock selected', action: 'coil.toggleLocked' },
  { key: 'Delete', description: 'Delete selected', action: 'coil.delete' },
  { key: 'Backspace', description: 'Delete selected', action: 'coil.delete' },
  { key: 'KeyD', ctrl: true, description: 'Duplicate selected', action: 'coil.duplicate' },
  { key: 'KeyZ', ctrl: true, description: 'Undo', action: 'history.undo' },
  { key: 'KeyY', ctrl: true, description: 'Redo', action: 'history.redo' },
  { key: 'KeyZ', ctrl: true, shift: true, description: 'Redo', action: 'history.redo' },
  { key: 'KeyA', ctrl: true, description: 'Select all', action: 'selection.all' },
  { key: 'Escape', description: 'Deselect all', action: 'selection.none' },
  { key: 'KeyS', ctrl: true, description: 'Save project', action: 'io.save' },
  { key: 'KeyE', ctrl: true, description: 'Export wires', action: 'io.exportWires' },
  { key: 'Digit1', description: 'Simplified display', action: 'display.simplified' },
  { key: 'Digit2', description: 'Sampled turns display', action: 'display.sampled' },
  { key: 'Digit3', description: 'Full wire display', action: 'display.full' },
];
