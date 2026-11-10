import type { ITranslator } from '../ports/ITranslator';
import { IDENTITY_TRANSLATOR } from '../i18n/IdentityTranslator';
/** Path separators recognised when deriving a folder basename, both POSIX and Windows. */
const PATH_SEPARATORS = /[\\/]+/;

/**
 * Derive a concise, human-readable owner label for a spec from the absolute
 * path of its owning workspace folder.
 *
 * The label is the trailing path segment (the workspace folder basename),
 * computed filesystem-agnostically over both POSIX and Windows separators, so a
 * spec under `/home/me/project` is owned by `project`. Trailing separators are
 * ignored, and an empty or separator-only path yields a stable
 * translated `Unknown folder` fallback rather than an empty string. The function
 * is pure and `vscode`-free, so it is unit- and property-testable and reusable
 * by the later folder-filtering milestone.
 * @param workspacePath Absolute path of the owning workspace folder.
 * @param translator The translator for the fallback label (English by default).
 * @returns The owner label (the folder basename, or a stable fallback).
 */
export function deriveSpecOwnerLabel(
  workspacePath: string,
  translator: ITranslator = IDENTITY_TRANSLATOR,
): string {
  const segments = workspacePath.split(PATH_SEPARATORS).filter((segment) => 0 < segment.length);
  if (0 === segments.length) {
    return translator.t('Unknown folder');
  }
  return segments[segments.length - 1];
}
