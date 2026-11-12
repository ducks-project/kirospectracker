import * as vscode from 'vscode';

import type { SpecDocumentKind } from './core/model/IDashboardMessage';
import type { RunScope } from './core/ports/ISpecAgentGateway';
import type { ITranslator } from './core/ports/ITranslator';
import type { IAgentErrorReporter } from './adapters/ports/IAgentErrorReporter';
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
import { KiroSpecConfigReader } from './adapters/config/KiroSpecConfigReader';
import { SpecIntroductionLoader } from './adapters/SpecIntroductionLoader';
import { SpecFileDecorationProvider } from './adapters/SpecFileDecorationProvider';
import {
  resolveSpecNodeFolderPath,
  SpecTreeDataProvider,
  TREE_VIEW_ID,
} from './adapters/SpecTreeDataProvider';
import { DASHBOARD_VIEW_ID, SpecDashboardViewProvider } from './adapters/SpecDashboardViewProvider';
import { VscodeSpecFileSystem } from './adapters/VscodeSpecFileSystem';
import { VscodeWorkspaceGateway } from './adapters/VscodeWorkspaceGateway';
import { VscodeCommandGateway } from './adapters/VscodeCommandGateway';
import { VscodeOutputChannelDiagnosticSink } from './adapters/VscodeOutputChannelDiagnosticSink';
import { VscodeAgentBetaNotice } from './adapters/VscodeAgentBetaNotice';
import { VscodeTranslator } from './adapters/VscodeTranslator';
import { HiddenSpecsSynchronizer } from './adapters/HiddenSpecsSynchronizer';
import { MementoHiddenSpecsState } from './adapters/MementoHiddenSpecsState';
import { TimeoutScheduler } from './adapters/TimeoutScheduler';
import {
  HIDE_SPECS_SECTION,
  VscodeHideSpecsConfigReader,
} from './adapters/VscodeHideSpecsConfigReader';
import { VscodeHiddenSpecsNotifier } from './adapters/VscodeHiddenSpecsNotifier';
import { VscodeSettingsWriter } from './adapters/VscodeSettingsWriter';
import { WebCryptoRandomSource } from './adapters/WebCryptoRandomSource';
import { SpecAgentActions } from './adapters/SpecAgentActions';
import { UnavailableAgentGateway } from './adapters/agent/UnavailableAgentGateway';
import { createSpecAgentGateway } from './adapters/agent/SpecAgentGatewayFactory';
import {
  OpenDocumentCommand,
  OPEN_DOCUMENT_COMMAND_ID,
} from './adapters/commands/OpenDocumentCommand';
import { RefreshCommand, REFRESH_COMMAND_ID } from './adapters/commands/RefreshCommand';
import { RunTasksCommand, RUN_TASKS_COMMAND_ID } from './adapters/commands/RunTasksCommand';
import {
  RESET_HIDDEN_SPECS_COMMAND_ID,
  ResetHiddenSpecsCommand,
} from './adapters/commands/ResetHiddenSpecsCommand';
import {
  ToggleLayoutCommand,
  TOGGLE_LAYOUT_COMMAND_ID,
} from './adapters/commands/ToggleLayoutCommand';

/**
 * Tree context-menu command ids. Each opens one document of the spec targeted by
 * the "Specs by Status" tree item; they are thin, tree-item-aware wrappers over
 * {@link OpenDocumentCommand} so the declarative menu can target a node argument
 * while reusing the existing open behaviour.
 */
const TREE_OPEN_COMMAND_IDS: Readonly<Record<SpecDocumentKind, string>> = {
  requirements: 'kirospectracker.tree.openRequirements',
  design: 'kirospectracker.tree.openDesign',
  tasks: 'kirospectracker.tree.openTasks',
  notes: 'kirospectracker.tree.openNotes',
  bugfix: 'kirospectracker.tree.openBugfix',
};

/** Tree context-menu command id syncing the targeted spec's task files. */
const TREE_SYNC_FILES_COMMAND_ID = 'kirospectracker.tree.syncFiles';

/** Tree context-menu command id running the targeted spec's required tasks. */
const TREE_RUN_REQUIRED_COMMAND_ID = 'kirospectracker.tree.runRequired';

/**
 * Tree context-menu command id running the targeted spec's required and
 * optional tasks.
 */
