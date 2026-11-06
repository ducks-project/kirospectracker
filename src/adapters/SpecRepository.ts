import type { ISpecDocuments } from '../core/model/ISpecDocuments';
import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';
import type { ISpecRawInput, SpecSnapshotFactory } from '../core/SpecSnapshotFactory';
import type { ISpecChangeNotifier } from './ports/ISpecChangeNotifier';
import type { ISpecFileSystem } from './ports/ISpecFileSystem';

/** Directory segment holding Kiro specs inside a workspace folder. */
const SPECS_SEGMENT_KIRO = '.kiro';

/** Second directory segment of the specs root. */
const SPECS_SEGMENT_SPECS = 'specs';

/** Editor history directory excluded from discovery. */
const HISTORY_DIRECTORY = '.history';

/** Path separator used to enforce a folder boundary when matching paths. */
const PATH_SEPARATOR = '/';

/** Canonical and annex document file names read for each spec. */
const DOCUMENT_FILES = {
  tasks: 'tasks.md',
  requirements: 'requirements.md',
  design: 'design.md',
  notes: 'notes.md',
} as const;

/**
 * Host-agnostic repository discovering and caching Kiro specs.
 *
 * It reads the file system exclusively through the injected
 * {@link ISpecFileSystem} port and delegates every parse/resolve step to the
 * pure {@link SpecSnapshotFactory}, so it carries no `vscode` import and is
 * unit-testable against an in-memory fake. It discovers each direct sub-folder
 * of every workspace `.kiro/specs/` (excluding `.history/`), caches a snapshot
 * per spec folder, exposes {@link onDidChangeSpecs}, and on a file event
 * re-parses only the affected spec, marking an unreadable spec as malformed
 * without aborting the others.
 */
export class SpecRepository {
  private readonly fileSystem: ISpecFileSystem;

  private readonly factory: SpecSnapshotFactory;

  private readonly notifier: ISpecChangeNotifier;

  private readonly cache: Map<string, ISpecSnapshot> = new Map();

  private readonly listeners: Set<() => void> = new Set();

  private readonly disposeNotifier: () => void;

  /**
   * Build a repository over the file-system and change-notifier ports.
   * @param fileSystem The `vscode`-free file-system port.
   * @param factory The pure snapshot factory.
   * @param notifier The change notifier firing on spec file changes.
   */
  public constructor(
    fileSystem: ISpecFileSystem,
    factory: SpecSnapshotFactory,
    notifier: ISpecChangeNotifier,
  ) {
    this.fileSystem = fileSystem;
    this.factory = factory;
    this.notifier = notifier;
    this.disposeNotifier = this.notifier.onDidChange((changedPath) => {
      this.handleChange(changedPath).catch(() => undefined);
    });
  }

