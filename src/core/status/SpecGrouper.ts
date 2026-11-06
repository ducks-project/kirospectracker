import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import { SpecStatus } from '../model/SpecStatus';

/** One status group with its label and member snapshots. */
export interface ISpecGroup {
  /** Group label shown as the tree's top-level node. */
  readonly label: string;
  /** The status this group collects. */
  readonly status: SpecStatus;
  /** Member snapshots, sorted by name. */
  readonly specs: readonly ISpecSnapshot[];
}

/** Ordered status groups and their human labels. */
const GROUP_ORDER: ReadonlyArray<readonly [SpecStatus, string]> = [
  [SpecStatus.InProgress, 'In progress'],
  [SpecStatus.NotStarted, 'Not started'],
  [SpecStatus.Completed, 'Completed'],
  [SpecStatus.FullyCompleted, 'Fully completed'],
  [SpecStatus.Malformed, 'Malformed'],
];

/**
 * Pure grouper arranging spec snapshots into ordered status groups.
 *
 * It is `vscode`-free and gate-covered; the tree provider only turns the groups
 * into `TreeItem`s. Empty groups are omitted so the tree stays compact.
 */
export class SpecGrouper {
  /** Ordered status-to-label table shared across calls. */
  private readonly order: ReadonlyArray<readonly [SpecStatus, string]> = GROUP_ORDER;

  /**
   * Group snapshots by status in display order, dropping empty groups.
   * @param snapshots The discovered snapshots.
   * @returns The non-empty status groups, each sorted by spec name.
   */
  public group(snapshots: readonly ISpecSnapshot[]): readonly ISpecGroup[] {
    return this.order
      .map(([status, label]) => ({
        label,
        status,
        specs: snapshots
          .filter((snapshot) => snapshot.status === status)
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .filter((groupEntry) => 0 < groupEntry.specs.length);
  }
}
