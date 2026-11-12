import * as esbuild from 'esbuild';
import { REPOSITORY_ROOT } from '../manifest-nls';

/**
 * Build the REAL dashboard bundle in memory, with the same options as
 * `webviewOptions` in `esbuild.mjs` (production: minified IIFE, browser platform,
 * ES2021). Nothing is written to disk. A spec guards against drift between the
 * two configurations.
 * @returns The bundle source.
 */
export async function buildDashboardBundle(): Promise<string> {
  const result = await esbuild.build({
    absWorkingDir: REPOSITORY_ROOT,
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2021',
    outfile: 'media/dashboard.js',
    minify: true,
    sourcemap: false,
    loader: { '.css': 'css' },
    write: false,
    logLevel: 'silent',
  });
  const [output] = result.outputFiles;
  if (1 !== result.outputFiles.length) {
    throw new Error(`Expected one bundle file, got ${result.outputFiles.length}`);
  }
  return output.text;
}
