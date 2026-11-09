/** Match an ATX heading line, capturing its level hashes and its text. */
const HEADING_LINE = /^(?<hashes>#{1,6})\s+(?<text>.*?)\s*#*\s*$/;

/** Heading text (case-insensitive) that marks the dedicated introduction section. */
const INTRODUCTION_HEADING = 'introduction';

/**
 * Extract the introduction of a `requirements.md` document as plain text.
 *
 * The function is pure, total and `vscode`-free: it never throws and returns
 * `undefined` whenever no introduction can be derived (absent file, empty or
 * heading-only document). When an `## Introduction` section exists (any heading
 * level, case-insensitive), its body up to the next heading is returned;
 * otherwise the first non-heading paragraph (typically the blurb right after the
 * `# Title`) is returned. The result is trimmed and never includes heading lines.
 * @param content The raw `requirements.md` text, or `undefined` when absent.
 * @returns The introduction text, or `undefined` when none can be derived.
 */
export function extractRequirementsIntroduction(content: string | undefined): string | undefined {
  if (undefined === content) {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  const section = extractIntroductionSection(lines);
  if (undefined !== section) {
    return section;
  }
  return extractFirstParagraph(lines);
}

/**
 * Collect the body of the first `Introduction` heading up to the next heading.
 * @param lines The document split into lines.
 * @returns The trimmed section body, or `undefined` when there is no such section.
 */
function extractIntroductionSection(lines: readonly string[]): string | undefined {
  const start = lines.findIndex((line) => isIntroductionHeading(line));
  if (-1 === start) {
    return undefined;
  }
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isHeading(lines[index])) {
      break;
    }
    body.push(lines[index]);
  }
  return emptyToUndefined(body.join('\n').trim());
}

/**
 * Collect the first non-heading, non-empty paragraph of the document.
 * @param lines The document split into lines.
 * @returns The trimmed first paragraph, or `undefined` when there is none.
 */
function extractFirstParagraph(lines: readonly string[]): string | undefined {
  const paragraph: string[] = [];
  for (const line of lines) {
    if (isHeading(line)) {
      if (0 < paragraph.length) {
        break;
      }
      continue;
    }
    if (0 === line.trim().length) {
      if (0 < paragraph.length) {
        break;
      }
      continue;
    }
    paragraph.push(line.trim());
  }
  return emptyToUndefined(paragraph.join('\n').trim());
}

/**
 * Tell whether a line is any ATX heading.
 * @param line The line to inspect.
 * @returns `true` when the line is a `#`..`######` heading.
 */
function isHeading(line: string): boolean {
  return HEADING_LINE.test(line);
}

/**
 * Tell whether a line is a heading whose text is "Introduction".
 * @param line The line to inspect.
 * @returns `true` when the line is an introduction heading.
 */
function isIntroductionHeading(line: string): boolean {
  const match = HEADING_LINE.exec(line);
  if (null === match || undefined === match.groups) {
    return false;
  }
  return INTRODUCTION_HEADING === match.groups.text.trim().toLowerCase();
}

/**
 * Map an empty string to `undefined`, leaving any non-empty string untouched.
 * @param value The candidate string.
 * @returns The value, or `undefined` when it is empty.
 */
function emptyToUndefined(value: string): string | undefined {
  return 0 === value.length ? undefined : value;
}
