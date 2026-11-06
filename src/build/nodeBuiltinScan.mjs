// Secondary post-build scan enforcing that the emitted browser bundle contains
// no Node.js built-in reference (Requirements 1.2 and 1.3). This is a cheap
// assertion that complements the esbuild `nodeBuiltinGuard` plugin: the plugin
// remains the primary guard (it rejects built-ins at resolution time), while
// this scan inspects the final `dist/browser/extension.js` text and fails
// non-zero if any recognisable Node built-in reference survived into the bundle
// (for example a `require("fs")` call, a `node:`-prefixed specifier, or a bare
// `import ... from "path"`). Running against the emitted artifact catches cases
// the resolver cannot see, such as a built-in reinjected by a dependency or a
// dynamic specifier.

import { readFile } from 'node:fs/promises';

import { defaultForbiddenBuiltins } from './nodeBuiltinGuard.mjs';

/** Prefix identifying the explicit Node.js built-in protocol. */
const NODE_PROTOCOL_PREFIX = 'node:';

/** Process exit code used when the scan detects a forbidden reference. */
const SCAN_FAILURE_EXIT_CODE = 1;

/**
 * @typedef {object} INodeBuiltinScanMatch
 * @property {string} builtin The forbidden Node built-in name that was found.
 * @property {string} snippet The surrounding source text for the match.
 */

/**
 * Build the set of bare Node built-in names (without the `node:` prefix) used to
 * detect `require("fs")` / `import ... from "path"` style references. Derived
 * from the guard's shared forbidden set so both layers stay in sync.
 * @returns {ReadonlySet<string>} The bare built-in names.
 */
function bareBuiltinNames() {
  const bare = new Set();
  defaultForbiddenBuiltins().forEach((name) => {
    if (!name.startsWith(NODE_PROTOCOL_PREFIX)) {
      bare.add(name);
    }
  });
  return bare;
}

/**
 * Escape a string for safe inclusion in a regular expression source.
 * @param {string} value The raw string to escape.
 * @returns {string} The escaped string.
 */
function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract a short context snippet around an index for human-readable reporting.
 * @param {string} source The full bundle source.
 * @param {number} index The match index within the source.
 * @returns {string} A single-line snippet surrounding the match.
 */
function snippetAround(source, index) {
  const CONTEXT_RADIUS = 40;
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = Math.min(source.length, index + CONTEXT_RADIUS);
  return source.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Scan bundle source text for Node built-in references. Detects any
 * `node:`-prefixed specifier, and any bare built-in referenced through a
 * `require(...)` call or an `import`/`export ... from` specifier.
 * @param {string} source The bundle source text to inspect.
 * @returns {INodeBuiltinScanMatch[]} Every detected forbidden reference.
 */
export function scanSourceForNodeBuiltins(source) {
  /** @type {INodeBuiltinScanMatch[]} */
  const matches = [];

  // Any `node:`-prefixed specifier is a built-in reference regardless of name.
  const protocolPattern = /(['"])node:[\w/.-]+\1/g;
  for (
    let found = protocolPattern.exec(source);
    null !== found;
    found = protocolPattern.exec(source)
  ) {
    matches.push({
      builtin: found[0].slice(1, -1),
      snippet: snippetAround(source, found.index),
    });
  }

  // Bare built-ins only count when used as a module specifier, to avoid false
  // positives on unrelated identifiers that merely share a built-in's name.
  // Each specifier form gets its own named capture group so the single combined
  // pattern stays valid (a regex may not reuse one capture name across
  // alternation branches); whichever branch matches is the one that populated
  // its group. A quote character class (rather than a backreference) keeps the
  // group boundaries stable across the alternation.
  const bareNames = Array.from(bareBuiltinNames()).map(escapeForRegExp).join('|');
  const barePattern = new RegExp(
    `require\\(\\s*['"](?<builtinRequire>${bareNames})['"]` +
      `|\\bfrom\\s*['"](?<builtinFrom>${bareNames})['"]` +
      `|\\bimport\\(\\s*['"](?<builtinImport>${bareNames})['"]`,
    'g',
  );
  for (let found = barePattern.exec(source); null !== found; found = barePattern.exec(source)) {
    const { builtinRequire, builtinFrom, builtinImport } = found.groups;
    const builtin = builtinRequire ?? builtinFrom ?? builtinImport;
    matches.push({
      builtin,
      snippet: snippetAround(source, found.index),
    });
  }

  return matches;
}

/**
 * Read the emitted browser bundle and assert it contains no Node built-in
 * reference. On any match, print an error naming each offending built-in and
 * exit the process non-zero; otherwise return silently.
 * @param {string} bundlePath Path to the emitted browser bundle.
 * @returns {Promise<void>} Resolves when the bundle is clean.
 */
export async function assertBrowserBundleHasNoNodeBuiltins(bundlePath) {
  const source = await readFile(bundlePath, 'utf8');
  const matches = scanSourceForNodeBuiltins(source);

  if (0 === matches.length) {
    return;
  }

  // eslint-disable-next-line no-console
  console.error(
    `Node.js built-in reference(s) found in the browser bundle "${bundlePath}" ` +
      '(secondary post-build scan):',
  );
  matches.forEach(({ builtin, snippet }) => {
    // eslint-disable-next-line no-console
    console.error(`  - "${builtin}" near: ${snippet}`);
  });
  process.exit(SCAN_FAILURE_EXIT_CODE);
}