const TREE_RUN_REQUIRED_AND_OPTIONAL_COMMAND_ID = 'kirospectracker.tree.runRequiredAndOptional';

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
  /**
   * The synchroniser writing the hidden-specs exclusions.
   *
   * Exposed so the integration harness can trigger and await a run
   * deterministically instead of racing the debounce window.
   */
  readonly hiddenSpecs: HiddenSpecsSynchronizer;
  /**
   * The error reporter injected into the agent actions (the real window
   * gateway).
   *
   * Exposed for tests only, so the integration harness can observe the error a
   * refused spec reports; a test wraps `showError` on this
   * instance instead of patching the `vscode` API.
   */
  readonly agentErrorReporter: IAgentErrorReporter;
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
  readonly agentActions: SpecAgentActions;
  readonly agentFallback: UnavailableAgentGateway;
  readonly commandGateway: VscodeCommandGateway;
  readonly agentDiagnostics: VscodeOutputChannelDiagnosticSink;
  readonly toggleLayout: ToggleLayoutCommand;
  readonly refresh: RefreshCommand;
  readonly gateway: VscodeWorkspaceGateway;
  readonly translator: ITranslator;
}
/**
 * Surface a readable error message through the gateway, never leaking it.
 * @param gateway The workspace gateway.
 * @param translator The translator for the message.
 * @param error The caught error.
 */
function reportError(
  gateway: VscodeWorkspaceGateway,
  translator: ITranslator,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  gateway.showError(translator.t('Kiro Spec Tracker: {0}', message));
}

/**
 * Run an async action, surfacing any thrown error without leaking it.
 * @param gateway The workspace gateway for error surfacing.
 * @param translator The translator for the error message.
 * @param action The action to run.
 */
