/**
 * Theme color identifier keys used by spec decorations.
 *
 * They are plain strings so the pure mapper carries no `vscode` type; the
 * explorer adapter turns a key into a real `vscode.ThemeColor`.
 */
export type SpecDecorationColor = 'error' | 'muted' | 'warn' | 'ok' | 'okVivid';

/**
 * Plain, `vscode`-free description of how a spec folder should be decorated in
 * the file explorer.
 */
export interface ISpecDecoration {
  /** Short badge, at most two characters. */
  readonly badge: string;

  /** Theme color key reflecting the status. */
  readonly color: SpecDecorationColor;

  /** Human-readable tooltip stating the status and progress. */
  readonly tooltip: string;
}
