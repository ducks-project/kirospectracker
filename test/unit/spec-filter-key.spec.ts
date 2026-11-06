import { expect } from 'chai';

import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SPEC_FILTER_KEYS, statusToFilterKey } from '../../src/core/model/SpecFilterKey';

/**
 * Behaviour specification for the {@link statusToFilterKey} mapping.
 */
describe('statusToFilterKey', () => {
  it('maps Completed and FullyCompleted to the completed key', () => {
    expect(statusToFilterKey(SpecStatus.Completed)).to.equal('completed');
    expect(statusToFilterKey(SpecStatus.FullyCompleted)).to.equal('completed');
  });

  it('maps InProgress, NotStarted and Malformed to their own keys', () => {
    expect(statusToFilterKey(SpecStatus.InProgress)).to.equal('inProgress');
    expect(statusToFilterKey(SpecStatus.NotStarted)).to.equal('notStarted');
    expect(statusToFilterKey(SpecStatus.Malformed)).to.equal('malformed');
  });

  it('exposes the four filter keys in header display order', () => {
    expect(SPEC_FILTER_KEYS).to.deep.equal(['completed', 'inProgress', 'notStarted', 'malformed']);
  });
});
