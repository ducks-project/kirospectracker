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

  it('posts a single specUpdated message on a scoped spec change', async () => {
    const posted: DashboardOutboundMessage[] = [];
    api.dashboard.resolveWebviewView(makeView(makeWebview(posted)));
    await waitFor(() => posted.some((message) => 'render' === message.type));

    const inProgress = api.repository.getSpecs().find((spec) => 'in-progress' === spec.name);
    expect(inProgress).to.not.equal(undefined);
    const tasksUri = vscode.Uri.file(path.join(inProgress!.folderPath, 'tasks.md'));
    const edited = '# Implementation Plan\n\n- [x] 1. Done task\n- [x] 2. Pending task\n';
    await vscode.workspace.fs.writeFile(tasksUri, Buffer.from(edited, 'utf8'));

    await waitFor(() => posted.some((message) => 'specUpdated' === message.type));
    const updates = posted.filter((message) => 'specUpdated' === message.type);
    expect(updates).to.have.length(1);
  });
});
