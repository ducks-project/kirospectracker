/** Match an ATX heading line, capturing its level hashes and its text. */
const HEADING_LINE = /^\s{0,3}(?<hashes>#{1,6})\s+(?<text>.*?)\s*#*\s*$/;

/** Heading text (case-insensitive) that marks the dedicated introduction section. */
const INTRODUCTION_HEADING = 'introduction';

/** Heading texts (lower-case, exact match) of a design-style overview section. */
const OVERVIEW_HEADINGS: ReadonlySet<string> = new Set(['overview', "vue d'ensemble"]);
/**
 * Extract the introduction of a spec document (requirements, design, bugfix) as
 * plain text.
 *
 * The function is pure, total and `vscode`-free: it never throws and returns
 * `undefined` whenever no introduction can be derived (absent file, empty or
 * heading-only document). When an `## Introduction` section exists (any heading
 * level, case-insensitive), its body up to the next heading is returned. A
 * `design.md` has no such section but an `Overview` / `Vue d'ensemble` one: its
 * first paragraph is used (sub-headings are skipped, the section ends at a
 * heading of the same or higher level). Otherwise the first non-heading
 * paragraph is returned. The result is trimmed and never includes heading lines.
 * @param content The raw document text, or `undefined` when absent.
 * @returns The introduction text, or `undefined` when none can be derived.
 */
export function extractDocumentIntroduction(content: string | undefined): string | undefined {
  if (undefined === content) {
    return undefined;
  }
  const lines = content.split(/\r?\n/);
  const section = extractIntroductionSection(lines);
  if (undefined !== section) {
    return section;
  }
  return extractOverviewParagraph(lines) ?? extractFirstParagraph(lines);
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
 * Collect the first paragraph of an `Overview` section, level-aware.
 * @param lines The document split into lines.
 * @returns The first paragraph of the section, or `undefined` when there is none.
 */
function extractOverviewParagraph(lines: readonly string[]): string | undefined {
  const start = lines.findIndex((line) => OVERVIEW_HEADINGS.has(headingText(line)));
  if (-1 === start) {
    return undefined;
  }
  const level = headingLevel(lines[start]);
  const end = lines.findIndex(
    (line, index) => index > start && headingLevel(line) <= level && isHeading(line),
  );
  return extractFirstParagraph(lines.slice(start + 1, -1 === end ? lines.length : end));
}
/**
 * Read the lower-cased text of a heading line.
 * @param line The line to inspect.
 * @returns The heading text, or an empty string when the line is not a heading.
 */
function headingText(line: string): string {
  return HEADING_LINE.exec(line)?.groups?.text.trim().toLowerCase() ?? '';
}
/**
 * Read the level (number of `#`) of a heading line.
 * @param line The line to inspect.
 * @returns The level, or `0` when the line is not a heading.
 */
function headingLevel(line: string): number {
  return HEADING_LINE.exec(line)?.groups?.hashes.length ?? 0;
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
