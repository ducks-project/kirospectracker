// Build-time guard enforcing that the browser bundle contains no Node.js
// built-in reference (Requirements 1.2 and 1.3). It is an esbuild plugin that
// hooks `onResolve` and rejects any import whose specifier is a Node built-in
// (either a `node:`-prefixed name or its bare equivalent such as `fs`, `path`,
// `os`, `crypto`, `util`). On a match it returns an esbuild error naming the
// offending built-in, which makes `esbuild.build(...)` reject and the build
// process exit non-zero.

/**
 * @typedef {object} INodeBuiltinGuardOptions
 * @property {ReadonlySet<string>} forbidden Built-in module names rejected
 *   during resolution.
 */

/**
 * Bare Node.js built-in module names forbidden in the browser bundle. The
 * `node:`-prefixed form of each name is derived from this set, so both the
 * bare (`fs`) and prefixed (`node:fs`) specifiers are rejected.
 * @type {ReadonlySet<string>}
 */
const DEFAULT_FORBIDDEN_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]);

/** Prefix identifying the explicit Node.js built-in protocol. */
const NODE_PROTOCOL_PREFIX = 'node:';

/** Namespace used to tag resolve requests handled by this guard. */
const GUARD_NAMESPACE = 'node-builtin-guard';

/**
 * Build the default forbidden set: every bare built-in name plus its
 * `node:`-prefixed equivalent.
 * @returns {ReadonlySet<string>} The default set of forbidden specifiers.
 */
export function defaultForbiddenBuiltins() {
  const forbidden = new Set();
  DEFAULT_FORBIDDEN_BUILTINS.forEach((name) => {
    forbidden.add(name);
    forbidden.add(`${NODE_PROTOCOL_PREFIX}${name}`);
  });
  return forbidden;
}

/**
 * Normalise a specifier to the bare built-in name it references, stripping the
 * `node:` protocol prefix when present. Any `node:`-prefixed specifier is
 * always treated as a built-in reference even if its bare name is unknown.
 * @param {string} specifier The import specifier to inspect.
 * @param {ReadonlySet<string>} forbidden The forbidden specifier set.
 * @returns {string | undefined} The offending built-in name, or `undefined`.
 */
function matchForbiddenBuiltin(specifier, forbidden) {
  if (forbidden.has(specifier)) {
    return specifier;
  }
  if (specifier.startsWith(NODE_PROTOCOL_PREFIX)) {
    return specifier;
  }
  return undefined;
}

/**
 * Create the esbuild plugin forbidding any Node.js built-in in the browser
 * bundle. Register it only on the browser target.
 * @param {INodeBuiltinGuardOptions} [options] Guard options; defaults to the
 *   full set of Node built-ins when omitted.
 * @returns {import('esbuild').Plugin} The esbuild plugin.
 */
export function nodeBuiltinGuard(options) {
  const forbidden = options?.forbidden ?? defaultForbiddenBuiltins();

  return {
    name: GUARD_NAMESPACE,
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const offending = matchForbiddenBuiltin(args.path, forbidden);
        if (undefined === offending) {
          return undefined;
        }
        return {
          errors: [
            {
              text:
                `Node.js built-in "${offending}" is forbidden in the browser ` +
                `bundle (imported from ${args.importer || 'entry point'}).`,
            },
          ],
        };
      });
    },
  };
}
