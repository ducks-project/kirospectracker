/** Folder prefix every spec exclusion glob starts with. */
const GLOB_PREFIX = '**/.kiro/specs/';

/** Suffix making the glob match the folder AND every file below it. */
const GLOB_SUFFIX = '/**';

/** Characters rewritten as a one-character class (`*` → `[*]`). */
const CLASS_ESCAPED = new Set(['*', '?', '[', '}']);

/** Highest C0 control code point; control characters have no reliable glob form. */
const LAST_C0_CONTROL = 0x1f;

/** The DEL control code point. */
const DELETE_CONTROL = 0x7f;

/**
 * Pure builder of the `files.exclude` / `search.exclude` glob hiding one spec.
 *
 * The VS Code glob engine has NO backslash escape: a wildcard is made literal by
 * wrapping it in a one-character class, and `]` is literal as the first
 * character of a class (`[]]`). The `/**` suffix is required because the Quick
 * Open history is matched against FILE paths (a bare folder glob would not
 * match `tasks.md`). A name containing `{` cannot be written reliably (the engine
 * keeps its brace state open even inside a class, which breaks the `/**` suffix),
 * so such names are rejected, as are names with a separator, a control character
 * or trailing whitespace (the engine trims the pattern).
 */
export class SpecExcludeGlob {
  /**
   * Whether a spec name can be expressed as a reliable exclusion glob.
   * @param name The spec folder name.
   * @returns `true` when {@link build} returns a glob for it.
   */
  public isSupported(name: string): boolean {
    if (0 === name.length || name !== name.trimEnd()) {
      return false;
    }
    return !Array.from(name).some((char) => this.isForbidden(char));
  }

  private isForbidden(char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    return code <= LAST_C0_CONTROL || DELETE_CONTROL === code || /[/\\{]/.test(char);
  }

  /**
   * Build the exclusion glob hiding a spec folder and its files.
   * @param name The spec folder name.
   * @returns The glob, or `undefined` when the name cannot be escaped reliably.
   */
  public build(name: string): string | undefined {
    if (!this.isSupported(name)) {
      return undefined;
    }
    return `${GLOB_PREFIX}${this.escape(name)}${GLOB_SUFFIX}`;
  }

  private escape(name: string): string {
    return Array.from(name, (char) => this.escapeCharacter(char)).join('');
  }

  private escapeCharacter(char: string): string {
    if (']' === char) {
      return '[]]';
    }
    return CLASS_ESCAPED.has(char) ? `[${char}]` : char;
  }
}
