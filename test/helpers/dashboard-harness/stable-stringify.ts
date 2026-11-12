/**
 * Copy a JSON-like value with object keys sorted, so the text form does not
 * depend on property insertion order.
 * @param value The value (possibly created in another realm, e.g. the vm context).
 * @returns The key-sorted copy.
 */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if ('object' === typeof value && null !== value) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([key, child]) => [key, sortKeys(child)]));
  }
  return value;
}

/**
 * Serialise a message or state to one deterministic JSON line (keys sorted).
 * @param value The value to serialise.
 * @returns The JSON text.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}
