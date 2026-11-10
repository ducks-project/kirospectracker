import type { ISpecConfig } from '../model/ISpecConfig';
/** Config used when `.config.kiro` is absent, unreadable or malformed. */
export const EMPTY_SPEC_CONFIG: ISpecConfig = { workflowType: undefined, specType: undefined };
/**
 * Keep a value only when it is a non-empty string once trimmed.
 * @param value The candidate value.
 * @returns The trimmed string, or `undefined`.
 */
function toNonEmptyString(value: unknown): string | undefined {
  if ('string' !== typeof value) {
    return undefined;
  }
  const trimmed = value.trim();
  return 0 === trimmed.length ? undefined : trimmed;
}
/**
 * Parse the text of a `.config.kiro` file, tolerantly.
 *
 * Pure and total: it never throws. Malformed JSON, a non-object root (`null`,
 * array, number) or wrongly typed values yield the corresponding missing keys.
 * Unknown extra keys are ignored.
 * @param content The raw file text, or `undefined` when the file is absent.
 * @returns The tolerant config.
 */
export function parseSpecConfig(content: string | undefined): ISpecConfig {
  if (undefined === content) {
    return EMPTY_SPEC_CONFIG;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return EMPTY_SPEC_CONFIG;
  }
  if ('object' !== typeof parsed || null === parsed || Array.isArray(parsed)) {
    return EMPTY_SPEC_CONFIG;
  }
  const record = parsed as Readonly<Record<string, unknown>>;
  return {
    workflowType: toNonEmptyString(record.workflowType),
    specType: toNonEmptyString(record.specType),
  };
}
