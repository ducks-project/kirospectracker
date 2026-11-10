import type { ISpecCardView } from '../model/ISpecCardView';
import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import type { ITranslator } from '../ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../i18n/IdentityTranslator';
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
  private readonly translator: ITranslator;
  /**
   * Build the mapper.
   * @param translator The translator for the owner-label fallback (English by default).
   */
  public constructor(translator: ITranslator = IDENTITY_TRANSLATOR) {
    this.translator = translator;
  }
  /**
   * Project a single snapshot to its lean card view.
   * @param snapshot The full spec snapshot.
   * @returns The lean card view with no tasks.
   */
  public map(snapshot: ISpecSnapshot): ISpecCardView {
    return {
      name: snapshot.name,
      folderPath: snapshot.folderPath,
      folderKey: snapshot.workspacePath,
      ownerLabel: deriveSpecOwnerLabel(snapshot.workspacePath, this.translator),
      documents: snapshot.documents,
      entryDocument: snapshot.entryDocument,
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
