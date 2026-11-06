import { expect } from 'chai';

import { TasksMetaReader } from '../../src/core/parsing/TasksMetaReader';

/**
 * Behaviour specification for {@link TasksMetaReader}.
 *
 * The reader is tolerant: it never throws and degrades to an empty meta on
 * absent or invalid JSON, keeping progress computation independent of this
 * secondary signal.
 */
describe('TasksMetaReader', () => {
  const reader = new TasksMetaReader();

  it('returns an empty meta when the file is absent', () => {
    const meta = reader.read(undefined);
    expect(meta.pbtResults).to.deep.equal({});
    expect(meta.executionHistory).to.deep.equal({});
  });

  it('returns an empty meta on invalid JSON without throwing', () => {
    expect(() => reader.read('{ not json')).to.not.throw();
    expect(reader.read('{ not json').pbtResults).to.deep.equal({});
  });

  it('returns an empty meta when the JSON root is not an object', () => {
    expect(reader.read('42').executionHistory).to.deep.equal({});
  });

  it('reads pbtResults entries, keeping recognised fields', () => {
    const json = JSON.stringify({
      pbtResults: { '1. Parse': { status: 'passed', lastRunTimestamp: 123 } },
    });
    const meta = reader.read(json);
    expect(meta.pbtResults['1. Parse'].status).to.equal('passed');
    expect(meta.pbtResults['1. Parse'].lastRunTimestamp).to.equal(123);
  });

  it('reads executionHistory arrays tolerantly', () => {
    const json = JSON.stringify({
      executionHistory: { '2. Build': [{ executionId: 'e1', timestamp: 9 }] },
    });
    const meta = reader.read(json);
    expect(meta.executionHistory['2. Build']).to.have.length(1);
    expect(meta.executionHistory['2. Build'][0].executionId).to.equal('e1');
  });

  it('drops fields of the wrong type instead of failing', () => {
    const json = JSON.stringify({ pbtResults: { '1': { status: 42, lastRunTimestamp: 'nope' } } });
    const meta = reader.read(json);
    expect(meta.pbtResults['1'].status).to.equal(undefined);
    expect(meta.pbtResults['1'].lastRunTimestamp).to.equal(undefined);
  });
});
