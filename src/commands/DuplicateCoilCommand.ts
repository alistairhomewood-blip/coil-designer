import type { ICommand } from '../stores/useHistoryStore';
import type { CoilDefinition } from '../types/coil';
import { useSceneStore } from '../stores/useSceneStore';

export class DuplicateCoilCommand implements ICommand {
  readonly description: string;
  constructor(
    private readonly original: CoilDefinition,
    private readonly duplicate: CoilDefinition,
  ) {
    this.description = `Duplicate ${original.name}`;
  }
  execute(): void { useSceneStore.getState().addCoil(this.duplicate); }
  undo(): void { useSceneStore.getState().removeCoils([this.duplicate.id]); }
}
