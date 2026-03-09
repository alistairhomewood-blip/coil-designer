import type { ICommand } from '../stores/useHistoryStore';

export class BatchCommand implements ICommand {
  constructor(
    private readonly commands: ICommand[],
    readonly description: string,
  ) {}
  execute(): void { this.commands.forEach(c => c.execute()); }
  undo(): void { [...this.commands].reverse().forEach(c => c.undo()); }
}
