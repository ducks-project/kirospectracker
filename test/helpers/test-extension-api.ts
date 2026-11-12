import * as vscode from 'vscode';
import type { IExtensionApi } from '../../src/extension';

/** Fully-qualified identifier of the extension under test (`publisher.name`). */
const EXTENSION_ID = 'ducks-project.kirospectracker';

/**
 * Whether the suite runs under continuous integration. When true, a missing
 * extension must FAIL explicitly instead of being skipped.
 */
const isCi = 'true' === process.env.CI;

/**
 * Activate the extension under test and return its test-only API.
 *
 * The API is exported only in `ExtensionMode.Test`, so an `undefined` export from
 * a loaded extension means the harness is not running in test mode and fails
 * loudly instead of letting a spec read an absent API.
 * @returns The API, or `undefined` when the extension is not loaded locally (the
 *   caller skips); under CI a missing extension throws.
 */
export async function loadTestApi(): Promise<IExtensionApi | undefined> {
  const extension = vscode.extensions.getExtension<IExtensionApi | undefined>(EXTENSION_ID);
  if (undefined === extension) {
    if (isCi) {
      throw new Error('Extension not loaded under CI; this must not be skipped.');
    }
    return undefined;
  }
  const api = await extension.activate();
  if (undefined === api) {
    throw new Error('The test-only API is missing: the extension is not running in test mode.');
  }
  return api;
}
