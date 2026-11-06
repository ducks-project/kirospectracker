import * as path from 'path';

import { glob } from 'glob';
import Mocha from 'mocha';

/**
 * Mocha runner invoked inside the VS Code extension host by
 * `@vscode/test-electron`. It discovers every compiled integration spec,
 * registers it with Mocha, runs the suite, and resolves or rejects depending on
 * the number of failures.
 * @returns A promise that resolves when the suite passes and rejects on any
 *   failing test or discovery error.
 */
export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 20000 });

  const testsRoot = path.resolve(__dirname);
  const files = await glob('**/*.spec.js', { cwd: testsRoot });

  files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)));

  return new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} integration test(s) failed.`));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
