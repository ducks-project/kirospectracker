import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

import type { DashboardOutboundMessage } from '../../src/core/model/IDashboardMessage';
import type { IExtensionApi } from '../../src/extension';

const EXTENSION_ID = 'ducks-project.kirospectracker';
const isCi = 'true' === process.env.CI;

/**
 * Await a condition, polling until it holds or a timeout elapses.
 * @param predicate The condition to satisfy.
 * @param timeoutMs Maximum wait in milliseconds.
 * @returns A promise resolving when the predicate holds.
 */
async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition.');
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
}

/**
 * Build a fake webview capturing every posted message for assertion.
 * @param posted The sink receiving each posted outbound message.
 * @returns The fake webview.
 */
function makeWebview(posted: DashboardOutboundMessage[]): vscode.Webview {
  return {
    cspSource: 'vscode-resource://fixture',
    html: '',
    options: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asWebviewUri: (uri: vscode.Uri) => uri as any,
    onDidReceiveMessage: () => ({ dispose: () => undefined }),
    postMessage: async (message: DashboardOutboundMessage) => {
      posted.push(message);
      return true;
    },
  } as unknown as vscode.Webview;
}

/** Inbound message type handled by the fake booting webview. */
type InboundMessage = { readonly type: string };

/**
 * Build a fake webview that models the real webview boot handshake.
 *
 * VS Code re-creates the webview whenever the view is hidden and shown again, so
 * the reopened document boots with a fresh, empty DOM and only wires its message
 * listener once loaded. The real webview script signals that with a `ready`
 * message; the host must (re)post the current cached state in response. This
 * fake captures the host's inbound handler and exposes `boot()`, which delivers
 * that `ready` handshake exactly as the webview script does, so a test can drive
 * close+reopen deterministically.
 * @param posted The sink receiving each outbound message the host posts.
 * @returns The fake webview and a `boot` trigger simulating the page load.
 */
function makeBootingWebview(posted: DashboardOutboundMessage[]): {
  readonly webview: vscode.Webview;
  readonly boot: () => void;
} {
  let onMessage: ((message: InboundMessage) => void) | undefined;
  const webview = {
    cspSource: 'vscode-resource://fixture',
    html: '',
    options: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asWebviewUri: (uri: vscode.Uri) => uri as any,
    onDidReceiveMessage: (listener: (message: InboundMessage) => void) => {
      onMessage = listener;
      return { dispose: () => undefined };
    },
    postMessage: async (message: DashboardOutboundMessage) => {
      posted.push(message);
      return true;
    },
  } as unknown as vscode.Webview;
  const boot = (): void => onMessage?.({ type: 'ready' });
  return { webview, boot };
}

/** A fake webview capturing its inbound listener so tests can post to it. */
interface IDrivableWebview {
  readonly webview: vscode.Webview;
  readonly send: (message: InboundMessage) => void;
}

/**
 * Build a fake webview capturing its inbound handler so a test can drive an
 * arbitrary inbound message (e.g. `requestIntroduction`) through the host.
 * @param posted The sink receiving each outbound message the host posts.
 * @returns The fake webview and a `send` trigger delivering an inbound message.
 */
function makeDrivableWebview(posted: DashboardOutboundMessage[]): IDrivableWebview {
  let onMessage: ((message: InboundMessage) => void) | undefined;
  const webview = {
    cspSource: 'vscode-resource://fixture',
    html: '',
    options: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    asWebviewUri: (uri: vscode.Uri) => uri as any,
    onDidReceiveMessage: (listener: (message: InboundMessage) => void) => {
      onMessage = listener;
      return { dispose: () => undefined };
    },
    postMessage: async (message: DashboardOutboundMessage) => {
      posted.push(message);
      return true;
    },
  } as unknown as vscode.Webview;
  return { webview, send: (message: InboundMessage): void => onMessage?.(message) };
}

