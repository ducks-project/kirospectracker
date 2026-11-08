import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type {
  ISpecAgentGateway,
  RunScope,
  SpecAgentAvailability,
} from '../../core/ports/ISpecAgentGateway';
import type { RunTasksCommand } from '../commands/RunTasksCommand';

/**
 * Null-Object fallback for {@link ISpecAgentGateway}.
 *
 * It reports `unavailable` and degrades both intents to the already-shipped,
 * honest MVP: open the spec's `tasks.md` and, only after explicit consent, copy
 * a ready-to-paste prompt (delegated to {@link RunTasksCommand}). It never throws
 * and never touches `kiroAgent.*`, so the extension stays fully functional on a
 * plain VS Code host or a Kiro build whose internal commands changed. Being a
 * Null Object, it removes any `if (gateway)` guard from the UI: callers always
 * hold a valid gateway.
 */
export class UnavailableAgentGateway implements ISpecAgentGateway {
  private readonly runTasksCommand: RunTasksCommand;

  /**
   * Build the fallback over the honest MVP run-tasks command.
   * @param runTasksCommand The existing consent-gated run-tasks command.
   */
  public constructor(runTasksCommand: RunTasksCommand) {
    this.runTasksCommand = runTasksCommand;
  }

  /**
   * Report the integration as unavailable so the UI can degrade honestly.
   * @returns Always `unavailable`.
   */
  // eslint-disable-next-line class-methods-use-this
  public availability(): SpecAgentAvailability {
    return 'unavailable';
  }

  /**
   * Degrade "sync files" to the honest MVP (open `tasks.md` + consented copy).
   * @param spec The spec snapshot.
   */
  public async syncTasks(spec: ISpecSnapshot): Promise<void> {
    await this.runTasksCommand.execute(spec.folderPath);
  }

  /**
   * Degrade "run tasks" to the honest MVP (open `tasks.md` + consented copy).
   * The scope is irrelevant to the fallback, which always offers the same
   * prompt; it is part of the signature only to honor the port contract.
   * @param spec The spec snapshot.
   * @param _scope The run scope (ignored by the fallback).
   */
  public async runTasks(spec: ISpecSnapshot, _scope?: RunScope): Promise<void> {
    await this.runTasksCommand.execute(spec.folderPath);
  }
}
