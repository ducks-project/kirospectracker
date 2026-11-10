import { OwnershipRegistry } from '../core/hiding/OwnershipRegistry';
import type { IFirstWriteNoticeLedger } from './ports/IFirstWriteNoticeLedger';
import type { IKeyValueState } from './ports/IKeyValueState';
import type { IOwnershipStore } from './ports/IOwnershipStore';

/** Workspace-state key holding the ownership registry. */
export const OWNERSHIP_STATE_KEY = 'kirospectracker.hiddenSpecs.ownership';

/** Workspace-state key remembering the first-write notice was shown. */
export const NOTICE_STATE_KEY = 'kirospectracker.hiddenSpecs.noticeShown';

/**
 * Persists the ownership registry and the first-write notice flag in a
 * key-value state (the extension's `workspaceState`), so ownership survives
 * restarts yet stays local to the workspace.
 */
export class MementoHiddenSpecsState implements IOwnershipStore, IFirstWriteNoticeLedger {
  private readonly state: IKeyValueState;

  /**
   * Build the state over a key-value store.
   * @param state The backing store.
   */
  public constructor(state: IKeyValueState) {
    this.state = state;
  }

  public load(): OwnershipRegistry {
    return OwnershipRegistry.fromJSON(this.state.get(OWNERSHIP_STATE_KEY));
  }

  public async save(registry: OwnershipRegistry): Promise<void> {
    await this.state.update(
      OWNERSHIP_STATE_KEY,
      registry.isEmpty() ? undefined : registry.toJSON(),
    );
  }

  public wasShown(): boolean {
    return true === this.state.get(NOTICE_STATE_KEY);
  }

  public async markShown(): Promise<void> {
    await this.state.update(NOTICE_STATE_KEY, true);
  }
}
