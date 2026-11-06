import { expect } from 'chai';

import type { ISpecProgress } from '../../src/core/model/ISpecProgress';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecDecorationMapper } from '../../src/core/status/SpecDecorationMapper';

/** Progress fixture: 8/8 required done, 2/3 optional done. */
const PROGRESS: ISpecProgress = {
  requiredDone: 8,
  requiredTotal: 8,
  optionalDone: 2,
  optionalTotal: 3,
  requiredRatio: 1,
  optionalRatio: 2 / 3,
};

/**
 * Behaviour specification for {@link SpecDecorationMapper}.
 */
describe('SpecDecorationMapper', () => {
  const mapper = new SpecDecorationMapper();

  it('uses an error badge and color for a malformed spec', () => {
    const decoration = mapper.map(SpecStatus.Malformed, PROGRESS);
    expect(decoration.badge).to.equal('!');
    expect(decoration.color).to.equal('error');
  });

  it('uses a muted circle for a not-started spec', () => {
    const decoration = mapper.map(SpecStatus.NotStarted, PROGRESS);
    expect(decoration.color).to.equal('muted');
  });

  it('uses a warn tilde for an in-progress spec', () => {
    const decoration = mapper.map(SpecStatus.InProgress, PROGRESS);
    expect(decoration.badge).to.equal('~');
    expect(decoration.color).to.equal('warn');
  });

  it('uses a vivid-ok color for a fully-completed spec', () => {
    const decoration = mapper.map(SpecStatus.FullyCompleted, PROGRESS);
    expect(decoration.badge).to.equal('✓');
    expect(decoration.color).to.equal('okVivid');
  });

  it('keeps the badge at most two characters', () => {
    const decoration = mapper.map(SpecStatus.Completed, PROGRESS);
    expect(decoration.badge.length).to.be.at.most(2);
  });

  it('states the status and required/optional progress in the tooltip', () => {
    const decoration = mapper.map(SpecStatus.Completed, PROGRESS);
    expect(decoration.tooltip).to.contain('Completed');
    expect(decoration.tooltip).to.contain('8/8 required (100%)');
    expect(decoration.tooltip).to.contain('2/3 optional');
  });
});
