/**
 * Port (Dependency Inversion) abstracting the minimal, `vscode`-free view of the
 * file system the {@link SpecRepository} needs.
 *
 * A concrete adapter (`VscodeSpecFileSystem`) bridges `vscode.workspace.fs` to
 * this contract, keeping the repository host-agnostic and unit-testable against
 * an in-memory fake. All operations return plain data and never throw for the
 * "absent" case: a missing entry resolves to an empty list or `undefined`.
 */
export interface ISpecFileSystem {
  /**
   * Absolute paths of the workspace folders to scan for `.kiro/specs/`.
   * @returns One path per workspace folder; empty when no folder is open.
   */
  workspaceFolders(): readonly string[];

  /**
   * List the names of the direct sub-directories of a folder.
   * @param folderPath Absolute path of the folder to list.
   * @returns Sub-directory names; empty when the folder is absent/unreadable.
   */
  listDirectories(folderPath: string): Promise<readonly string[]>;

  /**
   * Read a UTF-8 text file.
   * @param filePath Absolute path of the file to read.
   * @returns The file text, or `undefined` when absent/unreadable.
   */
  readFile(filePath: string): Promise<string | undefined>;

  /**
   * Join path segments with the file-system separator.
   * @param segments Path segments to join.
   * @returns The joined absolute path.
   */
  join(...segments: string[]): string;
}
