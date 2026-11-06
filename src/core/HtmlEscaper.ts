/** Ordered replacements applied to escape HTML-significant characters. */
const ESCAPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
  [/"/g, '&quot;'],
  [/'/g, '&#39;'],
];

/**
 * Pure escaper for untrusted spec text injected into the webview.
 *
 * Spec file content is untrusted data; every string rendered into the webview
 * HTML passes through this escaper so it can never break out of its context or
 * inject markup. The ampersand is escaped first so later replacements do not
 * double-escape the entities it introduces.
 */
export class HtmlEscaper {
  private readonly escapes: ReadonlyArray<readonly [RegExp, string]> = ESCAPES;

  /**
   * Escape the HTML-significant characters of a string.
   * @param value The untrusted raw string.
   * @returns The escaped string, safe to inject into HTML text or attributes.
   */
  public escape(value: string): string {
    return this.escapes.reduce(
      (escaped, [pattern, replacement]) => escaped.replace(pattern, replacement),
      value,
    );
  }
}