  /**
   * Register a listener invoked whenever the set of specs changes.
   * @param listener Callback invoked after the cache is refreshed.
   * @returns A disposer removing the listener.
   */
  public onDidChangeSpecs(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Discover every spec across all workspace folders and fill the cache.
   *
   * It notifies listeners once the cache is (re)populated, so any view that
   * resolved before discovery completed re-renders with the discovered specs.
   * @returns The discovered snapshots, one per spec folder.
   */
  public async refresh(): Promise<readonly ISpecSnapshot[]> {
    this.cache.clear();
    const folders = this.fileSystem.workspaceFolders();
    const perFolder = await Promise.all(folders.map((folder) => this.discoverWorkspace(folder)));
    perFolder.flat().forEach((snapshot) => this.cache.set(snapshot.folderPath, snapshot));
    this.emitChange();
    return this.getSpecs();
  }

  /**
   * Return the currently cached snapshots.
   * @returns A stable array copy of the cached snapshots.
   */
  public getSpecs(): readonly ISpecSnapshot[] {
    return Array.from(this.cache.values());
  }

  /**
   * Release the change-notifier subscription and the listeners.
   */
  public dispose(): void {
    this.disposeNotifier();
    this.listeners.clear();
    this.cache.clear();
  }

  /**
   * Discover every spec under one workspace folder's `.kiro/specs/`.
   * @param workspacePath Absolute path of the workspace folder.
   * @returns The snapshots discovered under this folder.
   */
  private async discoverWorkspace(workspacePath: string): Promise<readonly ISpecSnapshot[]> {
    const specsRoot = this.fileSystem.join(workspacePath, SPECS_SEGMENT_KIRO, SPECS_SEGMENT_SPECS);
    const names = await this.fileSystem.listDirectories(specsRoot);
    const specNames = names.filter((name) => HISTORY_DIRECTORY !== name);
    return Promise.all(
      specNames.map((name) =>
        this.buildSnapshot(workspacePath, this.fileSystem.join(specsRoot, name), name),
      ),
    );
  }

  /**
   * Read a single spec folder and build its snapshot.
   * @param workspacePath Absolute path of the owning workspace folder.
   * @param folderPath Absolute path of the spec folder.
   * @param name Spec name (folder name).
   * @returns The immutable snapshot of the spec.
   */
  private async buildSnapshot(
    workspacePath: string,
    folderPath: string,
    name: string,
  ): Promise<ISpecSnapshot> {
    const [tasksContent, requirements, design, notes] = await Promise.all([
      this.fileSystem.readFile(this.fileSystem.join(folderPath, DOCUMENT_FILES.tasks)),
      this.fileSystem.readFile(this.fileSystem.join(folderPath, DOCUMENT_FILES.requirements)),
      this.fileSystem.readFile(this.fileSystem.join(folderPath, DOCUMENT_FILES.design)),
      this.fileSystem.readFile(this.fileSystem.join(folderPath, DOCUMENT_FILES.notes)),
    ]);
    const documents: ISpecDocuments = {
      tasks: undefined !== tasksContent,
      requirements: undefined !== requirements,
      design: undefined !== design,
      notes: undefined !== notes,
    };
    const input: ISpecRawInput = { name, folderPath, workspacePath, tasksContent, documents };
    return this.factory.create(input);
  }

  /**
   * React to a file change by re-parsing only the affected cached spec.
   * @param changedPath Absolute path of the changed file.
   */
  private async handleChange(changedPath: string): Promise<void> {
    const affected = this.findAffectedSpec(changedPath);
    if (undefined === affected) {
      // A full re-discovery emits its own change event once the cache is
      // repopulated, so no second notification is needed here.
      await this.refresh();
      return;
    }
    const snapshot = await this.buildSnapshot(
      affected.workspacePath,
      affected.folderPath,
      affected.name,
    );
    this.cache.set(snapshot.folderPath, snapshot);
    this.emitChange();
  }

  /**
   * Find the cached spec whose folder contains the changed file.
   *
   * Matching enforces a folder boundary so a sibling spec whose name is a
   * prefix of another (e.g. `auth` vs `auth-v2`) is never misattributed. When
   * several folders match, the longest one wins (the most specific spec).
   * @param changedPath Absolute path of the changed file.
   * @returns The owning snapshot, or `undefined` when none matches.
   */
  private findAffectedSpec(changedPath: string): ISpecSnapshot | undefined {
    let best: ISpecSnapshot | undefined;
    this.getSpecs().forEach((snapshot) => {
      if (!this.isWithinFolder(changedPath, snapshot.folderPath)) {
        return;
      }
      if (undefined === best || best.folderPath.length < snapshot.folderPath.length) {
        best = snapshot;
      }
    });
    return best;
  }

  /**
   * Tell whether a changed path lies within a spec folder on a folder boundary.
   * @param changedPath Absolute path of the changed file.
   * @param folderPath Absolute path of the candidate spec folder.
   * @returns `true` when the path is the folder itself or a descendant of it.
   */
  // eslint-disable-next-line class-methods-use-this
  private isWithinFolder(changedPath: string, folderPath: string): boolean {
    return changedPath === folderPath || changedPath.startsWith(`${folderPath}${PATH_SEPARATOR}`);
  }

  /**
   * Notify every registered listener that the specs changed.
   */
  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}