/**
 * Wrap a webview in a minimal {@link vscode.WebviewView} for resolve.
 * @param webview The fake webview to host.
 * @returns The fake webview view.
 */
function makeView(webview: vscode.Webview): vscode.WebviewView {
  return {
    webview,
    visible: true,
    show: () => undefined,
    onDidDispose: () => ({ dispose: () => undefined }),
    onDidChangeVisibility: () => ({ dispose: () => undefined }),
    viewType: 'kirospectracker.dashboard',
    title: 'Specs Dashboard',
  } as unknown as vscode.WebviewView;
}

/**
 * Integration suite asserting the dashboard webview view resolves, renders a
 * CSP-locked HTML document and posts the typed render/update protocol.
 */
describe('Spec dashboard (Node host)', () => {
  let api: IExtensionApi;
  let inProgressTasksUri: vscode.Uri | undefined;
  let originalTasksContent: Uint8Array | undefined;

  before(async function activateExtension() {
    const extension = vscode.extensions.getExtension<IExtensionApi>(EXTENSION_ID);
    if (undefined === extension) {
      if (isCi) {
        throw new Error('Extension not loaded under CI; this must not be skipped.');
      }
      this.skip();
      return;
    }
    api = await extension.activate();
    await waitFor(() => 0 < api.repository.getSpecs().length);
    const inProgress = api.repository.getSpecs().find((spec) => 'in-progress' === spec.name);
    expect(inProgress).to.not.equal(undefined);
    inProgressTasksUri = vscode.Uri.file(path.join(inProgress!.folderPath, 'tasks.md'));
    originalTasksContent = await vscode.workspace.fs.readFile(inProgressTasksUri);
  });

  after(async function restoreFixture() {
    if (undefined === inProgressTasksUri || undefined === originalTasksContent) {
      return;
    }
    await vscode.workspace.fs.writeFile(inProgressTasksUri, originalTasksContent);
  });

  it('resolves the webview view with a strict CSP and a nonce', () => {
    const webview = makeWebview([]);
    api.dashboard.resolveWebviewView(makeView(webview));

    expect(webview.html).to.contain("default-src 'none'");
    expect(webview.html).to.contain('nonce-');
    expect(webview.html).to.contain('<main id="app"');
  });

  it('posts a render message carrying card views on resolve', async () => {
    const posted: DashboardOutboundMessage[] = [];
    api.dashboard.resolveWebviewView(makeView(makeWebview(posted)));

    await waitFor(() => posted.some((message) => 'render' === message.type));
    const render = posted.find((message) => 'render' === message.type);
    expect(render).to.not.equal(undefined);
    expect(render).to.have.property('cards');
  });

  it('posts the translated catalogue before the render, with the host language', async () => {
    const posted: DashboardOutboundMessage[] = [];
    const webview = makeWebview(posted);
    api.dashboard.resolveWebviewView(makeView(webview));
    await waitFor(() => posted.some((message) => 'render' === message.type));
    const types = posted.map((message) => message.type);
    expect(types.indexOf('strings')).to.be.greaterThan(-1);
    expect(types.indexOf('strings')).to.be.lessThan(types.indexOf('render'));
    const strings = posted.find((message) => 'strings' === message.type);
    expect(strings).to.have.property('language', vscode.env.language);
    expect(webview.html).to.contain(`<html lang="${vscode.env.language}">`);
  });
  it('posts a single specUpdated message on a scoped spec change', async () => {
    const posted: DashboardOutboundMessage[] = [];
    api.dashboard.resolveWebviewView(makeView(makeWebview(posted)));
    await waitFor(() => posted.some((message) => 'render' === message.type));

    expect(inProgressTasksUri).to.not.equal(undefined);
    // Drive the scoped change through the production notifier's own entry point
    // with a SINGLE trigger. Using only notifyChanged (and not also writing the
    // file) avoids a second, debounced event from the real OS FileSystemWatcher,
    // which would race the assertion and post a duplicate specUpdated. The
    // downstream path (SpecRepository.handleChange -> scoped delta -> specUpdated)
    // is identical regardless of what caused the notification.
    api.fileSystem.notifyChanged(inProgressTasksUri!.fsPath);

    await waitFor(() => posted.some((message) => 'specUpdated' === message.type));
    const updates = posted.filter((message) => 'specUpdated' === message.type);
    expect(updates).to.have.length(1);
  });

  it('re-renders the cached specs when the view is closed and reopened', () => {
    // Regression for the v0.4.1 bug: closing the dashboard and reopening it
    // showed an empty spec list until a manual Refresh. VS Code disposes and
    // re-creates the webview on reopen, so the second resolve runs against a
    // fresh, empty DOM that only replies with its `ready` handshake once its
    // listener is wired. The host must (re)post the CURRENT cached state in
    // response to that handshake, WITHOUT any repository change event and
    // WITHOUT a disk re-scan.
    //
    // The assertion is driven synchronously: the `ready` handshake routes
    // through the provider's message handler, whose `postRender` pushes to the
    // fake webview in the same tick. A `fullRefresh` repository delta is always
    // asynchronous, so counting renders immediately before and after `boot()`
    // isolates the handshake-triggered render from any change-event noise, which
    // keeps the test deterministic (no watcher race, no sleeps).
    const cachedCount = api.repository.getSpecs().length;
    expect(cachedCount).to.be.greaterThan(0);

    // Close + reopen: a brand-new webview document (fresh empty DOM).
    const posted: DashboardOutboundMessage[] = [];
    const reopened = makeBootingWebview(posted);
    api.dashboard.resolveWebviewView(makeView(reopened.webview));

    // Deliver the handshake and capture the render it produces in the same
    // synchronous tick.
    const before = posted.length;
    reopened.boot();
    const handshakeMessages = posted.slice(before);

    const render = handshakeMessages.find((message) => 'render' === message.type);
    expect(render, 'the ready handshake must trigger a render on reopen').to.not.equal(undefined);
    expect(render).to.have.property('cards');
    const { cards } = render as { readonly cards: readonly unknown[] };
    expect(cards).to.have.length(cachedCount);
  });

  it('answers a requestIntroduction with the derived introduction', async () => {
    const inProgress = api.repository.getSpecs().find((spec) => 'in-progress' === spec.name);
    expect(inProgress).to.not.equal(undefined);
    const posted: DashboardOutboundMessage[] = [];
    const drivable = makeDrivableWebview(posted);
    api.dashboard.resolveWebviewView(makeView(drivable.webview));

    drivable.send({
      type: 'requestIntroduction',
      folderPath: inProgress!.folderPath,
    } as unknown as InboundMessage);

    await waitFor(() => posted.some((message) => 'introduction' === message.type));
    const reply = posted.find((message) => 'introduction' === message.type) as {
      readonly folderPath: string;
      readonly introduction: string | undefined;
    };
    expect(reply.folderPath).to.equal(inProgress!.folderPath);
    expect(reply.introduction).to.equal('An in-progress fixture spec.');
  });

  it('answers with an undefined introduction when the spec has no entry document', async () => {
    const unknownFolder = path.join(
      api.repository.getSpecs()[0].folderPath,
      '..',
      'does-not-exist',
    );
    const posted: DashboardOutboundMessage[] = [];
    const drivable = makeDrivableWebview(posted);
    api.dashboard.resolveWebviewView(makeView(drivable.webview));
    drivable.send({
      type: 'requestIntroduction',
      folderPath: unknownFolder,
    } as unknown as InboundMessage);
    await waitFor(() => posted.some((message) => 'introduction' === message.type));
    const reply = posted.find((message) => 'introduction' === message.type) as {
      readonly folderPath: string;
      readonly introduction: string | undefined;
    };
    expect(reply.folderPath).to.equal(unknownFolder);
    expect(reply.introduction).to.equal(undefined);
  });
});
