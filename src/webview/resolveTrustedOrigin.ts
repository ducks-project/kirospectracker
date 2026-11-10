/** Serialised origin of an opaque origin (sandboxed or data: documents). */
const OPAQUE_ORIGIN = 'null';
/**
 * Resolve the only origin a `message` event may come from in this webview.
 *
 * Mitigates CWE-940 (improper verification of the source of a communication
 * channel). Measured on Kiro 1.4.121 and VS Code 1.145.2: the webview host
 * posts to the guest with `window.origin` as target, so `event.origin` of every
 * legitimate host message strictly equals `window.location.origin`
 * (`vscode-webview://<id>`). `event.source` must NOT be used: it is not
 * `window.parent` in either editor.
 *
 * The caller must compare `event.origin` to the result with strict equality,
 * which rejects every other origin (sub-domain, other scheme, empty, `null`).
 * An unusable webview origin (empty or opaque) resolves to `undefined`, which
 * never equals a string, so every message is rejected.
 * @param webviewOrigin The webview document's own origin (`window.location.origin`).
 * @returns The trusted origin, or `undefined` when none can be trusted.
 */
export function resolveTrustedOrigin(webviewOrigin: string): string | undefined {
  if ('' === webviewOrigin || OPAQUE_ORIGIN === webviewOrigin) {
    return undefined;
  }
  return webviewOrigin;
}
