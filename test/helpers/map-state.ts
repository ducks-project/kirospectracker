import type { IKeyValueState } from '../../src/adapters/ports/IKeyValueState';

/** In-memory {@link IKeyValueState} mimicking a `Memento` (undefined deletes). */
export class MapState implements IKeyValueState {
  /** Backing values. */
  public readonly values = new Map<string, unknown>();

  public get(key: string): unknown {
    return this.values.get(key);
  }

  public async update(key: string, value: unknown): Promise<void> {
    if (undefined === value) {
      this.values.delete(key);
      return;
    }
    this.values.set(key, value);
  }
}
