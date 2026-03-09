import type { ICommand } from '../stores/useHistoryStore';
import type { CoilDefinition } from '../types/coil';
import { useSceneStore } from '../stores/useSceneStore';

export class UpdateCoilCommand implements ICommand {
  readonly description: string;
  constructor(
    private readonly id: string,
    private readonly before: Partial<CoilDefinition>,
    private readonly after: Partial<CoilDefinition>,
    label?: string,
  ) {
    this.description = label ?? 'Update coil';
  }
  execute(): void { useSceneStore.getState().updateCoil(this.id, this.after); }
  undo(): void { useSceneStore.getState().updateCoil(this.id, this.before); }
}
