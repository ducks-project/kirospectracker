import * as path from 'path';
import { fileURLToPath } from 'node:url';

import { runTests } from '@vscode/test-electron';

// ESM-safe equivalent of the CommonJS `__dirname`: under ES modules there is no
// `__dirname` binding, so the current file's directory is derived from
// `import.meta.url`.
const currentDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * VS Code build the integration suite runs against. Pinned (instead of the
 * moving `stable`) so a given commit behaves the same from one day to the next.
 * Raise it deliberately, see docs/testing.md. Ignored when an executable is
 * provided through `KIRO_SPEC_TRACKER_TEST_EXECUTABLE`.
 */
const PINNED_VSCODE_VERSION = '1.146.0';

/**
 * Read an optional, non-empty environment variable.
 * @param name The variable name.
 * @returns Its value, or `undefined` when unset or empty.
 */
function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return undefined === value || '' === value ? undefined : value;
}
/**
 * Build the optional launch options from the `KIRO_SPEC_TRACKER_TEST_*`
 * variables, so a local run can target another editor build (for example the
 * installed Kiro) under a chosen display language with a disposable profile.
 * With none set the result is empty and the default (CI) behaviour is unchanged.
 * @returns The executable path, extra launch arguments and the expected locale.
 */
function readOptions(): { executable?: string; args: string[]; locale?: string } {
  const args: string[] = [];
  const locale = optionalEnv('KIRO_SPEC_TRACKER_TEST_LOCALE');
  const userDataDir = optionalEnv('KIRO_SPEC_TRACKER_TEST_USER_DATA_DIR');
  const extensionsDir = optionalEnv('KIRO_SPEC_TRACKER_TEST_EXTENSIONS_DIR');
  const extra = optionalEnv('KIRO_SPEC_TRACKER_TEST_EXTRA_ARGS');
  if (undefined !== locale) {
    args.push(`--locale=${locale}`);
  }
  if (undefined !== userDataDir) {
    args.push(`--user-data-dir=${userDataDir}`);
  }
  if (undefined !== extensionsDir) {
    args.push(`--extensions-dir=${extensionsDir}`);
  }
  if (undefined !== extra) {
    args.push(...extra.split(/\s+/).filter((flag) => '' !== flag));
  }
  return { executable: optionalEnv('KIRO_SPEC_TRACKER_TEST_EXECUTABLE'), args, locale };
}
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

    const options = readOptions();
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      ...(undefined === options.executable
        ? { version: PINNED_VSCODE_VERSION }
        : { vscodeExecutablePath: options.executable }),
      ...(undefined === options.locale
        ? {}
        : { extensionTestsEnv: { KIRO_SPEC_TRACKER_TEST_LOCALE: options.locale } }),
      launchArgs: [workspacePath, '--disable-extensions', ...options.args],
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
