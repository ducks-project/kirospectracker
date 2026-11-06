/**
 * Port (Dependency Inversion) abstracting the change notifications the
 * {@link SpecRepository} reacts to, without importing `vscode`.
 *
 * A concrete adapter (`VscodeSpecFileSystem`) wires a `FileSystemWatcher` to
 * this contract. The absolute path of the changed file is forwarded so the
 * repository can re-parse only the affected spec.
 */
export interface ISpecChangeNotifier {
  /**
   * Register a listener invoked when a file under `.kiro/specs/` changes.
   * @param listener Callback receiving the absolute path of the changed file.
   * @returns A disposer removing the listener.
   */
  onDidChange(listener: (changedPath: string) => void): () => void;
}
