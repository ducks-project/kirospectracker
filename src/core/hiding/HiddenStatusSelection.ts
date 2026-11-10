import { SpecStatus } from '../model/SpecStatus';

/** Statuses hidden when the user has not customised the setting. */
export const DEFAULT_HIDDEN_STATUSES: ReadonlySet<SpecStatus> = new Set([
  SpecStatus.Completed,
  SpecStatus.FullyCompleted,
]);

/**
 * Pure parser of the `kirospectracker.hideSpecs.statuses` setting, an object with
 * one boolean per {@link SpecStatus}.
 *
 * The status list is derived from the enum, so a future status needs no change
 * here: it is simply read as its default until the user sets it.
 */
export class HiddenStatusSelection {
  /**
   * Resolve the set of hidden statuses from the raw setting value.
   * @param raw The raw configuration value (any shape).
   * @returns The statuses to hide; non-boolean or missing entries use the default.
   */
  public parse(raw: unknown): ReadonlySet<SpecStatus> {
    const record = this.asRecord(raw);
    const hidden = Object.values(SpecStatus).filter((status) => {
      const value = record[status];
      return 'boolean' === typeof value ? value : DEFAULT_HIDDEN_STATUSES.has(status);
    });
    return new Set(hidden);
  }

  private asRecord(raw: unknown): Readonly<Record<string, unknown>> {
    if ('object' !== typeof raw || null === raw || Array.isArray(raw)) {
      return {};
    }
    return raw as Readonly<Record<string, unknown>>;
  }
}
