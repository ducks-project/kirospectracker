import { expect } from 'chai';
import * as vscode from 'vscode';

import type { IExtensionApi } from '../../src/extension';
import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type { SpecTreeNode } from '../../src/adapters/SpecTreeDataProvider';

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
 * Integration suite asserting the tree view resolves a spec leaf's hover
 * tooltip lazily with the introduction of its `requirements.md`.
 */
describe('Tree hover tooltip (Node host)', () => {
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

  it('resolves the requirements introduction as the spec leaf tooltip', async () => {
    const spec = api.repository.getSpecs().find((candidate) => 'in-progress' === candidate.name);
    expect(spec).to.not.equal(undefined);
    const node: SpecTreeNode = { kind: 'spec', spec: spec as ISpecSnapshot };
    const item = new vscode.TreeItem((spec as ISpecSnapshot).name);
    const resolved = await api.tree.resolveTreeItem(
      item,
      node,
      new vscode.CancellationTokenSource().token,
    );
    const tooltip = resolved.tooltip as vscode.MarkdownString;
    expect(tooltip).to.be.instanceOf(vscode.MarkdownString);
    expect(tooltip.value).to.contain('An in-progress fixture spec.');
  });

  it('leaves a group node tooltip untouched', async () => {
    const [group] = api.tree.getChildren();
    expect(group).to.not.equal(undefined);
    const item = new vscode.TreeItem('group');
    const resolved = await api.tree.resolveTreeItem(
      item,
      group,
      new vscode.CancellationTokenSource().token,
    );
    expect(resolved.tooltip).to.equal(undefined);
  });
});
