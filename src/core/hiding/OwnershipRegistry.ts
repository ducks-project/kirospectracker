import type { ExcludeSettingKey } from './HideSpecsMode';

/** Serialisable shape: workspace path → setting key → owned keys. */
export type OwnershipRecord = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

/** Persisted shape (version 2): owned keys plus keys withdrawn by the user. */
export interface IPersistedRegistry {
  readonly version: 2;
  readonly owned: OwnershipRecord;
  readonly withdrawn: OwnershipRecord;
}
/** Version tag of the persisted shape. */
const PERSISTED_VERSION = 2;
/**
 * Immutable registry of the exclusion keys the extension wrote, per workspace
 * folder and per setting. It is the only way to tell our entries from the
 * user's, since a boolean entry carries no metadata. It also remembers the keys
 * the user withdrew (deleted or edited) while their spec is still to hide, so
 * they are not rewritten.
 *
 * Legacy persisted data (a bare workspace → setting → keys record, written by
 * v0.12.0 before withdrawals existed) is read as owned keys with no withdrawal.
 */
export class OwnershipRegistry {
  private readonly record: OwnershipRecord;
  private readonly withdrawnRecord: OwnershipRecord;

  /**
   * Build a registry over records.
   * @param record The workspace → setting → owned keys record.
   * @param withdrawnRecord The workspace → setting → withdrawn keys record.
   */
  public constructor(record: OwnershipRecord = {}, withdrawnRecord: OwnershipRecord = {}) {
    this.record = record;
    this.withdrawnRecord = withdrawnRecord;
  }

  /**
   * Rebuild a registry from untrusted persisted data, dropping malformed parts.
   * @param raw The persisted value.
   * @returns The registry (empty when nothing valid was stored).
   */
  public static fromJSON(raw: unknown): OwnershipRegistry {
    if ('object' !== typeof raw || null === raw || Array.isArray(raw)) {
      return new OwnershipRegistry();
    }
    const versioned = raw as Partial<Record<keyof IPersistedRegistry, unknown>>;
    if (PERSISTED_VERSION === versioned.version) {
      return new OwnershipRegistry(
        OwnershipRegistry.cleanRecord(versioned.owned),
        OwnershipRegistry.cleanRecord(versioned.withdrawn),
      );
    }
    return new OwnershipRegistry(OwnershipRegistry.cleanRecord(raw));
  }
  private static cleanRecord(raw: unknown): OwnershipRecord {
    if ('object' !== typeof raw || null === raw || Array.isArray(raw)) {
      return {};
    }
    const record: Record<string, Record<string, readonly string[]>> = {};
    Object.entries(raw).forEach(([workspace, settings]) => {
      const clean = OwnershipRegistry.cleanSettings(settings);
      if (0 < Object.keys(clean).length) {
        record[workspace] = clean;
      }
    });
    return record;
  }

  private static cleanSettings(settings: unknown): Record<string, readonly string[]> {
    const clean: Record<string, readonly string[]> = {};
    if ('object' !== typeof settings || null === settings || Array.isArray(settings)) {
      return clean;
    }
    Object.entries(settings).forEach(([setting, keys]) => {
      const strings = Array.isArray(keys)
        ? keys.filter((key): key is string => 'string' === typeof key)
        : [];
      if (0 < strings.length) {
        clean[setting] = strings;
      }
    });
    return clean;
  }

  /**
   * Keys owned for a workspace folder and setting.
   * @param workspacePath The workspace folder path.
   * @param setting The exclusion setting.
   * @returns The owned keys (empty when none).
   */
  public keysFor(workspacePath: string, setting: ExcludeSettingKey): readonly string[] {
    return this.record[workspacePath]?.[setting] ?? [];
  }

  /**
   * Workspace folder paths holding at least one owned key.
   * @returns The workspace folder paths.
   */
  public workspaces(): readonly string[] {
    return [...new Set([...Object.keys(this.record), ...Object.keys(this.withdrawnRecord)])];
  }
  /**
   * Keys the user withdrew for a workspace folder and setting.
   * @param workspacePath The workspace folder path.
   * @param setting The exclusion setting.
   * @returns The withdrawn keys (empty when none).
   */
  public withdrawnFor(workspacePath: string, setting: ExcludeSettingKey): readonly string[] {
    return this.withdrawnRecord[workspacePath]?.[setting] ?? [];
  }

  /**
   * Whether the registry owns and remembers no key at all.
   * @returns `true` when empty.
   */
  public isEmpty(): boolean {
    return 0 === Object.keys(this.record).length && 0 === Object.keys(this.withdrawnRecord).length;
  }

  /**
   * Return a registry with the owned keys of one (workspace, setting) replaced.
   * @param workspacePath The workspace folder path.
   * @param setting The exclusion setting.
   * @param keys The new owned keys; empty drops the entry.
   * @returns A new registry.
   */
  public with(
    workspacePath: string,
    setting: ExcludeSettingKey,
    keys: readonly string[],
  ): OwnershipRegistry {
    const next = OwnershipRegistry.replace(this.record, workspacePath, setting, keys);
    return new OwnershipRegistry(next, this.withdrawnRecord);
  }
  /**
   * Return a registry with the withdrawn keys of one (workspace, setting) replaced.
   * @param workspacePath The workspace folder path.
   * @param setting The exclusion setting.
   * @param keys The new withdrawn keys; empty drops the entry.
   * @returns A new registry.
   */
  public withWithdrawn(
    workspacePath: string,
    setting: ExcludeSettingKey,
    keys: readonly string[],
  ): OwnershipRegistry {
    const next = OwnershipRegistry.replace(this.withdrawnRecord, workspacePath, setting, keys);
    return new OwnershipRegistry(this.record, next);
  }
  private static replace(
    source: OwnershipRecord,
    workspacePath: string,
    setting: ExcludeSettingKey,
    keys: readonly string[],
  ): OwnershipRecord {
    const settings: Record<string, readonly string[]> = { ...source[workspacePath] };
    if (0 === keys.length) {
      delete settings[setting];
    } else {
      settings[setting] = [...keys];
    }
    const next: Record<string, Readonly<Record<string, readonly string[]>>> = { ...source };
    if (0 === Object.keys(settings).length) {
      delete next[workspacePath];
    } else {
      next[workspacePath] = settings;
    }
    return next;
  }
  /**
   * Serialise to a JSON-safe, versioned record.
   * @returns The persisted shape.
   */
  public toJSON(): IPersistedRegistry {
    return { version: PERSISTED_VERSION, owned: this.record, withdrawn: this.withdrawnRecord };
  }
}
