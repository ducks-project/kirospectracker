import { expect } from 'chai';

import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SPEC_FILTER_KEYS } from '../../src/core/model/SpecFilterKey';
import { colorTokenForFilterKey, colorTokenForStatus } from '../../src/core/status/SpecStatusColor';

/**
 * Behaviour specification for the status-to-color mapping.
 */
describe('SpecStatusColor', () => {
  it('maps each filter key to a distinct color token', () => {
    const tokens = SPEC_FILTER_KEYS.map((key) => colorTokenForFilterKey(key));
    expect(tokens).to.deep.equal([
      'badge-completed',
      'badge-inProgress',
      'badge-notStarted',
      'badge-malformed',
    ]);
    expect(new Set(tokens).size).to.equal(tokens.length);
  });

  it('maps Completed and FullyCompleted to the same completed color as the toolbar', () => {
    expect(colorTokenForStatus(SpecStatus.Completed)).to.equal('badge-completed');
    expect(colorTokenForStatus(SpecStatus.FullyCompleted)).to.equal('badge-completed');
    expect(colorTokenForStatus(SpecStatus.Completed)).to.equal(colorTokenForFilterKey('completed'));
  });

  it('maps the remaining statuses to their own color', () => {
    expect(colorTokenForStatus(SpecStatus.InProgress)).to.equal('badge-inProgress');
    expect(colorTokenForStatus(SpecStatus.NotStarted)).to.equal('badge-notStarted');
    expect(colorTokenForStatus(SpecStatus.Malformed)).to.equal('badge-malformed');
  });
});
