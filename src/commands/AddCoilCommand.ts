import type { ICommand } from '../stores/useHistoryStore';
import type { CoilDefinition } from '../types/coil';
import { useSceneStore } from '../stores/useSceneStore';

export class AddCoilCommand implements ICommand {
  readonly description: string;
  constructor(private readonly coil: CoilDefinition) {
    this.description = `Add ${coil.name}`;
  }
  execute(): void { useSceneStore.getState().addCoil(this.coil); }
  undo(): void { useSceneStore.getState().removeCoils([this.coil.id]); }
}
