import type { ISpecCardView } from '../model/ISpecCardView';
import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import { deriveSpecOwnerLabel } from './SpecOwnerLabel';

/**
 * Pure projector turning a full {@link ISpecSnapshot} into the lean
 * {@link ISpecCardView} the dashboard webview consumes.
 *
 * It drops the parsed task tree and keeps only the fields a card renders (plus
 * the derived owner label), so the `postMessage` payload stays small. Being
 * pure and `vscode`-free, it is unit- and property-testable and reusable for
 * both the full render and a single scoped update.
 */
export class SpecCardViewMapper {
  /**
   * Project a single snapshot to its lean card view.
   * @param snapshot The full spec snapshot.
   * @returns The lean card view with no tasks.
   */
  // eslint-disable-next-line class-methods-use-this
  public map(snapshot: ISpecSnapshot): ISpecCardView {
    return {
      name: snapshot.name,
      folderPath: snapshot.folderPath,
      ownerLabel: deriveSpecOwnerLabel(snapshot.workspacePath),
      documents: snapshot.documents,
      status: snapshot.status,
      progress: snapshot.progress,
    };
  }

  /**
   * Project every snapshot, preserving order and length.
   * @param snapshots The full spec snapshots.
   * @returns The lean card views in the same order.
   */
  public mapAll(snapshots: readonly ISpecSnapshot[]): readonly ISpecCardView[] {
    return snapshots.map((snapshot) => this.map(snapshot));
  }
}