async function guard(
  gateway: VscodeWorkspaceGateway,
  translator: ITranslator,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportError(gateway, translator, error);
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
 * @param translator The translator for user messages.
 * @param argument The raw command argument.
 * @param action The action to run with the resolved folder path.
 */
async function runWithFolder(
  gateway: VscodeWorkspaceGateway,
  translator: ITranslator,
  argument: unknown,
  action: (folderPath: string) => Promise<void>,
): Promise<void> {
  const folderPath = resolveFolderPath(argument);
  if (undefined === folderPath) {
    gateway.showError(translator.t('Run tasks: no spec folder was provided.'));
    return;
  }
  await guard(gateway, translator, () => action(folderPath));
}

/**
 * Run an action with the spec folder path resolved from a tree context-menu
 * node argument, surfacing a guard message when the argument is not a spec leaf.
 * @param gateway The workspace gateway for error surfacing.
 * @param translator The translator for user messages.
 * @param argument The raw command argument (the targeted tree node).
 * @param action The action to run with the resolved folder path.
 */
async function runWithNode(
  gateway: VscodeWorkspaceGateway,
  translator: ITranslator,
  argument: unknown,
  action: (folderPath: string) => Promise<void>,
): Promise<void> {
  const folderPath = resolveSpecNodeFolderPath(argument);
  if (undefined === folderPath) {
    gateway.showError(translator.t('No spec was selected in the tree.'));
    return;
  }
  await guard(gateway, translator, () => action(folderPath));
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
 * Bundle the open-document command and the shared agent actions into the
 * dashboard action handler.
 * @param openDocument The open-document command.
 * @param agentActions The shared agent task actions (sync / run).
 * @returns The dashboard action handler.
 */
function createDashboardActions(
  openDocument: OpenDocumentCommand,
  agentActions: SpecAgentActions,
): IDashboardActions {
  return {
    openDocument: (folderPath: string, document: SpecDocumentKind): Promise<void> =>
      openDocument.execute(folderPath, document),
    runTasks: (folderPath: string, scope: RunScope): Promise<void> =>
      agentActions.runTasks(folderPath, scope),
    syncTasks: (folderPath: string): Promise<void> => agentActions.syncTasks(folderPath),
  };
}

/**
 * Construct the dashboard webview provider with its collaborators.
 * @param context The extension context supplying the base URI.
 * @param repository The spec repository supplying snapshots.
 * @param stats The pure aggregate-stats calculator.
 * @param actions The handler for inbound dashboard intents.
 * @param introductions The lazy loader serving entry-document introductions on hover.
 * @param translator The host translator.
 * @returns The wired dashboard provider.
 */
function createDashboard(
  context: vscode.ExtensionContext,
  repository: SpecRepository,
  stats: SpecStatsCalculator,
  actions: IDashboardActions,
  introductions: SpecIntroductionLoader,
  translator: ITranslator,
): SpecDashboardViewProvider {
  return new SpecDashboardViewProvider(
    context.extensionUri,
    repository,
    stats,
    new SpecCardViewMapper(translator),
    new DashboardHtmlBuilder(new HtmlEscaper()),
    new NonceFactory(new WebCryptoRandomSource()),
    actions,
    introductions,
    translator,
    vscode.env.language,
  );
}

/**
 * Construct the activity-bar tree provider over the repository and grouper.
 * @param repository The spec repository supplying snapshots.
 * @param translator The host translator.
 * @returns The wired tree data provider.
 */
function createTree(repository: SpecRepository, translator: ITranslator): SpecTreeDataProvider {
  return new SpecTreeDataProvider(repository, new SpecGrouper(translator), translator);
}

/**
 * Build the hover introduction loader and keep its cache in sync with the
 * repository, so a changed spec never serves a stale introduction.
 * @param context The extension context owning the subscription.
 * @param repository The spec repository emitting change deltas.
 * @param fileSystem The file-system port the loader reads through.
 * @returns The subscribed loader.
 */
function createIntroductionLoader(
  context: vscode.ExtensionContext,
  repository: SpecRepository,
  fileSystem: VscodeSpecFileSystem,
): SpecIntroductionLoader {
  const loader = new SpecIntroductionLoader(fileSystem);
  const dispose = repository.onDidChangeSpecs((delta) => loader.onSpecsChanged(delta));
  context.subscriptions.push({ dispose });
  return loader;
}
/**
 * Build the spec repository, reading `.config.kiro` through its dedicated adapter.
 * @param fileSystem The host file-system wrapper (also the change notifier).
 * @returns The wired repository.
 */
function createRepository(fileSystem: VscodeSpecFileSystem): SpecRepository {
  return new SpecRepository(
    fileSystem,
    createSnapshotFactory(),
    fileSystem,
    undefined,
    new KiroSpecConfigReader(fileSystem),
  );
}
/**
 * Build the hidden-specs synchroniser over the repository and the host ports.
 * @param context The extension context supplying the workspace state.
 * @param repository The spec repository supplying snapshots and change events.
 * @param gateway The workspace gateway used to open the settings file.
 * @param diagnostics The diagnostic sink recording skipped specs and failures.
 * @param translator The host translator.
 * @returns The wired (not yet started) synchroniser.
 */
function createHiddenSpecs(
  context: vscode.ExtensionContext,
  repository: SpecRepository,
  gateway: VscodeWorkspaceGateway,
  diagnostics: VscodeOutputChannelDiagnosticSink,
  translator: ITranslator,
): HiddenSpecsSynchronizer {
  const state = new MementoHiddenSpecsState(context.workspaceState);
  return new HiddenSpecsSynchronizer({
    specs: repository,
    config: new VscodeHideSpecsConfigReader(),
    writer: new VscodeSettingsWriter(),
    store: state,
    ledger: state,
    notifier: new VscodeHiddenSpecsNotifier(gateway, translator),
    diagnostics,
    scheduler: new TimeoutScheduler(),
  });
}

/**
 * Construct the Explorer decoration provider with its translated mapper.
 * @param repository The spec repository supplying snapshots.
 * @param stats The pure aggregate-stats calculator.
 * @param translator The host translator.
 * @returns The wired decoration provider.
 */
function createDecorations(
  repository: SpecRepository,
  stats: SpecStatsCalculator,
  translator: ITranslator,
): SpecFileDecorationProvider {
  return new SpecFileDecorationProvider(
    repository,
    new SpecDecorationMapper(translator),
    stats,
    translator,
  );
}
/**
 * Construct every collaborator for the given extension context.
 * @param context The extension context supplying the base URI.
 * @returns The fully wired collaborators.
 */
function buildWiring(context: vscode.ExtensionContext): IWiring {
  const fileSystem = new VscodeSpecFileSystem();
  const repository = createRepository(fileSystem);
  const gateway = new VscodeWorkspaceGateway();
  const [translator, stats] = [new VscodeTranslator(), new SpecStatsCalculator()];
  const openDocument = new OpenDocumentCommand(repository, gateway, translator);
  const runTasks = buildRunTasksCommand(repository, fileSystem, gateway, translator);
  const agentFallback = new UnavailableAgentGateway(runTasks);
  // Start on the always-valid Null Object; detection may later upgrade it.
  const agentActions = new SpecAgentActions(repository, agentFallback, gateway, translator);
  const actions = createDashboardActions(openDocument, agentActions);
  const loader = createIntroductionLoader(context, repository, fileSystem);
  const dashboard = createDashboard(context, repository, stats, actions, loader, translator);
  return {
    repository,
    fileSystem,
    dashboard,
    decorations: createDecorations(repository, stats, translator),
    tree: createTree(repository, translator),
    openDocument,
    runTasks,
    agentActions,
    agentFallback,
    commandGateway: new VscodeCommandGateway(),
    agentDiagnostics: new VscodeOutputChannelDiagnosticSink(),
    toggleLayout: new ToggleLayoutCommand(dashboard),
    refresh: new RefreshCommand(repository),
    gateway,
    translator,
  };
}
/**
 * Build the honest-MVP run-tasks command over its collaborators.
 * @param repository The spec repository.
 * @param fileSystem The host file-system wrapper (also the parser's reader).
 * @param gateway The workspace gateway.
 * @param translator The host translator.
 * @returns The wired run-tasks command.
 */
function buildRunTasksCommand(
  repository: SpecRepository,
  fileSystem: VscodeSpecFileSystem,
  gateway: VscodeWorkspaceGateway,
  translator: ITranslator,
): RunTasksCommand {
  return new RunTasksCommand(
    repository,
    gateway,
    new RunPromptBuilder(),
    fileSystem,
    new TasksMarkdownParser(),
    translator,
  );
}
/**
 * Register the tree context-menu commands as disposables.
 *
 * Each open command is a thin, tree-item-aware wrapper over the shared
 * {@link OpenDocumentCommand}; the three task-action commands reuse the SAME
 * {@link SpecAgentActions} the dashboard buttons call (DRY), so no behaviour is
 * duplicated. All resolve the targeted spec from the context-menu node argument.
 * @param context The extension context owning the disposables.
 * @param wiring The constructed collaborators.
 */
function registerTreeCommands(context: vscode.ExtensionContext, wiring: IWiring): void {
  (Object.keys(TREE_OPEN_COMMAND_IDS) as SpecDocumentKind[]).forEach((document) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(TREE_OPEN_COMMAND_IDS[document], (node: unknown) =>
        runWithNode(wiring.gateway, wiring.translator, node, (folderPath) =>
          wiring.openDocument.execute(folderPath, document),
        ),
      ),
    );
  });
  context.subscriptions.push(
    vscode.commands.registerCommand(TREE_SYNC_FILES_COMMAND_ID, (node: unknown) =>
      runWithNode(wiring.gateway, wiring.translator, node, (folderPath) =>
        wiring.agentActions.syncTasks(folderPath),
      ),
    ),
    vscode.commands.registerCommand(TREE_RUN_REQUIRED_COMMAND_ID, (node: unknown) =>
      runWithNode(wiring.gateway, wiring.translator, node, (folderPath) =>
        wiring.agentActions.runTasks(folderPath, 'required'),
      ),
    ),
    vscode.commands.registerCommand(TREE_RUN_REQUIRED_AND_OPTIONAL_COMMAND_ID, (node: unknown) =>
      runWithNode(wiring.gateway, wiring.translator, node, (folderPath) =>
        wiring.agentActions.runTasks(folderPath, 'required-and-optional'),
      ),
    ),
  );
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
    wiring.agentDiagnostics,
    vscode.window.registerWebviewViewProvider(DASHBOARD_VIEW_ID, wiring.dashboard),
    vscode.window.registerFileDecorationProvider(wiring.decorations),
    vscode.window.registerTreeDataProvider(TREE_VIEW_ID, wiring.tree),
    vscode.commands.registerCommand(REFRESH_COMMAND_ID, () =>
      guard(wiring.gateway, wiring.translator, () => wiring.refresh.execute()),
    ),
    vscode.commands.registerCommand(TOGGLE_LAYOUT_COMMAND_ID, () => wiring.toggleLayout.execute()),
    vscode.commands.registerCommand(RUN_TASKS_COMMAND_ID, (argument: unknown) =>
      runWithFolder(wiring.gateway, wiring.translator, argument, (folderPath) =>
        wiring.runTasks.execute(folderPath),
      ),
    ),
    vscode.commands.registerCommand(
      OPEN_DOCUMENT_COMMAND_ID,
      (folderPath: string, document: SpecDocumentKind) =>
        guard(wiring.gateway, wiring.translator, () =>
          wiring.openDocument.execute(folderPath, document),
        ),
    ),
  );
  registerTreeCommands(context, wiring);
}

