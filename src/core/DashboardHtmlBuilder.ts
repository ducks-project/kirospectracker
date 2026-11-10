import type { HtmlEscaper } from './HtmlEscaper';

/** Inputs needed to build the dashboard webview HTML shell. */
export interface IDashboardHtmlInput {
  /** Per-render CSP nonce authorising the single inline-less script/style. */
  readonly nonce: string;
  /** The webview's `cspSource` (origin allowed for local resources). */
  readonly cspSource: string;
  /** URI (as string) of the bundled dashboard script. */
  readonly scriptUri: string;
  /** URI (as string) of the bundled dashboard stylesheet. */
  readonly styleUri: string;
  /** Display language written to `<html lang>` (defaults to `en`). */
  readonly language?: string;
}

/** Language written to `<html lang>` when none is given. */
const DEFAULT_LANGUAGE = 'en';
/**
 * Pure builder producing the dashboard webview HTML shell with a strict CSP.
 *
 * The CSP is `default-src 'none'` with `style-src`/`script-src`/`img-src`
 * limited to the webview `cspSource` and a per-render nonce; no network origin,
 * no inline script beyond the nonce'd bundle, no `eval`. The builder escapes the
 * untrusted-adjacent inputs it embeds and carries no `vscode` import, so it is
 * gate-covered by unit tests.
 */
export class DashboardHtmlBuilder {
  private readonly escaper: HtmlEscaper;

  /**
   * Build the HTML builder over the shared escaper.
   * @param escaper The pure HTML escaper applied to embedded attribute values.
   */
  public constructor(escaper: HtmlEscaper) {
    this.escaper = escaper;
  }

  /**
   * Build the full HTML document for the dashboard webview.
   * @param input The nonce, CSP source and bundled resource URIs.
   * @returns The HTML document string.
   */
  public build(input: IDashboardHtmlInput): string {
    const nonce = this.escaper.escape(input.nonce);
    const source = this.escaper.escape(input.cspSource);
    const script = this.escaper.escape(input.scriptUri);
    const style = this.escaper.escape(input.styleUri);
    const language = this.escaper.escape(input.language ?? DEFAULT_LANGUAGE);
    const csp =
      `default-src 'none'; img-src ${source}; ` +
      `style-src ${source} 'nonce-${nonce}'; script-src 'nonce-${nonce}';`;
    return DashboardHtmlBuilder.document(csp, nonce, script, style, language);
  }

  /**
   * Assemble the HTML document from its escaped parts.
   * @param csp The Content-Security-Policy value.
   * @param nonce The escaped nonce.
   * @param script The escaped script URI.
   * @param style The escaped stylesheet URI.
   * @param language The escaped display language.
   * @returns The HTML document string.
   */
  private static document(
    csp: string,
    nonce: string,
    script: string,
    style: string,
    language: string,
  ): string {
    return [
      '<!DOCTYPE html>',
      `<html lang="${language}">`,
      '<head>',
      '<meta charset="UTF-8" />',
      `<meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      `<link nonce="${nonce}" href="${style}" rel="stylesheet" />`,
      '<title>Kiro Spec Tracker</title>',
      '</head>',
      '<body>',
      '<main id="app" aria-live="polite"></main>',
      `<script nonce="${nonce}" src="${script}"></script>`,
      '</body>',
      '</html>',
    ].join('\n');
  }
}
