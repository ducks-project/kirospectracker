import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type { ITranslator } from '../../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../../core/i18n/IdentityTranslator';
import type { ITaskItem } from '../../core/model/ITaskItem';
import { isResolved } from '../../core/model/TaskState';
import type { TasksMarkdownParser } from '../../core/parsing/TasksMarkdownParser';
import type { RunPromptBuilder } from '../../core/RunPromptBuilder';
import type { ISpecFileSystem } from '../ports/ISpecFileSystem';
import type { IWorkspaceGateway } from '../ports/IWorkspaceGateway';
import type { SpecRepository } from '../SpecRepository';
import { SpecStatus } from '../../core/model/SpecStatus';
import { documentFileName } from '../../core/SpecDocumentFiles';

/** Command identifier contributed in package.json. */
export const RUN_TASKS_COMMAND_ID = 'kirospectracker.runTasks';

/**
 * Flatten a task tree to its pending (unresolved) leaf titles, in order.
 *
 * A leaf is pending when it is neither done nor cancelled; a cancelled task is
 * treated as resolved and therefore omitted.
 * @param tasks The task tree.
 * @returns The titles of unresolved leaf tasks.
 */
function pendingLeafTitles(tasks: readonly ITaskItem[]): string[] {
  const titles: string[] = [];
  tasks.forEach((task) => {
    if (0 < task.children.length) {
      titles.push(...pendingLeafTitles(task.children));
      return;
    }
    if (!isResolved(task.state)) {
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

  private readonly fileSystem: ISpecFileSystem;

  private readonly parser: TasksMarkdownParser;
  private readonly translator: ITranslator;
  /**
   * Build the command over the repository, gateway, prompt builder and the
   * collaborators used to parse `tasks.md` on demand.
   * @param repository The spec repository.
   * @param gateway The workspace gateway.
   * @param promptBuilder The pure execution-prompt builder.
   * @param fileSystem The file-system port reading the spec's `tasks.md`.
   * @param parser The parser turning `tasks.md` text into a task tree.
   * @param translator The translator for user messages (English by default).
   */
  public constructor(
    repository: SpecRepository,
    gateway: IWorkspaceGateway,
    promptBuilder: RunPromptBuilder,
    fileSystem: ISpecFileSystem,
    parser: TasksMarkdownParser,
    translator: ITranslator = IDENTITY_TRANSLATOR,
  ) {
    this.repository = repository;
    this.gateway = gateway;
    this.promptBuilder = promptBuilder;
    this.fileSystem = fileSystem;
    this.parser = parser;
    this.translator = translator;
  }

  /**
   * Run the tasks of a spec: open `tasks.md`, then optionally copy a prompt.
   * @param folderPath Absolute path of the spec folder.
   */
  public async execute(folderPath: string): Promise<void> {
    const snapshot = this.findSpec(folderPath);
    if (undefined === snapshot) {
      this.gateway.showError(this.translator.t('No spec found at {0}.', folderPath));
      return;
    }
    if (SpecStatus.Malformed === snapshot.status) {
      this.gateway.showError(
        this.translator.t(
          '"{0}" is malformed (missing or unreadable tasks.md) and cannot be run.',
          snapshot.name,
        ),
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
    const consented = await this.gateway.confirm(
      this.translator.t('Copy a ready-to-paste execution prompt for this spec to the clipboard?'),
      this.translator.t('Copy prompt'),
    );
    if (!consented) {
      return;
    }
    const tasks = await this.readTasks(snapshot.folderPath);
    const prompt = this.promptBuilder.build(snapshot.name, pendingLeafTitles(tasks));
    await this.gateway.copyToClipboard(prompt);
    this.gateway.showInfo(this.translator.t('Execution prompt copied to the clipboard.'));
  }

  /**
   * Read and parse the spec's `tasks.md` on demand.
   * @param folderPath Absolute path of the spec folder.
   * @returns The parsed task tree; empty when the file is absent/unreadable.
   */
  private async readTasks(folderPath: string): Promise<readonly ITaskItem[]> {
    const tasksPath = this.fileSystem.join(folderPath, documentFileName('tasks'));
    const content = await this.fileSystem.readFile(tasksPath);
    if (undefined === content) {
      return [];
    }
    return this.parser.parse(content);
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
