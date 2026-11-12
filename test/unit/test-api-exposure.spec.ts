import { expect } from 'chai';
import { selectExportedApi } from '../../src/adapters/TestApiExposure';

/** Stand-in for the internal objects the real API carries. */
const INTERNALS = { repository: 'internal' };

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
