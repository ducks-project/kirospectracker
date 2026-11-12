/**
 * Decide what `activate` hands back to the host as the extension's `exports`.
 *
 * Every installed extension can read `vscode.extensions.getExtension(id).exports`,
 * so returning the internal objects (repository, file system, agent actions, ...)
 * in a shipped build would let any other extension reach them, for example to
 * swap the agent gateway. They exist only for the integration harness, so they
 * are returned solely when the extension runs in test mode
 * (`ExtensionMode.Test`); in every other mode nothing internal is exported.
 *
 * The caller computes the boolean from `context.extensionMode`; this function is
 * pure and free of `vscode`, so the rule is unit-testable. The API is built
 * lazily, so outside test mode no object is even assembled for export.
 * @param isTestMode Whether the extension runs in test mode.
 * @param buildApi Factory assembling the test-only API.
 * @returns The API in test mode, `undefined` otherwise.
 */
export function selectExportedApi<TApi>(
  isTestMode: boolean,
  buildApi: () => TApi,
): TApi | undefined {
  if (!isTestMode) {
    return undefined;
  }
  return buildApi();
}
