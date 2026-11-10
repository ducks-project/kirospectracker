/** Positional marker pattern, identical to the one `vscode.l10n.t` uses. */
const MARKER = /\{(\d+)\}/g;
/**
 * Substitute positional `{n}` markers of a message template.
 *
 * Mirrors the `vscode.l10n.t` dialect: substitution is a single pass (a value
 * containing `{0}` is never re-expanded), and a marker without a matching
 * argument is left unchanged. With no argument the template is returned as is.
 * @param template The message template.
 * @param args The positional values.
 * @returns The substituted message.
 */
export function formatMessage(template: string, args: ReadonlyArray<string | number>): string {
  if (0 === args.length) {
    return template;
  }
  return template.replace(MARKER, (marker: string, index: string): string => {
    const value = args[Number(index)];
    return undefined === value ? marker : String(value);
  });
}
