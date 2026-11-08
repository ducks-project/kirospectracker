import type { SpecDocumentKind } from '../../core/model/IDashboardMessage';
import type { RunScope } from '../../core/ports/ISpecAgentGateway';

/**
 * Port the dashboard webview delegates its inbound intents to.
 *
 * The provider translates typed `postMessage` intents into these calls, so the
 * command classes stay the single owners of the behaviour and the provider
 * holds no business logic.
 */
export interface IDashboardActions {
  /**
   * Open one document of a spec.
   * @param folderPath Absolute path of the spec folder.
   * @param document The document to open.
   */
  openDocument(folderPath: string, document: SpecDocumentKind): Promise<void>;

  /**
   * Run the tasks of a spec for the given scope, through the agent gateway.
   * @param folderPath Absolute path of the spec folder.
   * @param scope The run scope.
   */
  runTasks(folderPath: string, scope: RunScope): Promise<void>;

  /**
   * Sync/update the tasks files of a spec, through the agent gateway.
   * @param folderPath Absolute path of the spec folder.
   */
  syncTasks(folderPath: string): Promise<void>;
}
