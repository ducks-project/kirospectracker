import * as vscode from 'vscode';

import type {
  DashboardInboundMessage,
  IRenderMessage,
  ISpecUpdatedMessage,
} from '../core/model/IDashboardMessage';
import type { SpecChangeDelta } from '../core/model/ISpecChangeDelta';
import type { DashboardHtmlBuilder } from '../core/DashboardHtmlBuilder';
import type { NonceFactory } from '../core/NonceFactory';
import type { SpecCardViewMapper } from '../core/status/SpecCardViewMapper';
import type { SpecStatsCalculator } from '../core/status/SpecStatsCalculator';
import type { IDashboardActions } from './ports/IDashboardActions';
import type { ILayoutToggleable } from './ports/ILayoutToggleable';
import type { SpecRepository } from './SpecRepository';

/** View id contributed in package.json for the dashboard webview. */
export const DASHBOARD_VIEW_ID = 'kirospectracker.dashboard';

/** Relative media folder holding the bundled webview assets. */
const MEDIA_FOLDER = 'media';

/** Bundled webview script file name. */
const SCRIPT_FILE = 'dashboard.js';

/** Bundled webview stylesheet file name. */
const STYLE_FILE = 'dashboard.css';

/**
 * Activity-bar dashboard {@link vscode.WebviewViewProvider}.
 *
 * It renders a CSP-locked HTML shell (built by the pure
 * {@link DashboardHtmlBuilder} with a per-render {@link NonceFactory} nonce),
 * loads only bundled local resources, makes no network request, and exchanges a
 * typed `postMessage` protocol with the webview. Inbound intents are delegated
 * to the injected {@link IDashboardActions}; the render payload is rebuilt from
 * the repository whenever specs change.
 */
export class SpecDashboardViewProvider implements vscode.WebviewViewProvider, ILayoutToggleable {
  private readonly extensionUri: vscode.Uri;

  private readonly repository: SpecRepository;

  private readonly stats: SpecStatsCalculator;

  private readonly cardMapper: SpecCardViewMapper;

  private readonly htmlBuilder: DashboardHtmlBuilder;

  private readonly nonceFactory: NonceFactory;

  private readonly actions: IDashboardActions;

  private view: vscode.WebviewView | undefined;

  private disposeRepositoryListener: (() => void) | undefined;

  /**
   * Build the provider over the extension URI and its collaborators.
   * @param extensionUri Base URI used to resolve bundled resources.
   * @param repository The spec repository supplying snapshots.
   * @param stats The pure aggregate-stats calculator.
   * @param cardMapper The pure snapshot-to-card-view projector.
   * @param htmlBuilder The pure CSP HTML shell builder.
   * @param nonceFactory The per-render nonce factory.
   * @param actions The handler for inbound dashboard intents.
   */
  public constructor(
    extensionUri: vscode.Uri,
    repository: SpecRepository,
    stats: SpecStatsCalculator,
    cardMapper: SpecCardViewMapper,
    htmlBuilder: DashboardHtmlBuilder,
    nonceFactory: NonceFactory,
    actions: IDashboardActions,
  ) {
    this.extensionUri = extensionUri;
    this.repository = repository;
    this.stats = stats;
    this.cardMapper = cardMapper;
    this.htmlBuilder = htmlBuilder;
    this.nonceFactory = nonceFactory;
    this.actions = actions;
  }

  /**
   * Resolve the webview: lock it down, render the shell and wire the protocol.
   * Any repository subscription held from a previous resolve is released first
   * so a re-resolved view never accumulates duplicate listeners.
   * @param view The webview view to populate.
   */
  public resolveWebviewView(view: vscode.WebviewView): void {
    this.disposeRepositoryListener?.();
    this.view = view;
    const { webview } = view;
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, MEDIA_FOLDER);
    webview.options = { enableScripts: true, localResourceRoots: [mediaUri] };
    webview.html = this.renderHtml(webview);
    webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.disposeRepositoryListener = this.repository.onDidChangeSpecs((delta) =>
      this.handleDelta(delta),
    );
    view.onDidDispose(() => this.handleViewDisposed());
    this.postRender();
  }

  /**
   * Ask the live webview to toggle its layout (list <-> grid). No-op when the
   * view is not currently resolved.
   */
  public toggleLayout(): void {
    this.view?.webview.postMessage({ type: 'toggleLayout' }).then(undefined, undefined);
  }

  /**
   * Release the repository subscription held while the view was live.
   */
  public dispose(): void {
    this.disposeRepositoryListener?.();
    this.disposeRepositoryListener = undefined;
  }

  /**
   * Build the CSP-locked HTML shell for the webview.
   * @param webview The webview whose cspSource and asset URIs are used.
   * @returns The HTML document string.
   */
  private renderHtml(webview: vscode.Webview): string {
    const asset = (file: string): string =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, MEDIA_FOLDER, file)).toString();
    return this.htmlBuilder.build({
      nonce: this.nonceFactory.create(),
      cspSource: webview.cspSource,
      scriptUri: asset(SCRIPT_FILE),
      styleUri: asset(STYLE_FILE),
    });
  }

  /**
   * React to a repository change: a full render on refresh, a single-card
   * update on a scoped change.
   * @param delta The fine-grained change describing what changed.
   */
  private handleDelta(delta: SpecChangeDelta): void {
    if ('fullRefresh' === delta.type) {
      this.postRender();
      return;
    }
    if (undefined === this.view) {
      return;
    }
    const snapshots = this.repository.getSpecs();
    const snapshot = snapshots.find((spec) => spec.folderPath === delta.folderPath);
    if (undefined === snapshot) {
      return;
    }
    const message: ISpecUpdatedMessage = {
      type: 'specUpdated',
      card: this.cardMapper.map(snapshot),
      stats: this.stats.calculate(snapshots),
    };
    this.view.webview.postMessage(message).then(undefined, undefined);
  }

  /**
   * Post the current card views and stats to the webview.
   */
  private postRender(): void {
    if (undefined === this.view) {
      return;
    }
    const snapshots = this.repository.getSpecs();
    const message: IRenderMessage = {
      type: 'render',
      cards: this.cardMapper.mapAll(snapshots),
      stats: this.stats.calculate(snapshots),
    };
    this.view.webview.postMessage(message).then(undefined, undefined);
  }

  /**
   * Route a typed inbound message to the matching action.
   * @param message The message received from the webview.
   */
  private handleMessage(message: DashboardInboundMessage): void {
    if ('openDocument' === message.type) {
      this.actions.openDocument(message.folderPath, message.document).then(undefined, undefined);
      return;
    }
    if ('runTasks' === message.type) {
      this.actions.runTasks(message.folderPath).then(undefined, undefined);
    }
    // `setLayout` is handled entirely inside the webview (persisted via its
    // own state); the extension needs no server-side action for it.
  }

  /**
   * Clear the live view and its subscription when the view is disposed.
   */
  private handleViewDisposed(): void {
    this.view = undefined;
    this.dispose();
  }
}
