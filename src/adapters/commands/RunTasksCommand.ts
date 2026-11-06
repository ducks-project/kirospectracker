import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type { ITaskItem } from '../../core/model/ITaskItem';
import type { RunPromptBuilder } from '../../core/RunPromptBuilder';
import type { IWorkspaceGateway } from '../ports/IWorkspaceGateway';
import type { SpecRepository } from '../SpecRepository';
import { SpecStatus } from '../../core/model/SpecStatus';
import { documentFileName } from '../../core/SpecDocumentFiles';

/** Command identifier contributed in package.json. */
export const RUN_TASKS_COMMAND_ID = 'kirospectracker.runTasks';

/** Consent question shown before any clipboard write. */
const CONSENT_MESSAGE = 'Copy a ready-to-paste execution prompt for this spec to the clipboard?';

/** Affirmative label of the consent prompt. */
const CONSENT_CONFIRM = 'Copy prompt';

/**
 * Flatten a task tree to its pending (not-done) leaf titles, in order.
 * @param tasks The task tree.
 * @returns The titles of not-done leaf tasks.
 */
function pendingLeafTitles(tasks: readonly ITaskItem[]): string[] {
  const titles: string[] = [];
  tasks.forEach((task) => {
    if (0 < task.children.length) {
      titles.push(...pendingLeafTitles(task.children));
      return;
    }
    if (!task.done) {
      titles.push(task.title);
    }
  });
  return titles;
}

/**
 * Honest "Run tasks" MVP command.
 *
 * It opens the spec's `tasks.md` and, ONLY after explicit consent, copies a
 * ready-to-paste execution prompt to the clipboard. It refuses a `Malformed`
 * spec with a clear message and depends on NO undocumented Kiro command. All
 * host interaction goes through the injected {@link IWorkspaceGateway}.
 */
export class RunTasksCommand {
  private readonly repository: SpecRepository;

  private readonly gateway: IWorkspaceGateway;

  private readonly promptBuilder: RunPromptBuilder;

  /**
   * Build the command over the repository, gateway and prompt builder.
   * @param repository The spec repository.
   * @param gateway The workspace gateway.
   * @param promptBuilder The pure execution-prompt builder.
   */
  public constructor(
    repository: SpecRepository,
    gateway: IWorkspaceGateway,
    promptBuilder: RunPromptBuilder,
  ) {
    this.repository = repository;
    this.gateway = gateway;
    this.promptBuilder = promptBuilder;
  }

  /**
   * Run the tasks of a spec: open `tasks.md`, then optionally copy a prompt.
   * @param folderPath Absolute path of the spec folder.
   */
  public async execute(folderPath: string): Promise<void> {
    const snapshot = this.findSpec(folderPath);
    if (undefined === snapshot) {
      this.gateway.showError(`No spec found at ${folderPath}.`);
      return;
    }
    if (SpecStatus.Malformed === snapshot.status) {
      this.gateway.showError(
        `"${snapshot.name}" is malformed (missing or unreadable tasks.md) and cannot be run.`,
      );
      return;
    }
    await this.gateway.openDocument(`${folderPath}/${documentFileName('tasks')}`);
    await this.maybeCopyPrompt(snapshot);
  }

  /**
   * Copy the execution prompt to the clipboard after explicit consent only.
   * @param snapshot The spec snapshot.
   */
  private async maybeCopyPrompt(snapshot: ISpecSnapshot): Promise<void> {
    const consented = await this.gateway.confirm(CONSENT_MESSAGE, CONSENT_CONFIRM);
    if (!consented) {
      return;
    }
    const prompt = this.promptBuilder.build(snapshot.name, pendingLeafTitles(snapshot.tasks));
    await this.gateway.copyToClipboard(prompt);
    this.gateway.showInfo('Execution prompt copied to the clipboard.');
  }

  /**
   * Find the cached snapshot for a folder path.
   * @param folderPath Absolute path of the spec folder.
   * @returns The snapshot, or `undefined`.
   */
  private findSpec(folderPath: string): ISpecSnapshot | undefined {
    return this.repository.getSpecs().find((snapshot) => snapshot.folderPath === folderPath);
  }
}
