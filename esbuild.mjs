// Build script for the extension. esbuild handles the bundling; tsc is used only
// for type-checking (`npm run compile`). Two targets are produced: a node target
// (primary `main` entry point) and a browser target (web extension `browser`
// entry point). Both are declared in package.json, so both must exist for vsce
// to package the extension.
//
// Usage:
//   node esbuild.mjs            production build of BOTH targets (node + browser)
//   node esbuild.mjs --dev      development build of both targets (sourcemaps, no minify)
//   node esbuild.mjs --prod     explicit production build of both targets (minified)
//   node esbuild.mjs --watch    rebuild the node target on change
//   node esbuild.mjs --browser  build only the browser target

import * as esbuild from 'esbuild';
import { nodeBuiltinGuard } from './src/build/nodeBuiltinGuard.mjs';
import { assertBrowserBundleHasNoNodeBuiltins } from './src/build/nodeBuiltinScan.mjs';

const args = process.argv.slice(2);
const isWatch = args.includes('--watch');
const isDev = args.includes('--dev');
const isBrowser = args.includes('--browser');
// Builds only the Web_Extension_Host test suite consumed by `@vscode/test-web`.
const isWebTest = args.includes('--web-test');
// Production unless an explicit dev/watch flag is passed.
const isProd = args.includes('--prod') || (!isDev && !isWatch);

/**
 * Base build options shared by every target. `vscode` is always external: it is
 * provided by the host at runtime and must never be bundled.
 * @type {import('esbuild').BuildOptions}
 */
const baseOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  logLevel: 'info',
};

/**
 * Node target options (primary). Platform node, CommonJS, targets the VS Code
 * bundled Node runtime.
 * @type {import('esbuild').BuildOptions}
 */
const nodeOptions = {
  ...baseOptions,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/node/extension.js',
  sourcemap: !isProd,
  minify: isProd,
};

/**
 * Browser target options (web extension). The core is pure and imports no Node
 * builtin, so the browser bundle needs no polyfill/shim; `vscode` stays external.
 * @type {import('esbuild').BuildOptions}
 */
const browserOptions = {
  ...baseOptions,
  platform: 'browser',
  // CommonJS, not IIFE: VS Code's Web_Extension_Host loads the `browser` entry as
  // a CommonJS module and calls its exported `activate`. `format: 'cjs'` emits a
  // real `module.exports` the host can read, matching the official VS Code web
  // extension guidance (esbuild `format: 'cjs'` / webpack `libraryTarget:
  // 'commonjs'`). A bare IIFE would keep `activate`/`deactivate` trapped in its
  // closure, so the host could never activate the extension (Req 1.1, 7.2).
  format: 'cjs',
  target: 'es2021',
  outfile: 'dist/browser/extension.js',
  sourcemap: !isProd,
  minify: isProd,
  // Fail the build if any Node.js built-in reaches the browser bundle (Req 1.2, 1.3).
  plugins: [nodeBuiltinGuard()],
};

/**
 * Web_Extension_Host test suite options (`@vscode/test-web`). This bundles the
 * web host entry point (`test/web/index.ts`) plus the shared host-agnostic
 * assertions and Mocha's browser build into a single CommonJS module that the
 * browser Web Worker loads through `--extensionTestsPath`. Like the extension's
 * browser target it is a browser-platform bundle with `vscode` external, so it
 * never pulls in a Node runtime; unlike the extension bundle it is a test-only
 * artifact and is therefore NOT subject to the `nodeBuiltinGuard` plugin, which
 * guards the shipped `dist/browser/extension.js` only (Requirements 1.2, 1.3).
 * @type {import('esbuild').BuildOptions}
 */
const webTestOptions = {
  ...baseOptions,
  entryPoints: ['test/web/index.ts'],
  platform: 'browser',
  // CommonJS, for the same reason as the browser target: `@vscode/test-web`
  // loads the module referenced by `--extensionTestsPath` and invokes its
  // exported `run()`. `format: 'cjs'` emits a real `module.exports` the harness
  // can read, so no global-name/footer bridge is needed.
  format: 'cjs',
  target: 'es2021',
  outfile: 'dist/web-test/suite/index.js',
  sourcemap: !isProd,
  minify: false,
};

/**
 * Build the browser target and run the secondary post-build scan over the
 * emitted bundle. The `nodeBuiltinGuard` plugin is the primary guard (it rejects
 * Node built-ins at resolution time); the scan is a cheap secondary assertion on
 * the final artifact that exits non-zero if any built-in reference survived
 * (Requirements 1.2, 1.3).
 * @returns {Promise<void>} Resolves once the browser bundle is built and scanned.
 */
async function buildBrowserTarget() {
  await esbuild.build(browserOptions);
  await assertBrowserBundleHasNoNodeBuiltins(browserOptions.outfile);
}

if (isWatch) {
  // Watch mode rebuilds only the node target for a fast dev loop.
  const context = await esbuild.context(nodeOptions);
  await context.watch();
} else if (isWebTest) {
  // Explicit single build of the Web_Extension_Host test suite.
  await esbuild.build(webTestOptions);
} else if (isBrowser) {
  // Explicit single browser build.
  await buildBrowserTarget();
} else {
  // Default/dev/prod: build BOTH declared entry points so the package is complete.
  await Promise.all([esbuild.build(nodeOptions), buildBrowserTarget()]);
}
