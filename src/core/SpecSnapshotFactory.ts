import type { ISpecDocuments } from './model/ISpecDocuments';
import type { ISpecSnapshot } from './model/ISpecSnapshot';
import type { TasksMarkdownParser } from './parsing/TasksMarkdownParser';
import type { SpecProgressCalculator } from './status/SpecProgressCalculator';
import type { SpecStatusResolver } from './status/SpecStatusResolver';

/** Raw text inputs read from a spec folder, any of which may be absent. */
export interface ISpecRawInput {
  /** Spec name (the folder name under `.kiro/specs/`). */
  readonly name: string;
  /** Absolute path of the spec folder. */
  readonly folderPath: string;
  /** Absolute path of the owning workspace folder. */
  readonly workspacePath: string;
  /** Raw `tasks.md` text, or `undefined` when absent/unreadable. */
  readonly tasksContent: string | undefined;
  /** Presence of the annex documents. */
  readonly documents: ISpecDocuments;
}

/**
 * Pure factory assembling an {@link ISpecSnapshot} from raw spec input.
 *
 * It wires the parser, progress calculator and status resolver together without
 * any I/O, so the whole snapshot derivation is unit- and property-testable and
 * the repository stays a thin file-system shell.
 */
export class SpecSnapshotFactory {
  private readonly parser: TasksMarkdownParser;

  private readonly calculator: SpecProgressCalculator;

  private readonly resolver: SpecStatusResolver;

  /**
   * Build a factory from the core collaborators.
   * @param parser Parser turning `tasks.md` text into tasks.
   * @param calculator Calculator deriving the progress ratios.
   * @param resolver Resolver mapping documents + progress to a status.
   */
  public constructor(
    parser: TasksMarkdownParser,
    calculator: SpecProgressCalculator,
    resolver: SpecStatusResolver,
  ) {
    this.parser = parser;
    this.calculator = calculator;
    this.resolver = resolver;
  }

  /**
   * Assemble an immutable snapshot from one spec's raw input.
   * @param input The raw text and document-presence of a spec.
   * @returns The immutable snapshot for presentation layers.
   */
  public create(input: ISpecRawInput): ISpecSnapshot {
    const tasks = this.parser.parse(input.tasksContent ?? '');
    const progress = this.calculator.calculate(tasks);
    const status = this.resolver.resolve(input.documents, progress);
    return {
      name: input.name,
      folderPath: input.folderPath,
      workspacePath: input.workspacePath,
      documents: input.documents,
      status,
      progress,
    };
  }
}
