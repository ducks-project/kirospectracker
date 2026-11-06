import * as vscode from 'vscode';

/**
 * Activate the extension.
 *
 * The real composition root (repository, providers and commands) is wired in a
 * later task; this placeholder keeps the entry point valid so the node and
 * browser bundles build while the core layer is implemented bottom-up.
 * @param context The extension context owning the disposables.
 */
export function activate(context: vscode.ExtensionContext): void {
  // Wiring is implemented in the activation task (composition root). The
  // context is intentionally unused until then.
  context.subscriptions.push({ dispose: (): void => undefined });
}

/**
 * Deactivate the extension. No manual cleanup is required: every disposable is
 * registered in `context.subscriptions` and released by the host.
 */
export function deactivate(): void {
  // Intentionally empty.
}
