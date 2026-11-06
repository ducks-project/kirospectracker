import type { ISpecChangeNotifier } from '../../src/adapters/ports/ISpecChangeNotifier';
import type { ISpecFileSystem } from '../../src/adapters/ports/ISpecFileSystem';

/** Path separator used by the fake file system. */
const SEPARATOR = '/';

/**
 * In-memory fake implementing the file-system and change-notifier ports.
 *
 * It lets {@link SpecRepository} be unit-tested without `vscode`: directories
 * and files are seeded up front, and {@link emit} drives a change event the
 * same way the real watcher would.
 */
export class FakeSpecFileSystem implements ISpecFileSystem, ISpecChangeNotifier {
  private readonly folders: readonly string[];

  private readonly files: Map<string, string>;

  private readonly directories: Set<string>;

  private readonly listeners: Set<(changedPath: string) => void> = new Set();

  /**
   * Build a fake over seeded folders, files and directory paths.
   * @param folders Absolute workspace folder paths.
   * @param files Map of absolute file path to text content.
   * @param directories Absolute directory paths that exist.
   */
  public constructor(
    folders: readonly string[],
    files: Map<string, string>,
    directories: Set<string>,
  ) {
    this.folders = folders;
    this.files = files;
    this.directories = directories;
  }

  /** @returns The seeded workspace folder paths. */
  public workspaceFolders(): readonly string[] {
    return this.folders;
  }

  /**
   * List direct sub-directory names of a folder.
   * @param folderPath Absolute folder path.
   * @returns The sub-directory names.
   */
  public async listDirectories(folderPath: string): Promise<readonly string[]> {
    const prefix = `${folderPath}${SEPARATOR}`;
    const names = new Set<string>();
    this.directories.forEach((dir) => {
      if (dir.startsWith(prefix)) {
        names.add(dir.slice(prefix.length).split(SEPARATOR)[0]);
      }
    });
    return Array.from(names);
  }

  /**
   * Read a seeded file.
   * @param filePath Absolute file path.
   * @returns The content, or `undefined` when absent.
   */
  public async readFile(filePath: string): Promise<string | undefined> {
    return this.files.get(filePath);
  }

  /**
   * Join path segments with the fake separator.
   * @param segments Path segments.
   * @returns The joined path.
   */
  // eslint-disable-next-line class-methods-use-this
  public join(...segments: string[]): string {
    return segments.join(SEPARATOR);
  }

  /**
   * Register a change listener.
   * @param listener Callback receiving the changed path.
   * @returns A disposer removing the listener.
   */
  public onDidChange(listener: (changedPath: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Seed or overwrite a file's content.
   * @param filePath Absolute file path.
   * @param content Text content to store.
   */
  public setFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
  }

  /**
   * Drive a change event to every registered listener.
   * @param changedPath Absolute path of the changed file.
   */
  public emit(changedPath: string): void {
    this.listeners.forEach((listener) => listener(changedPath));
  }
}
