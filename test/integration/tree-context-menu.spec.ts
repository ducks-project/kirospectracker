import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

import type { IExtensionApi } from '../../src/extension';
import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type { ISpecAgentGateway } from '../../src/core/ports/ISpecAgentGateway';

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
 * Wrap a snapshot in the spec tree node shape the context-menu command receives.
 * @param spec The spec snapshot.
 * @returns The tree node argument.
 */
function specNode(spec: ISpecSnapshot): { kind: 'spec'; spec: ISpecSnapshot } {
  return { kind: 'spec', spec };
}

/**
 * Build a gateway recording every call, to prove the guard stops a spec before
 * any gateway (Kiro chat or fallback) is reached.
 * @param calls The list receiving one entry per gateway call.
 * @returns The recording gateway.
 */
function recordingGateway(calls: string[]): ISpecAgentGateway {
  return {
    availability: () => 'integrated',
    syncTasks: async (): Promise<void> => {
      calls.push('syncTasks');
    },
    runTasks: async (): Promise<void> => {
      calls.push('runTasks');
    },
  };
}
/**
 * Integration suite asserting the "Specs by Status" tree context-menu commands
 * are wired to the shared open/run behaviour and resolve their target from the
 * tree node argument.
 */
describe('Tree context menu (Node host)', () => {
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

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('opens the requirements of the targeted spec', async () => {
    const spec = api.repository.getSpecs().find((candidate) => 'in-progress' === candidate.name);
    expect(spec).to.not.equal(undefined);
    await vscode.commands.executeCommand(
      'kirospectracker.tree.openRequirements',
      specNode(spec as ISpecSnapshot),
    );
    await waitFor(() => undefined !== vscode.window.activeTextEditor);
    const opened = vscode.window.activeTextEditor?.document.uri.fsPath;
    expect(opened).to.equal(path.join((spec as ISpecSnapshot).folderPath, 'requirements.md'));
  });

  it('opens the tasks of the targeted spec', async () => {
    const spec = api.repository.getSpecs().find((candidate) => 'in-progress' === candidate.name);
    await vscode.commands.executeCommand(
      'kirospectracker.tree.openTasks',
      specNode(spec as ISpecSnapshot),
    );
    await waitFor(() => undefined !== vscode.window.activeTextEditor);
    const opened = vscode.window.activeTextEditor?.document.uri.fsPath;
    expect(opened).to.equal(path.join((spec as ISpecSnapshot).folderPath, 'tasks.md'));
  });

  it('refuses to run a malformed spec (reports an error, opens no editor)', async () => {
    const spec = api.repository.getSpecs().find((candidate) => 'malformed' === candidate.name);
    expect(spec).to.not.equal(undefined);
    const reported: string[] = [];
    const reporter = api.agentErrorReporter;
    const original = reporter.showError;
    const originalGateway = api.agentActions.getGateway();
    const gatewayCalls: string[] = [];
    api.agentActions.setGateway(recordingGateway(gatewayCalls));
    reporter.showError = (message: string): void => {
      reported.push(message);
    };
    try {
      await vscode.commands.executeCommand(
        'kirospectracker.tree.runRequired',
        specNode(spec as ISpecSnapshot),
      );
    } finally {
      reporter.showError = original;
      api.agentActions.setGateway(originalGateway);
    }
    expect(gatewayCalls).to.deep.equal([]);
    expect(reported).to.have.length(1);
    expect(reported[0]).to.contain('"malformed"');
    expect(vscode.window.activeTextEditor).to.equal(undefined);
  });
});
