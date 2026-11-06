import * as path from 'path';
import { fileURLToPath } from 'node:url';

import { runTests } from '@vscode/test-electron';

// ESM-safe equivalent of the CommonJS `__dirname`: under ES modules there is no
// `__dirname` binding, so the current file's directory is derived from
// `import.meta.url`.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Entry point launching the VS Code integration test suite under a headless
 * editor instance (`@vscode/test-electron`). On Linux CI this process is wrapped
 * in `xvfb-run` to provide a virtual display.
 *
 * It downloads (or reuses) a VS Code build, points it at the extension at the
 * repository root, opens the bundled fixture workspace, and runs the Mocha suite
 * exported by `integration/index`.
 */
async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(currentDir, '..');
    const extensionTestsPath = path.resolve(extensionDevelopmentPath, 'out/test/integration/index');
    const workspacePath = path.resolve(extensionDevelopmentPath, 'test/fixtures/workspace');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [workspacePath, '--disable-extensions'],
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to run integration tests', error);
    process.exit(1);
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected failure while launching integration tests', error);
  process.exit(1);
});