/**
 * Build and start the hidden-specs synchroniser, register the Reset command, and
 * re-run the synchroniser when its settings change.
 *
 * Only `kirospectracker.hideSpecs.*` is observed, never the exclusion settings
 * the synchroniser writes, so its own writes cannot re-trigger it.
 * @param context The extension context owning the disposables.
 * @param wiring The constructed collaborators.
 * @returns The started synchroniser.
 */
function registerHiddenSpecs(
  context: vscode.ExtensionContext,
  wiring: IWiring,
): HiddenSpecsSynchronizer {
  const { repository, gateway, agentDiagnostics } = wiring;
  const hiddenSpecs = createHiddenSpecs(
    context,
    repository,
    gateway,
    agentDiagnostics,
    wiring.translator,
  );
  const reset = new ResetHiddenSpecsCommand(hiddenSpecs);
  hiddenSpecs.start();
  context.subscriptions.push(
    { dispose: () => hiddenSpecs.dispose() },
    vscode.commands.registerCommand(RESET_HIDDEN_SPECS_COMMAND_ID, () =>
      guard(gateway, wiring.translator, () => reset.execute()),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(HIDE_SPECS_SECTION)) {
        hiddenSpecs.requestSync();
      }
    }),
  );
  return hiddenSpecs;
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
  const hiddenSpecs = registerHiddenSpecs(context, wiring);
  wiring.repository
    .refresh()
    .then(undefined, (error) => reportError(wiring.gateway, wiring.translator, error));
  setUpAgentIntegration(context, wiring);
  return {
    repository: wiring.repository,
    decorations: wiring.decorations,
    dashboard: wiring.dashboard,
    fileSystem: wiring.fileSystem,
    hiddenSpecs,
    agentErrorReporter: wiring.gateway,
  };
}

