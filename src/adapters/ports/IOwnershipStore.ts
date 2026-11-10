import type { OwnershipRegistry } from '../../core/hiding/OwnershipRegistry';

/** Port persisting which exclusion keys the extension owns. */
export interface IOwnershipStore {
  /**
   * Load the persisted registry.
   * @returns The registry (empty when nothing was stored).
   */
  load(): OwnershipRegistry;
  /**
   * Persist the registry.
   * @param registry The registry to store.
   */
  save(registry: OwnershipRegistry): Promise<void>;
}
