import { expect } from 'chai';

import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecStatusFilter } from '../../src/core/status/SpecStatusFilter';

/**
 * Behaviour specification for {@link SpecStatusFilter}.
 *
 * These cases capture the additive, multi-select toggle contract and the
 * inclusive matching rule (empty filter shows everything; otherwise a status is
 * visible when its filter key is active).
 */
describe('SpecStatusFilter', () => {
  it('shows everything when no key is active', () => {
    const filter = new SpecStatusFilter();
    expect(filter.isEmpty()).to.equal(true);
    expect(filter.matches(SpecStatus.Completed)).to.equal(true);
    expect(filter.matches(SpecStatus.Malformed)).to.equal(true);
  });

  it('activates a key on first toggle and narrows to it', () => {
    const filter = new SpecStatusFilter().toggle('completed');
    expect(filter.isActive('completed')).to.equal(true);
    expect(filter.matches(SpecStatus.Completed)).to.equal(true);
    expect(filter.matches(SpecStatus.FullyCompleted)).to.equal(true);
    expect(filter.matches(SpecStatus.InProgress)).to.equal(false);
  });

  it('is additive across multiple keys', () => {
    const filter = new SpecStatusFilter().toggle('completed').toggle('inProgress');
    expect(filter.matches(SpecStatus.Completed)).to.equal(true);
    expect(filter.matches(SpecStatus.InProgress)).to.equal(true);
    expect(filter.matches(SpecStatus.NotStarted)).to.equal(false);
  });

  it('removes a key when toggled again', () => {
    const filter = new SpecStatusFilter().toggle('malformed').toggle('malformed');
    expect(filter.isActive('malformed')).to.equal(false);
    expect(filter.isEmpty()).to.equal(true);
  });

  it('is immutable: a toggle returns a new instance and leaves the original intact', () => {
    const base = new SpecStatusFilter();
    const next = base.toggle('notStarted');
    expect(base.isActive('notStarted')).to.equal(false);
    expect(next.isActive('notStarted')).to.equal(true);
    expect(next).to.not.equal(base);
  });

  it('round-trips through toArray', () => {
    const filter = new SpecStatusFilter().toggle('completed').toggle('notStarted');
    const restored = new SpecStatusFilter(filter.toArray());
    expect(restored.isActive('completed')).to.equal(true);
    expect(restored.isActive('notStarted')).to.equal(true);
    expect(restored.isActive('malformed')).to.equal(false);
  });

  it('drops invalid keys when restored from unknown persisted state', () => {
    const filter = SpecStatusFilter.fromUnknown(['completed', 'bogus', 42, null, 'malformed']);
    expect(filter.isActive('completed')).to.equal(true);
    expect(filter.isActive('malformed')).to.equal(true);
    expect(filter.toArray()).to.have.length(2);
  });
});
