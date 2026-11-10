import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import type { ITranslator } from '../ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../i18n/IdentityTranslator';
import { SpecStatus } from '../model/SpecStatus';
import { statusLabel } from './SpecStatusLabel';

/** One status group with its label and member snapshots. */
export interface ISpecGroup {
  /** Group label shown as the tree's top-level node. */
  readonly label: string;
  /** The status this group collects. */
  readonly status: SpecStatus;
  /** Member snapshots, sorted by name. */
  readonly specs: readonly ISpecSnapshot[];
}

/** Status groups in display order (labels come from the translator). */
const GROUP_ORDER: readonly SpecStatus[] = [
  SpecStatus.InProgress,
  SpecStatus.NotStarted,
  SpecStatus.Completed,
  SpecStatus.FullyCompleted,
  SpecStatus.Malformed,
];

/**
 * Pure grouper arranging spec snapshots into ordered status groups.
 *
 * It is `vscode`-free and gate-covered; the tree provider only turns the groups
 * into `TreeItem`s. Empty groups are omitted so the tree stays compact.
 */
export class SpecGrouper {
  /** Ordered statuses shared across calls. */
  private readonly order: readonly SpecStatus[] = GROUP_ORDER;
  private readonly translator: ITranslator;
  /**
   * Build the grouper.
   * @param translator The translator for group labels (English by default).
   */
  public constructor(translator: ITranslator = IDENTITY_TRANSLATOR) {
    this.translator = translator;
  }

  /**
   * Group snapshots by status in display order, dropping empty groups.
   * @param snapshots The discovered snapshots.
   * @returns The non-empty status groups, each sorted by spec name.
   */
  public group(snapshots: readonly ISpecSnapshot[]): readonly ISpecGroup[] {
    return this.order
      .map((status) => ({
        label: statusLabel(status, this.translator),
        status,
        specs: snapshots
          .filter((snapshot) => snapshot.status === status)
          .slice()
          .sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .filter((groupEntry) => 0 < groupEntry.specs.length);
  }
}
