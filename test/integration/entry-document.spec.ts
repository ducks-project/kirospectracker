import { expect } from 'chai';
import * as vscode from 'vscode';
import type {
  DashboardOutboundMessage,
  SpecDocumentKind,
} from '../../src/core/model/IDashboardMessage';
import type { IExtensionApi } from '../../src/extension';
import { loadTestApi } from '../helpers/test-extension-api';

/** Inbound message shape the fake webview delivers to the host. */
type InboundMessage = { readonly type: string; readonly [key: string]: unknown };
/** Expected entry document and hover introduction per fixture spec. */
const EXPECTATIONS: ReadonlyArray<{
  readonly spec: string;
  readonly entry: SpecDocumentKind;
  readonly file: string;
  readonly introduction: string;
}> = [
  {
    spec: 'requirements-first-spec',
    entry: 'requirements',
    file: 'requirements.md',
    introduction: 'Requirements-first requirements intro.',
  },
  {
    spec: 'design-first-spec',
    entry: 'design',
    file: 'design.md',
    introduction: 'Design-first design overview.',
  },
  {
    spec: 'bugfix-spec',
    entry: 'bugfix',
    file: 'bugfix.md',
    introduction: 'Bugfix document intro.',
  },
  {
    spec: 'in-progress',
    entry: 'requirements',
    file: 'requirements.md',
    introduction: 'An in-progress fixture spec.',
  },
];
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
 * Build a fake webview view whose inbound handler the test can drive.
 * @param posted The sink receiving each outbound message.
 * @returns The view and a `send` trigger delivering an inbound message.
 */
function makeDrivableView(posted: DashboardOutboundMessage[]): {
  readonly view: vscode.WebviewView;
  readonly send: (message: InboundMessage) => void;
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
  const view = {
    webview,
    visible: true,
    show: () => undefined,
    onDidDispose: () => ({ dispose: () => undefined }),
    onDidChangeVisibility: () => ({ dispose: () => undefined }),
    viewType: 'kirospectracker.dashboard',
    title: 'Specs Dashboard',
  } as unknown as vscode.WebviewView;
  return { view, send: (message: InboundMessage): void => onMessage?.(message) };
}
/**
 * Integration suite covering card click and hover on one fixture of each spec
 * type (requirements-first, design-first, bugfix, no `.config.kiro`).
 */
describe('Entry document (click and hover)', () => {
  let api: IExtensionApi;
  before(async function activateExtension() {
    const loaded = await loadTestApi();
    if (undefined === loaded) {
      this.skip();
      return;
    }
    api = loaded;
    await waitFor(() => EXPECTATIONS.every((e) => undefined !== findSpec(e.spec)));
  });
  /** Find a discovered fixture spec by name. */
  function findSpec(name: string) {
    return api?.repository.getSpecs().find((spec) => name === spec.name);
  }
  EXPECTATIONS.forEach(({ spec, entry, file, introduction }) => {
    it(`${spec}: click opens ${file} and hover reads its introduction`, async () => {
      const snapshot = findSpec(spec)!;
      expect(snapshot.entryDocument).to.equal(entry);
      const posted: DashboardOutboundMessage[] = [];
      const drivable = makeDrivableView(posted);
      api.dashboard.resolveWebviewView(drivable.view);
      drivable.send({
        type: 'openDocument',
        folderPath: snapshot.folderPath,
        document: snapshot.entryDocument,
      });
      await waitFor(
        () => vscode.window.activeTextEditor?.document.fileName.endsWith(file) ?? false,
      );
      drivable.send({
        type: 'requestIntroduction',
        folderPath: snapshot.folderPath,
      } as InboundMessage);
      await waitFor(() => posted.some((message) => 'introduction' === message.type));
      const reply = posted.find((message) => 'introduction' === message.type) as {
        readonly introduction: string | undefined;
      };
      expect(reply.introduction).to.equal(introduction);
    });
  });
  it('a .config.kiro change posts a specUpdated carrying the entry document', async () => {
    const snapshot = findSpec('design-first-spec')!;
    const posted: DashboardOutboundMessage[] = [];
    api.dashboard.resolveWebviewView(makeDrivableView(posted).view);
    await waitFor(() => posted.some((message) => 'render' === message.type));
    api.fileSystem.notifyChanged(`${snapshot.folderPath}/.config.kiro`);
    await waitFor(() => posted.some((message) => 'specUpdated' === message.type));
    const update = posted.find((message) => 'specUpdated' === message.type) as {
      readonly card: { readonly entryDocument: SpecDocumentKind | undefined };
    };
    expect(update.card.entryDocument).to.equal('design');
  });
});
