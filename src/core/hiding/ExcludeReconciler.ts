/** Plain value of an exclusion setting in one configuration target. */
export type ExcludeValue = Readonly<Record<string, unknown>>;

/** Outcome of reconciling one exclusion setting. */
export interface IReconcileResult {
  /**
   * New value to write when {@link changed} is `true`; `undefined` then means
   * "remove the setting from the target" (it became empty).
   */
  readonly value: ExcludeValue | undefined;
  /** Keys the extension owns after the reconciliation. */
  readonly owned: readonly string[];
  /**
   * Keys the user removed or edited while their spec is still to hide; they are
   * not rewritten until the spec stops being hidden.
   */
  readonly withdrawn: readonly string[];
  /** Whether the target value must be written. */
  readonly changed: boolean;
  /** Keys newly added by this reconciliation. */
  readonly added: readonly string[];
  /** Keys removed by this reconciliation. */
  readonly removed: readonly string[];
}

/**
 * Pure three-way reconciliation of an exclusion setting.
 *
 * Ownership rules: a key is only ever added when ABSENT from the target value;
 * a key already present belongs to the user and is never changed or removed. Only
 * keys the extension owns (and that are still `true`) are removed, once undesired;
 * an owned key the user edited or deleted is released AND remembered as
 * withdrawn, so it is not rewritten while its spec stays hidden. The memory is
 * dropped as soon as the key is no longer desired.
 */
export class ExcludeReconciler {
  /**
   * Compute the next target value and ownership.
   * @param current The value stored in the target itself (never the merged value).
   * @param owned Keys the extension owns for this target.
   * @param desired Keys that should be hidden now.
   * @param withdrawn Keys the user already withdrew (removed or edited) earlier.
   * @returns The reconciliation result; `changed` is `false` when already in sync.
   */
  public reconcile(
    current: ExcludeValue | undefined,
    owned: readonly string[],
    desired: readonly string[],
    withdrawn: readonly string[] = [],
  ): IReconcileResult {
    const base = current ?? {};
    const desiredSet = new Set(desired);
    const stillOwned = owned.filter((key) => true === base[key]);
    const removed = stillOwned.filter((key) => !desiredSet.has(key));
    const lost = owned.filter((key) => true !== base[key]);
    const nextWithdrawn = [...new Set([...withdrawn, ...lost])]
      .filter((key) => desiredSet.has(key))
      .sort();
    const added = [...new Set(desired)]
      .filter((key) => !(key in base) && !nextWithdrawn.includes(key))
      .sort();
    const kept = stillOwned.filter((key) => desiredSet.has(key));
    const changed = 0 < removed.length || 0 < added.length;
    return {
      value: changed ? this.apply(base, removed, added) : current,
      owned: [...kept, ...added],
      withdrawn: nextWithdrawn,
      changed,
      added,
      removed,
    };
  }

  private apply(
    base: ExcludeValue,
    removed: readonly string[],
    added: readonly string[],
  ): ExcludeValue | undefined {
    const next: Record<string, unknown> = { ...base };
    removed.forEach((key) => delete next[key]);
    added.forEach((key) => {
      next[key] = true;
    });
    return 0 === Object.keys(next).length ? undefined : next;
  }
}
