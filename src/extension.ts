import * as vscode from 'vscode';

import type { SpecDocumentKind } from './core/model/IDashboardMessage';
import type { IDashboardActions } from './adapters/ports/IDashboardActions';
import { DashboardHtmlBuilder } from './core/DashboardHtmlBuilder';
import { HtmlEscaper } from './core/HtmlEscaper';
import { NonceFactory } from './core/NonceFactory';
import { RunPromptBuilder } from './core/RunPromptBuilder';
import { SpecSnapshotFactory } from './core/SpecSnapshotFactory';
import { SpecProgressCalculator } from './core/status/SpecProgressCalculator';
import { SpecCardViewMapper } from './core/status/SpecCardViewMapper';
import { SpecStatsCalculator } from './core/status/SpecStatsCalculator';
import { SpecStatusResolver } from './core/status/SpecStatusResolver';
import { SpecDecorationMapper } from './core/status/SpecDecorationMapper';
import { TasksOnlyDocumentPolicy } from './core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from './core/parsing/TasksMarkdownParser';
import { SpecGrouper } from './core/status/SpecGrouper';
import { SpecRepository } from './adapters/SpecRepository';
import { SpecFileDecorationProvider } from './adapters/SpecFileDecorationProvider';
import { SpecTreeDataProvider, TREE_VIEW_ID } from './adapters/SpecTreeDataProvider';
import { DASHBOARD_VIEW_ID, SpecDashboardViewProvider } from './adapters/SpecDashboardViewProvider';
import { VscodeSpecFileSystem } from './adapters/VscodeSpecFileSystem';
import { VscodeWorkspaceGateway } from './adapters/VscodeWorkspaceGateway';
import { WebCryptoRandomSource } from './adapters/WebCryptoRandomSource';
import { OpenDocumentCommand } from './adapters/commands/OpenDocumentCommand';
import { RefreshCommand, REFRESH_COMMAND_ID } from './adapters/commands/RefreshCommand';
import { RunTasksCommand, RUN_TASKS_COMMAND_ID } from './adapters/commands/RunTasksCommand';
import {
  ToggleLayoutCommand,
  TOGGLE_LAYOUT_COMMAND_ID,
} from './adapters/commands/ToggleLayoutCommand';

/** Command id opening a spec document, invoked from the dashboard webview. */
const OPEN_DOCUMENT_COMMAND_ID = 'kirospectracker.openDocument';

/**
 * Public API the extension returns from {@link activate}.
 *
 * It is intentionally minimal and exists for the integration harness to observe
 * the wired providers and repository without reaching into private state.
 */
export interface IExtensionApi {
  /** The spec repository (discovery, caching, change events). */
  readonly repository: SpecRepository;
  /** The explorer file-decoration provider. */
  readonly decorations: SpecFileDecorationProvider;
  /** The dashboard webview provider. */
  readonly dashboard: SpecDashboardViewProvider;
  /**
   * The host file-system wrapper that owns the specs `FileSystemWatcher`.
   *
   * Exposed so the integration harness can drive the scoped-change path
   * deterministically through the exact entry point the production watcher
   * uses, without racing a host watcher on a real write.
   */
  readonly fileSystem: VscodeSpecFileSystem;
}

/** Disposable collaborators registered at activation. */
interface IWiring {
  readonly repository: SpecRepository;
  readonly fileSystem: VscodeSpecFileSystem;
  readonly dashboard: SpecDashboardViewProvider;
  readonly decorations: SpecFileDecorationProvider;
  readonly tree: SpecTreeDataProvider;
  readonly openDocument: OpenDocumentCommand;
  readonly runTasks: RunTasksCommand;
  readonly toggleLayout: ToggleLayoutCommand;
  readonly refresh: RefreshCommand;
  readonly gateway: VscodeWorkspaceGateway;
}

/**
 * Surface a readable error message through the gateway, never leaking it.
 * @param gateway The workspace gateway.
 * @param error The caught error.
 */
function reportError(gateway: VscodeWorkspaceGateway, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  gateway.showError(`Kiro Spec Tracker: ${message}`);
}

/**
 * Run an async action, surfacing any thrown error without leaking it.
 * @param gateway The workspace gateway for error surfacing.
 * @param action The action to run.
 */
async function guard(gateway: VscodeWorkspaceGateway, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportError(gateway, error);
  }
}

/**
 * Resolve the spec folder path from a command argument.
 *
 * The explorer context menu passes a `vscode.Uri`; a `string` (from the webview)
 * is returned as-is; anything else yields `undefined`.
 * @param argument The raw command argument.
 * @returns The folder path, or `undefined` when none could be resolved.
 */
function resolveFolderPath(argument: unknown): string | undefined {
  if ('string' === typeof argument) {
    return argument;
  }
  if (argument instanceof vscode.Uri) {
    return argument.fsPath;
  }
  return undefined;
}

/**
 * Run an action with a resolved folder path, surfacing a guard message when the
 * argument does not identify a spec folder.
 * @param gateway The workspace gateway for error surfacing.
 * @param argument The raw command argument.
 * @param action The action to run with the resolved folder path.
 */
async function runWithFolder(
  gateway: VscodeWorkspaceGateway,
  argument: unknown,
  action: (folderPath: string) => Promise<void>,
): Promise<void> {
  const folderPath = resolveFolderPath(argument);
  if (undefined === folderPath) {
    gateway.showError('Run tasks: no spec folder was provided.');
    return;
  }
  await guard(gateway, () => action(folderPath));
}

