import { readFileSync } from 'fs';
import * as path from 'path';
/**
 * Repository root. The suites always run from it (`npm run …`), and `cwd` is
 * the one location that works in both the ESM unit suite and the CommonJS
 * integration build.
 */
export const REPOSITORY_ROOT = process.cwd();
/** Placeholder pattern of a manifest value: the whole string is `%id%`. */
const PLACEHOLDER = /^%([^%]+)%$/;
/**
 * Read and parse a JSON file of the repository.
 * @param relativePath Path relative to the repository root.
 * @returns The parsed JSON value.
 */
export function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf8')) as T;
}
/**
 * Read the extension manifest (`package.json`), unresolved.
 * @returns The parsed manifest.
 */
export function readManifest<T>(): T {
  return readJson<T>('package.json');
}
/**
 * Resolve a manifest value through `package.nls.json`, as the host does for the
 * default language: a `%id%` placeholder becomes its English text, any other
 * value is returned unchanged.
 * @param value The manifest value.
 * @returns The resolved English text.
 */
export function resolveNls(value: string): string {
  const id = PLACEHOLDER.exec(value)?.[1];
  if (undefined === id) {
    return value;
  }
  const nls = readJson<Record<string, string>>('package.nls.json');
  return nls[id] ?? value;
}
/**
 * List every `%id%` placeholder found in the string values of a JSON tree.
 * @param node The JSON value to walk.
 * @returns The placeholder ids, in document order.
 */
export function collectPlaceholders(node: unknown): string[] {
  if ('string' === typeof node) {
    const id = PLACEHOLDER.exec(node)?.[1];
    return undefined === id ? [] : [id];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectPlaceholders(item));
  }
  if ('object' === typeof node && null !== node) {
    return Object.values(node).flatMap((item) => collectPlaceholders(item));
  }
  return [];
}
