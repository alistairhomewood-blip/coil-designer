import type { ICommand } from '../stores/useHistoryStore';
import type { CoilDefinition } from '../types/coil';
import { useSceneStore } from '../stores/useSceneStore';

export class RemoveCoilCommand implements ICommand {
  readonly description: string;
  constructor(private readonly coil: CoilDefinition) {
    this.description = `Remove ${coil.name}`;
  }
  execute(): void { useSceneStore.getState().removeCoils([this.coil.id]); }
  undo(): void { useSceneStore.getState().addCoil(this.coil); }
}