/**
 * Resolve the agent gateway by capability detection (honoring the disable
 * setting) and surface the beta notice, both best-effort and non-blocking.
 *
 * The actions start on the always-valid Null Object, so the UI works from the
 * first tick; this upgrades it to the Kiro adapter when a usable command surface
 * is present and the integration is enabled. The real {@link VscodeWorkspaceGateway}
 * is passed as BOTH the error reporter and the success/affordance notifier (so
 * every path is visibly backed by `vscode.window`), and the output-channel sink
 * carries the observability diagnostic. Any failure is surfaced through the
 * gateway without leaking.
 * @param context The extension context (global state, settings).
 * @param wiring The constructed collaborators.
 */
function setUpAgentIntegration(context: vscode.ExtensionContext, wiring: IWiring): void {
  const betaNotice = new VscodeAgentBetaNotice(context, undefined, wiring.translator);
  const enabled = betaNotice.isEnabled();
  guard(wiring.gateway, wiring.translator, async () => {
    const resolved = await createSpecAgentGateway(
      wiring.commandGateway,
      wiring.gateway,
      wiring.gateway,
      wiring.agentDiagnostics,
      wiring.agentFallback,
      enabled,
      wiring.translator,
    );
    wiring.agentActions.setGateway(resolved);
  }).then(undefined, (error) => reportError(wiring.gateway, wiring.translator, error));
  betaNotice
    .maybeShow()
    .then(undefined, (error) => reportError(wiring.gateway, wiring.translator, error));
}

/**
 * Deactivate the extension. No manual cleanup is required: every disposable is
 * registered in `context.subscriptions` and released by the host.
 */
export function deactivate(): void {
  // Intentionally empty.
}
