import type { SpecDocumentKind } from '../../core/model/IDashboardMessage';
import type { ISpecSnapshot } from '../../core/model/ISpecSnapshot';
import type { ITranslator } from '../../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../../core/i18n/IdentityTranslator';
import type { IWorkspaceGateway } from '../ports/IWorkspaceGateway';
import type { SpecRepository } from '../SpecRepository';
import { documentFileName } from '../../core/SpecDocumentFiles';

/** Command identifier contributed in package.json. */
export const OPEN_DOCUMENT_COMMAND_ID = 'kirospectracker.openDocument';

/**
 * Command opening one document of a spec in the editor.
 *
 * It is host-agnostic: it resolves the spec from the repository, refuses an
 * absent document with a readable message, and delegates the actual open to the
 * injected {@link IWorkspaceGateway}. No exception is leaked to the host.
 */
export class OpenDocumentCommand {
  private readonly repository: SpecRepository;

  private readonly gateway: IWorkspaceGateway;
  private readonly translator: ITranslator;
  /**
   * Build the command over the repository and the workspace gateway.
   * @param repository The spec repository.
   * @param gateway The workspace gateway performing the open.
   * @param translator The translator for user messages (English by default).
   */
  public constructor(
    repository: SpecRepository,
    gateway: IWorkspaceGateway,
    translator: ITranslator = IDENTITY_TRANSLATOR,
  ) {
    this.repository = repository;
    this.gateway = gateway;
    this.translator = translator;
  }

  /**
   * Open the requested document of a spec.
   * @param folderPath Absolute path of the spec folder.
   * @param document The document kind to open.
   */
  public async execute(folderPath: string, document: SpecDocumentKind): Promise<void> {
    const snapshot = this.findSpec(folderPath);
    if (undefined === snapshot) {
      this.gateway.showError(this.translator.t('No spec found at {0}.', folderPath));
      return;
    }
    if (!snapshot.documents[document]) {
      this.gateway.showError(
        this.translator.t('The {0} document is not present for "{1}".', document, snapshot.name),
      );
      return;
    }
    await this.gateway.openDocument(`${folderPath}/${documentFileName(document)}`);
  }

  /**
   * Find the cached snapshot for a folder path.
   * @param folderPath Absolute path of the spec folder.
   * @returns The snapshot, or `undefined`.
   */
  private findSpec(folderPath: string): ISpecSnapshot | undefined {
    return this.repository.getSpecs().find((snapshot) => snapshot.folderPath === folderPath);
  }
}
