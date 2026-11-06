import { expect } from 'chai';

import type { ISpecDocuments } from '../../src/core/model/ISpecDocuments';
import type { ISpecProgress } from '../../src/core/model/ISpecProgress';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';

/** All documents present. */
const ALL_DOCS: ISpecDocuments = { tasks: true, requirements: true, design: true, notes: true };

/**
 * Build a progress value object from counts, deriving the ratios.
 * @param requiredDone Done required leaves.
 * @param requiredTotal Total required leaves.
 * @param optionalDone Done optional leaves.
 * @param optionalTotal Total optional leaves.
 * @returns The progress value object.
 */
function progress(
  requiredDone: number,
  requiredTotal: number,
  optionalDone: number,
  optionalTotal: number,
): ISpecProgress {
  return {
    requiredDone,
    requiredTotal,
    optionalDone,
    optionalTotal,
    requiredRatio: 0 === requiredTotal ? 1 : requiredDone / requiredTotal,
    optionalRatio: 0 === optionalTotal ? 0 : optionalDone / optionalTotal,
  };
}

/**
 * Behaviour specification for {@link SpecStatusResolver}.
 */
describe('SpecStatusResolver', () => {
  const resolver = new SpecStatusResolver(new TasksOnlyDocumentPolicy());

  it('resolves Malformed when tasks.md is absent', () => {
    const docs: ISpecDocuments = { ...ALL_DOCS, tasks: false };
    expect(resolver.resolve(docs, progress(0, 0, 0, 0))).to.equal(SpecStatus.Malformed);
  });

  it('resolves NotStarted when tasks.md is present and nothing is done', () => {
    expect(resolver.resolve(ALL_DOCS, progress(0, 3, 0, 1))).to.equal(SpecStatus.NotStarted);
  });

  it('resolves NotStarted when there is no task at all', () => {
    expect(resolver.resolve(ALL_DOCS, progress(0, 0, 0, 0))).to.equal(SpecStatus.NotStarted);
  });

  it('resolves InProgress when some but not all required tasks are done', () => {
    expect(resolver.resolve(ALL_DOCS, progress(1, 3, 0, 0))).to.equal(SpecStatus.InProgress);
  });

  it('resolves Completed when all required are done but optionals remain', () => {
    expect(resolver.resolve(ALL_DOCS, progress(3, 3, 0, 2))).to.equal(SpecStatus.Completed);
  });

  it('resolves FullyCompleted when every required and optional task is done', () => {
    expect(resolver.resolve(ALL_DOCS, progress(3, 3, 2, 2))).to.equal(SpecStatus.FullyCompleted);
  });

  it('resolves FullyCompleted when all required are done and there are no optionals', () => {
    // With no optional task, the optional set is trivially fully done.
    expect(resolver.resolve(ALL_DOCS, progress(3, 3, 0, 0))).to.equal(SpecStatus.FullyCompleted);
  });

  it('honours a stricter policy that also requires design.md', () => {
    const strict = new SpecStatusResolver(new TasksOnlyDocumentPolicy(['tasks', 'design']));
    const docs: ISpecDocuments = { ...ALL_DOCS, design: false };
    expect(strict.resolve(docs, progress(1, 2, 0, 0))).to.equal(SpecStatus.Malformed);
  });
});
