import { expect } from 'chai';
import * as vscode from 'vscode';

/**
 * Fully-qualified identifier of the extension under test, as declared in
 * `package.json` (`publisher.name`).
 */
const EXTENSION_ID = 'ducks-project.kirospectracker';

/** Commands the extension must contribute, matching `package.json`. */
const EXPECTED_COMMANDS: readonly string[] = [
  'kirospectracker.refresh',
  'kirospectracker.runTasks',
  'kirospectracker.toggleLayout',
];

/**
 * Whether the suite runs under continuous integration. When true, a missing
 * extension must FAIL explicitly instead of being skipped, so a broken CI
 * environment can never let the integration suite pass silently.
 */
const isCi = 'true' === process.env.CI;

/**
 * Node-based extension host smoke suite (`@vscode/test-electron`).
 *
 * It activates the extension and asserts it is active and that its contributed
 * commands are registered. Locally it skips when the extension is not loaded;
 * under CI a missing extension is a hard failure.
 */
describe('Extension smoke (Node host)', () => {
  before(async function activateExtension() {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    if (undefined === extension) {
      if (isCi) {
        throw new Error('Extension not loaded under CI; this must not be skipped.');
      }
      this.skip();
      return;
    }
    await extension.activate();
  });

  it('reports the extension as active after bootstrap', () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    expect(extension?.isActive).to.equal(true);
  });

  it('registers every contributed command', async () => {
    const commands = await vscode.commands.getCommands(true);
    EXPECTED_COMMANDS.forEach((command) => {
      expect(commands).to.include(command);
    });
  });
});
