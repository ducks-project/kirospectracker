/**
 * Minimal key-value state port, structurally satisfied by `vscode.Memento`
 * (`workspaceState`), so the persistence logic stays host-agnostic.
 */
export interface IKeyValueState {
  /**
   * Read a stored value.
   * @param key The storage key.
   * @returns The stored value, or `undefined` when absent.
   */
  get(key: string): unknown;
  /**
   * Store a value.
   * @param key The storage key.
   * @param value The value to store.
   * @returns A thenable settled once the value is persisted.
   */
  update(key: string, value: unknown): Thenable<void>;
}
