import { expect } from 'chai';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildDashboardBundle } from '../helpers/dashboard-harness/dashboard-bundle';
import { DASHBOARD_SCENARIOS } from '../helpers/dashboard-harness/dashboard-scenarios';
import { runDashboardScenario } from '../helpers/dashboard-harness/run-dashboard-scenario';
import { describeFirstDifference } from '../helpers/dashboard-harness/snapshot-diff';
import { REPOSITORY_ROOT } from '../helpers/manifest-nls';

/** Directory holding one versioned reference file per scenario. */
const SNAPSHOT_DIRECTORY = join(REPOSITORY_ROOT, 'test/fixtures/dashboard-snapshot');
/** Environment variable that regenerates the references instead of comparing (never set in CI). */
const UPDATE_VARIABLE = 'UPDATE_DASHBOARD_SNAPSHOT';
/** Documentation file allowed next to the references. */
const README_FILE = 'README.md';
/** Whether this run rewrites the reference files. */
const UPDATING = '1' === process.env[UPDATE_VARIABLE];

/**
 * Path of the reference file of a scenario.
 * @param name Scenario name.
 * @returns The absolute path.
 */
function referencePath(name: string): string {
  return join(SNAPSHOT_DIRECTORY, `${name}.txt`);
}

/**
 * Replays the REAL dashboard bundle (`src/webview/main.ts` built by esbuild) in a
 * `node:vm` context against a hand-written fake DOM, and compares the serialised
 * DOM, posted messages and persisted state of each scenario with a versioned
 * reference. It is the permanent safety net for the wiring of the webview: a
 * refactor must leave every reference file untouched.
 *
 * To regenerate the references after an INTENDED behaviour change, run
 * `UPDATE_DASHBOARD_SNAPSHOT=1 npm run test:unit` and review the diff.
 */
describe('dashboard bundle in a fake DOM', () => {
  let bundle: string;

  before(async () => {
    bundle = await buildDashboardBundle();
  });

  DASHBOARD_SCENARIOS.forEach((scenario) => {
    it(`replays "${scenario.name}" as recorded`, () => {
      const actual = runDashboardScenario(bundle, scenario);
      const path = referencePath(scenario.name);
      if (UPDATING) {
        mkdirSync(SNAPSHOT_DIRECTORY, { recursive: true });
        writeFileSync(path, actual, 'utf8');
        return;
      }
      expect(existsSync(path), `missing reference ${path}; see the spec header`).to.equal(true);
      const difference = describeFirstDifference(readFileSync(path, 'utf8'), actual);
      expect(difference, `${scenario.name} differs from its reference.\n${difference}`).to.equal(
        undefined,
      );
    });
  });

  it('has no scenario name used twice', () => {
    const names = DASHBOARD_SCENARIOS.map((scenario) => scenario.name);
    expect(new Set(names).size).to.equal(names.length);
  });

  it('has no reference file without a scenario', () => {
    const expected = new Set([
      README_FILE,
      ...DASHBOARD_SCENARIOS.map((scenario) => `${scenario.name}.txt`),
    ]);
    const stale = readdirSync(SNAPSHOT_DIRECTORY).filter((file) => !expected.has(file));
    if (UPDATING) {
      stale.forEach((file) => unlinkSync(join(SNAPSHOT_DIRECTORY, file)));
      return;
    }
    expect(stale).to.deep.equal([]);
  });

  it('builds the bundle with the webview options of esbuild.mjs', () => {
    const script = readFileSync(join(REPOSITORY_ROOT, 'esbuild.mjs'), 'utf8');
    const webviewOptions = script.slice(script.indexOf('const webviewOptions'));
    [
      "entryPoints: ['src/webview/main.ts']",
      'bundle: true',
      "format: 'iife'",
      "platform: 'browser'",
      "target: 'es2021'",
      'minify: isProd',
      "loader: { '.css': 'css' }",
    ].forEach((option) => expect(webviewOptions).to.contain(option));
  });
});