/**
 * Build the pure snapshot factory from the core collaborators.
 * @returns A configured {@link SpecSnapshotFactory}.
 */
function createSnapshotFactory(): SpecSnapshotFactory {
  return new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
}

/**
 * Bundle the open-document and run-tasks commands into the dashboard actions.
 * @param openDocument The open-document command.
 * @param runTasks The run-tasks command.
 * @returns The dashboard action handler.
 */
function createDashboardActions(
  openDocument: OpenDocumentCommand,
  runTasks: RunTasksCommand,
): IDashboardActions {
  return {
    openDocument: (folderPath: string, document: SpecDocumentKind): Promise<void> =>
      openDocument.execute(folderPath, document),
    runTasks: (folderPath: string): Promise<void> => runTasks.execute(folderPath),
  };
}

/**
 * Construct the dashboard webview provider with its collaborators.
 * @param context The extension context supplying the base URI.
 * @param repository The spec repository supplying snapshots.
 * @param stats The pure aggregate-stats calculator.
 * @param openDocument The open-document command.
 * @param runTasks The run-tasks command.
 * @returns The wired dashboard provider.
 */
function createDashboard(
  context: vscode.ExtensionContext,
  repository: SpecRepository,
  stats: SpecStatsCalculator,
  openDocument: OpenDocumentCommand,
  runTasks: RunTasksCommand,
): SpecDashboardViewProvider {
  return new SpecDashboardViewProvider(
    context.extensionUri,
    repository,
    stats,
    new SpecCardViewMapper(),
    new DashboardHtmlBuilder(new HtmlEscaper()),
    new NonceFactory(new WebCryptoRandomSource()),
    createDashboardActions(openDocument, runTasks),
  );
}

/**
 * Construct every collaborator for the given extension context.
 * @param context The extension context supplying the base URI.
 * @returns The fully wired collaborators.
 */
function buildWiring(context: vscode.ExtensionContext): IWiring {
  const fileSystem = new VscodeSpecFileSystem();
  const repository = new SpecRepository(fileSystem, createSnapshotFactory(), fileSystem);
  const gateway = new VscodeWorkspaceGateway();
  const stats = new SpecStatsCalculator();
  const openDocument = new OpenDocumentCommand(repository, gateway);
  const runTasks = new RunTasksCommand(
    repository,
    gateway,
    new RunPromptBuilder(),
    fileSystem,
    new TasksMarkdownParser(),
  );
  const dashboard = createDashboard(context, repository, stats, openDocument, runTasks);
  const decorations = new SpecFileDecorationProvider(repository, new SpecDecorationMapper(), stats);
  const tree = new SpecTreeDataProvider(repository, new SpecGrouper());
  return {
    repository,
    fileSystem,
    dashboard,
    decorations,
    tree,
    openDocument,
    runTasks,
    toggleLayout: new ToggleLayoutCommand(dashboard),
    refresh: new RefreshCommand(repository),
    gateway,
  };
}

/**
 * Register the view, providers and command handlers as disposables.
 * @param context The extension context owning the disposables.
 * @param wiring The constructed collaborators.
 */
function registerDisposables(context: vscode.ExtensionContext, wiring: IWiring): void {
  context.subscriptions.push(
    wiring.repository,
    wiring.fileSystem,
    wiring.decorations,
    wiring.dashboard,
    wiring.tree,
    vscode.window.registerWebviewViewProvider(DASHBOARD_VIEW_ID, wiring.dashboard),
    vscode.window.registerFileDecorationProvider(wiring.decorations),
    vscode.window.registerTreeDataProvider(TREE_VIEW_ID, wiring.tree),
    vscode.commands.registerCommand(REFRESH_COMMAND_ID, () =>
      guard(wiring.gateway, () => wiring.refresh.execute()),
    ),
    vscode.commands.registerCommand(TOGGLE_LAYOUT_COMMAND_ID, () => wiring.toggleLayout.execute()),
    vscode.commands.registerCommand(RUN_TASKS_COMMAND_ID, (argument: unknown) =>
      runWithFolder(wiring.gateway, argument, (folderPath) => wiring.runTasks.execute(folderPath)),
    ),
    vscode.commands.registerCommand(
      OPEN_DOCUMENT_COMMAND_ID,
      (folderPath: string, document: SpecDocumentKind) =>
        guard(wiring.gateway, () => wiring.openDocument.execute(folderPath, document)),
    ),
  );
}

/**
 * Activate the extension (composition root).
 *
 * It constructs the core instances, the repository, the providers and the
 * commands, registers every disposable into `context.subscriptions`, and kicks
 * off the first discovery. No network, no telemetry, no `eval`; activation is
 * driven by the targeted `onView:`/`onCommand:` events declared in `package.json`.
 * @param context The extension context owning the disposables.
 */
export function activate(context: vscode.ExtensionContext): IExtensionApi {
  const wiring = buildWiring(context);
  registerDisposables(context, wiring);
  wiring.repository.refresh().then(undefined, (error) => reportError(wiring.gateway, error));
  return {
    repository: wiring.repository,
    decorations: wiring.decorations,
    dashboard: wiring.dashboard,
    fileSystem: wiring.fileSystem,
  };
}

/**
 * Deactivate the extension. No manual cleanup is required: every disposable is
 * registered in `context.subscriptions` and released by the host.
 */
export function deactivate(): void {
  // Intentionally empty.
}
