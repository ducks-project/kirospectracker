/**
 * Test oracle transcribing the pattern-to-RegExp conversion of the VS Code glob
 * engine (`src/vs/base/common/glob.ts`, tag 1.104.0: `splitGlobAware`,
 * `parseRegExp`, `starsToRegExp`, `toRegExp`; no trivial-pattern fast paths,
 * which are semantically equivalent). It lets the escaping tests assert how the
 * real engine reads a generated glob without importing editor source.
 */
const GLOBSTAR = '**';
const GLOB_SPLIT = '/';
const PATH_REGEX = '[/\\\\]';
const NO_PATH_REGEX = '[^/\\\\]';

function escapeRegExp(value: string): string {
  return value.replace(/[\\{}*+?|^$.[\]()]/g, '\\$&');
}

function starsToRegExp(starCount: number, isLastPattern?: boolean): string {
  if (0 === starCount) {
    return '';
  }
  if (1 === starCount) {
    return `${NO_PATH_REGEX}*?`;
  }
  const last = isLastPattern ? `|${PATH_REGEX}${NO_PATH_REGEX}+` : '';
  return `(?:${PATH_REGEX}|${NO_PATH_REGEX}+${PATH_REGEX}${last})*?`;
}

function splitGlobAware(pattern: string, splitChar: string): string[] {
  if (!pattern) {
    return [];
  }
  const segments: string[] = [];
  let inBraces = false;
  let inBrackets = false;
  let current = '';
  for (const char of pattern) {
    if (char === splitChar && !inBraces && !inBrackets) {
      segments.push(current);
      current = '';
      continue;
    }
    if ('{' === char) {
      inBraces = true;
    } else if ('}' === char) {
      inBraces = false;
    } else if ('[' === char) {
      inBrackets = true;
    } else if (']' === char) {
      inBrackets = false;
    }
    current += char;
  }
  if (current) {
    segments.push(current);
  }
  return segments;
}

function bracketChar(char: string, bracketVal: string): string {
  if ('-' === char) {
    return char;
  }
  if (('^' === char || '!' === char) && !bracketVal) {
    return '^';
  }
  return GLOB_SPLIT === char ? '' : escapeRegExp(char);
}

function segmentToRegExp(segment: string): string {
  let regEx = '';
  let inBraces = false;
  let braceVal = '';
  let inBrackets = false;
  let bracketVal = '';
  for (const char of segment) {
    if ('}' !== char && inBraces) {
      braceVal += char;
    } else if (inBrackets && (']' !== char || !bracketVal)) {
      bracketVal += bracketChar(char, bracketVal);
    } else if ('{' === char) {
      inBraces = true;
    } else if ('[' === char) {
      inBrackets = true;
    } else if ('}' === char) {
      const choices = splitGlobAware(braceVal, ',').map((choice) => parseRegExp(choice));
      regEx += `(?:${choices.join('|')})`;
      inBraces = false;
      braceVal = '';
    } else if (']' === char) {
      regEx += `[${bracketVal}]`;
      inBrackets = false;
      bracketVal = '';
    } else if ('?' === char) {
      regEx += NO_PATH_REGEX;
    } else if ('*' === char) {
      regEx += starsToRegExp(1);
    } else {
      regEx += escapeRegExp(char);
    }
  }
  return regEx;
}

function parseRegExp(pattern: string): string {
  if (!pattern) {
    return '';
  }
  const segments = splitGlobAware(pattern, GLOB_SPLIT);
  if (segments.every((segment) => GLOBSTAR === segment)) {
    return '.*';
  }
  let regEx = '';
  let previousWasGlobstar = false;
  segments.forEach((segment, index) => {
    const isGlobstar = GLOBSTAR === segment;
    if (isGlobstar && !previousWasGlobstar) {
      regEx += starsToRegExp(2, index === segments.length - 1);
    } else if (!isGlobstar) {
      regEx += segmentToRegExp(segment);
      const moreToCome =
        index < segments.length - 1 &&
        (GLOBSTAR !== segments[index + 1] || index + 2 < segments.length);
      regEx += moreToCome ? PATH_REGEX : '';
    }
    previousWasGlobstar = isGlobstar;
  });
  return regEx;
}

/**
 * Whether a glob pattern matches a path under the transcribed engine rules.
 * @param pattern The glob pattern (trimmed first, as the engine does).
 * @param path The path to test.
 * @returns `true` when the engine would report a match.
 */
export function vscodeGlobMatches(pattern: string, path: string): boolean {
  return new RegExp(`^${parseRegExp(pattern.trim())}$`).test(path);
}
