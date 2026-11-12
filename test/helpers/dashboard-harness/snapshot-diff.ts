/** Lines of context shown around the first difference. */
const CONTEXT_LINES = 4;

/**
 * Describe the first difference between a reference text and the actual text.
 * @param expected The versioned reference.
 * @param actual The text produced by the current code.
 * @returns A readable report, or `undefined` when the texts are identical.
 */
export function describeFirstDifference(expected: string, actual: string): string | undefined {
  if (expected === actual) {
    return undefined;
  }
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  let index = 0;
  while (
    index < expectedLines.length &&
    index < actualLines.length &&
    expectedLines[index] === actualLines[index]
  ) {
    index += 1;
  }
  const from = Math.max(0, index - CONTEXT_LINES);
  const window = (lines: readonly string[]): string =>
    lines
      .slice(from, index + CONTEXT_LINES + 1)
      .map((line, offset) => `${String(from + offset + 1).padStart(5)} | ${line}`)
      .join('\n');
  return [
    `First difference at line ${index + 1} (reference ${expectedLines.length} lines, actual ${actualLines.length} lines).`,
    '--- reference ---',
    window(expectedLines),
    '--- actual ---',
    window(actualLines),
  ].join('\n');
}
