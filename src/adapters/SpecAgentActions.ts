import { SpecStatus } from '../core/model/SpecStatus';
import type { ISpecSnapshot } from '../core/model/ISpecSnapshot';
import type { RunScope, ISpecAgentGateway } from '../core/ports/ISpecAgentGateway';
import type { MessageKey } from '../core/i18n/messages';
import type { ITranslator } from '../core/ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../core/i18n/IdentityTranslator';
import type { IAgentErrorReporter } from './ports/IAgentErrorReporter';
import type { SpecRepository } from './SpecRepository';

const MALFORMED_RUN_MESSAGE: MessageKey =
  '"{0}" is malformed (missing or unreadable tasks.md) and cannot be run.';
const MALFORMED_SYNC_MESSAGE: MessageKey =
  '"{0}" is malformed (missing or unreadable tasks.md) and cannot be synced.';

/**
 * Single implementation of the agent task actions, shared by BOTH UI entry
 * points (the dashboard card buttons and the "Specs by Status" tree context
 * menu), so no behaviour is duplicated (DRY).
 *
 * Each entry point resolves a `folderPath`, this class looks the cached
 * {@link ISpecSnapshot} up from the {@link SpecRepository}, and calls exactly one
 * {@link ISpecAgentGateway} method. Which concrete gateway (Kiro best-effort or
 * the Null-Object fallback) is behind the port is decided once in the composition
 * root, so this class is host-agnostic.
 */
export class SpecAgentActions {
  private readonly repository: SpecRepository;

  private gateway: ISpecAgentGateway;

  private readonly reporter: IAgentErrorReporter;
  private readonly translator: ITranslator;
  /**
   * Build the actions over the repository, the gateway and the error reporter.
   *
   * The gateway defaults to the always-valid Null Object and may be upgraded
   * once capability detection completes (see {@link setGateway}); because the
   * Null Object is a first-class, no-throw gateway, actions invoked before
   * detection finishes still behave honestly.
   * @param repository The spec repository supplying cached snapshots.
   * @param gateway The agent gateway (Strategy chosen at composition time).
   * @param reporter The channel used when the folder resolves to no spec.
   * @param translator The translator for user messages (English by default).
   */
  public constructor(
    repository: SpecRepository,
    gateway: ISpecAgentGateway,
    reporter: IAgentErrorReporter,
    translator: ITranslator = IDENTITY_TRANSLATOR,
  ) {
    this.repository = repository;
    this.gateway = gateway;
    this.reporter = reporter;
    this.translator = translator;
  }

  /**
   * Replace the agent gateway once capability detection has selected the
   * concrete Strategy.
   * @param gateway The resolved gateway.
   */
  public setGateway(gateway: ISpecAgentGateway): void {
    this.gateway = gateway;
  }

  /**
   * Sync/update the tasks of the spec at a folder path.
   * @param folderPath Absolute path of the spec folder.
   */
  public async syncTasks(folderPath: string): Promise<void> {
    const snapshot = this.findSpec(folderPath);
    if (undefined === snapshot) {
      this.reporter.showError(this.translator.t('No spec found at {0}.', folderPath));
      return;
    }
    if (this.refuseMalformed(snapshot, MALFORMED_SYNC_MESSAGE)) {
      return;
    }
    await this.gateway.syncTasks(snapshot);
  }

  /**
   * Run the tasks of the spec at a folder path for the given scope.
   * @param folderPath Absolute path of the spec folder.
   * @param scope The run scope.
   */
  public async runTasks(folderPath: string, scope: RunScope): Promise<void> {
    const snapshot = this.findSpec(folderPath);
    if (undefined === snapshot) {
      this.reporter.showError(this.translator.t('No spec found at {0}.', folderPath));
      return;
    }
    if (this.refuseMalformed(snapshot, MALFORMED_RUN_MESSAGE)) {
      return;
    }
    await this.gateway.runTasks(snapshot, scope);
  }

  /**
   * Refuse a malformed spec BEFORE any gateway is reached, so the guarantee
   * holds whichever gateway (Kiro chat, Null Object) is wired.
   * @param snapshot The resolved snapshot.
   * @param message The English message template taking the spec name as `{0}`.
   * @returns `true` when the spec was refused (the error has been reported).
   */
  private refuseMalformed(snapshot: ISpecSnapshot, message: MessageKey): boolean {
    if (SpecStatus.Malformed !== snapshot.status) {
      return false;
    }
    this.reporter.showError(this.translator.t(message, snapshot.name));
    return true;
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
