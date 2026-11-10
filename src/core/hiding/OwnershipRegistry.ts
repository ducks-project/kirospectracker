import type { ExcludeSettingKey } from './HideSpecsMode';

/** Serialisable shape: workspace path → setting key → owned keys. */
export type OwnershipRecord = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

/**
 * Immutable registry of the exclusion keys the extension wrote, per workspace
 * folder and per setting. It is the only way to tell our entries from the
 * user's, since a boolean entry carries no metadata.
 */
export class OwnershipRegistry {
  private readonly record: OwnershipRecord;

  /**
   * Build a registry over a record.
   * @param record The workspace → setting → keys record.
   */
  public constructor(record: OwnershipRecord = {}) {
    this.record = record;
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
    const record: Record<string, Record<string, readonly string[]>> = {};
    Object.entries(raw).forEach(([workspace, settings]) => {
      const clean = OwnershipRegistry.cleanSettings(settings);
      if (0 < Object.keys(clean).length) {
        record[workspace] = clean;
      }
    });
    return new OwnershipRegistry(record);
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
    return Object.keys(this.record);
  }

  /**
   * Whether the registry owns no key at all.
   * @returns `true` when empty.
   */
  public isEmpty(): boolean {
    return 0 === Object.keys(this.record).length;
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
    const settings: Record<string, readonly string[]> = { ...this.record[workspacePath] };
    if (0 === keys.length) {
      delete settings[setting];
    } else {
      settings[setting] = [...keys];
    }
    const next: Record<string, Readonly<Record<string, readonly string[]>>> = { ...this.record };
    if (0 === Object.keys(settings).length) {
      delete next[workspacePath];
    } else {
      next[workspacePath] = settings;
    }
    return new OwnershipRegistry(next);
  }

  /**
   * Serialise to a JSON-safe record.
   * @returns The underlying record.
   */
  public toJSON(): OwnershipRecord {
    return this.record;
  }
}
