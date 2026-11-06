import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';

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
 * Integration suite asserting the explorer decoration provider decorates a
 * fixture spec folder.
 */
describe('Spec decorations (Node host)', () => {
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

  it('discovers the four fixture specs', () => {
    const names = api.repository
      .getSpecs()
      .map((spec) => spec.name)
      .sort();
    expect(names).to.deep.equal(['completed', 'in-progress', 'malformed', 'not-started']);
  });

  it('applies a decoration to a spec folder', () => {
    const completed = api.repository.getSpecs().find((spec) => 'completed' === spec.name);
    expect(completed).to.not.equal(undefined);
    const uri = vscode.Uri.file(path.normalize(completed!.folderPath));
    const decoration = api.decorations.provideFileDecoration(uri);
    expect(decoration).to.not.equal(undefined);
    expect(decoration?.badge).to.be.a('string');
  });

  it('does not decorate an unrelated file', () => {
    const uri = vscode.Uri.file(path.join('/tmp', 'unrelated.txt'));
    expect(api.decorations.provideFileDecoration(uri)).to.equal(undefined);
  });
});
