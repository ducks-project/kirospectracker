import { expect } from 'chai';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { selectExportedApi } from '../../src/adapters/TestApiExposure';

/** Stand-in for the internal objects the real API carries. */
const INTERNALS = { repository: 'internal' };

/** Source of the composition root whose `activate` decides what is exported. */
const EXTENSION_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../src/extension.ts');

/** Every call of the exposure rule (the import and JSDoc links have no parenthesis). */
const RULE_CALL = /\bselectExportedApi\(/g;

/** The one call allowed: gated on the host's real extension mode. */
const GUARDED_CALL =
  /\bselectExportedApi\(\s*vscode\.ExtensionMode\.Test === context\.extensionMode\s*,/;

describe('selectExportedApi', () => {
  it('returns the API in test mode', () => {
    expect(selectExportedApi(true, () => INTERNALS)).to.equal(INTERNALS);
  });
  it('returns nothing outside test mode (production and development)', () => {
    expect(selectExportedApi(false, () => INTERNALS)).to.equal(undefined);
  });
  it('does not even build the API outside test mode', () => {
    let built = false;
    selectExportedApi(false, () => {
      built = true;
      return INTERNALS;
    });
    expect(built).to.equal(false);
  });
});

/**
 * Source-level guard on the call site in `activate`. The integration harness
 * always runs in `ExtensionMode.Test`, so no runtime test can observe a
 * production build; without this check, replacing the mode condition by `true`
 * would silently re-export the internals to every installed extension.
 */
describe('activate export guard (source)', () => {
  const source = readFileSync(EXTENSION_PATH, 'utf8');

  it('calls the exposure rule exactly once', () => {
    expect(source.match(RULE_CALL) ?? []).to.have.length(1);
  });

  it('gates that call on the real extension mode being Test', () => {
    expect(GUARDED_CALL.test(source)).to.equal(true);
  });
});
