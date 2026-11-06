import { expect } from 'chai';
import * as vscode from 'vscode';

import type { IExtensionApi } from '../../src/extension';

const EXTENSION_ID = 'ducks-project.kirospectracker';
const isCi = 'true' === process.env.CI;

/**
 * Integration suite asserting the dashboard webview view resolves and renders a
 * CSP-locked HTML document.
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
  });

  it('resolves the webview view with a strict CSP and a nonce', () => {
    const webview: vscode.Webview = {
      cspSource: 'vscode-resource://fixture',
      html: '',
      options: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      asWebviewUri: (uri: vscode.Uri) => uri as any,
      onDidReceiveMessage: () => ({ dispose: () => undefined }),
      postMessage: async () => true,
    } as unknown as vscode.Webview;

    const disposables: Array<() => void> = [];
    const view: vscode.WebviewView = {
      webview,
      visible: true,
      show: () => undefined,
      onDidDispose: (listener: () => void) => {
        disposables.push(listener);
        return { dispose: () => undefined };
      },
      onDidChangeVisibility: () => ({ dispose: () => undefined }),
      viewType: 'kirospectracker.dashboard',
      title: 'Specs Dashboard',
    } as unknown as vscode.WebviewView;

    api.dashboard.resolveWebviewView(view);

    expect(webview.html).to.contain("default-src 'none'");
    expect(webview.html).to.contain('nonce-');
    expect(webview.html).to.contain('<main id="app"');
  });
});
