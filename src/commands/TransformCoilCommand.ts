import type { ICommand } from '../stores/useHistoryStore';
import type { Transform3D } from '../types/transform';
import { useSceneStore } from '../stores/useSceneStore';

export class TransformCoilCommand implements ICommand {
  readonly description = 'Move coil';
  constructor(
    private readonly id: string,
    private readonly before: Transform3D,
    private readonly after: Transform3D,
  ) {}
  execute(): void { useSceneStore.getState().updateCoil(this.id, { transform: this.after }); }
  undo(): void { useSceneStore.getState().updateCoil(this.id, { transform: this.before }); }
}
