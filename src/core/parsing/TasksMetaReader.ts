import type { IExecutionHistoryEntry, IPbtResult, ITaskMeta } from '../model/ITaskMeta';

/** Immutable empty meta returned on absent or invalid input. */
const EMPTY_META: ITaskMeta = { pbtResults: {}, executionHistory: {} };

/**
 * Coerce an unknown value to a plain record, defaulting to an empty one.
 * @param value The value to coerce.
 * @returns The value as a record, or an empty record.
 */
function asRecord(value: unknown): Record<string, unknown> {
  if (null === value || 'object' !== typeof value || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

/**
 * Coerce an unknown value to a string, or `undefined`.
 * @param value The value to coerce.
 * @returns The string, or `undefined` when not a string.
 */
function asString(value: unknown): string | undefined {
  return 'string' === typeof value ? value : undefined;
}

/**
 * Coerce an unknown value to a finite number, or `undefined`.
 * @param value The value to coerce.
 * @returns The number, or `undefined` when not a finite number.
 */
function asNumber(value: unknown): number | undefined {
  return 'number' === typeof value && Number.isFinite(value) ? value : undefined;
}

/**
 * Parse JSON into a plain record, tolerating any failure.
 * @param content Raw JSON text.
 * @returns The parsed record, or `undefined` when invalid.
 */
function tryParse(content: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(content);
    if (null === value || 'object' !== typeof value) {
      return undefined;
    }
    return value as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Map every entry of a record section through a projector.
 * @param raw The raw section value.
 * @param project Projector receiving the entry record and its raw value.
 * @returns The projected record, empty when the section is not an object.
 */
function mapEntries<T>(
  raw: unknown,
  project: (entry: Record<string, unknown>, value: unknown) => T,
): Readonly<Record<string, T>> {
  const record = asRecord(raw);
  const result: Record<string, T> = {};
  Object.keys(record).forEach((key) => {
    result[key] = project(asRecord(record[key]), record[key]);
  });
  return result;
}

/**
 * Read a single execution-history entry tolerantly.
 * @param raw The raw entry value.
 * @returns The sanitised entry.
 */
function readHistoryEntry(raw: unknown): IExecutionHistoryEntry {
  const entry = asRecord(raw);
  return {
    executionId: asString(entry.executionId),
    chatSessionId: asString(entry.chatSessionId),
    timestamp: asNumber(entry.timestamp),
  };
}

/**
 * Read the `pbtResults` section into a record of {@link IPbtResult}.
 * @param raw The raw section value.
 * @returns The sanitised results, keyed by task label.
 */
function readPbtResults(raw: unknown): Readonly<Record<string, IPbtResult>> {
  return mapEntries(raw, (entry) => ({
    status: asString(entry.status),
    lastRunTimestamp: asNumber(entry.lastRunTimestamp),
  }));
}

/**
 * Read the `executionHistory` section into arrays of entries.
 * @param raw The raw section value.
 * @returns The sanitised history, keyed by task label.
 */
function readExecutionHistory(
  raw: unknown,
): Readonly<Record<string, readonly IExecutionHistoryEntry[]>> {
  return mapEntries(raw, (_entry, value) =>
    Array.isArray(value) ? value.map((item) => readHistoryEntry(item)) : [],
  );
}

/**
 * Tolerant reader turning `tasks.meta.json` text into an {@link ITaskMeta}.
 *
 * The file is a secondary signal only: it never carries the done/not-done
 * status of a task. The reader never throws; on absent, empty or invalid JSON
 * it degrades to an empty meta, and it ignores any field whose shape it does
 * not recognise.
 */
export class TasksMetaReader {
  /** Immutable empty meta returned on absent or invalid input. */
  private readonly emptyMeta: ITaskMeta = EMPTY_META;

  /**
   * Read a `tasks.meta.json` body into a tolerant meta view.
   * @param content Raw file text, or `undefined` when the file is absent.
   * @returns The parsed meta, or an empty meta on any failure.
   */
  public read(content: string | undefined): ITaskMeta {
    if (undefined === content) {
      return this.emptyMeta;
    }
    const parsed = tryParse(content);
    if (undefined === parsed) {
      return this.emptyMeta;
    }
    return {
      pbtResults: readPbtResults(parsed.pbtResults),
      executionHistory: readExecutionHistory(parsed.executionHistory),
    };
  }
}
