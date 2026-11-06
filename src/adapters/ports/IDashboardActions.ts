import type { SpecDocumentKind } from '../../core/model/IDashboardMessage';

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
   * Run the tasks of a spec (MVP: open `tasks.md`, optional consented copy).
   * @param folderPath Absolute path of the spec folder.
   */
  runTasks(folderPath: string): Promise<void>;
}
