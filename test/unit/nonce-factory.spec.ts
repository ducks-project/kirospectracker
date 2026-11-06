import { expect } from 'chai';

import type { IRandomSource } from '../../src/core/ports/IRandomSource';
import { NonceFactory } from '../../src/core/NonceFactory';

/**
 * Deterministic random source cycling through a fixed sequence of integers.
 */
class SequenceRandomSource implements IRandomSource {
  private index = 0;

  private readonly sequence: readonly number[];

  public constructor(sequence: readonly number[]) {
    this.sequence = sequence;
  }

  public nextInt(max: number): number {
    const value = this.sequence[this.index % this.sequence.length] % max;
    this.index += 1;
    return value;
  }
}

/**
 * Behaviour specification for {@link NonceFactory}.
 */
describe('NonceFactory', () => {
  it('produces a nonce of the configured length', () => {
    const factory = new NonceFactory(new SequenceRandomSource([0]), 16);
    expect(factory.create()).to.have.length(16);
  });

  it('only uses CSP-safe alphanumeric characters', () => {
    const factory = new NonceFactory(new SequenceRandomSource([1, 2, 3, 61]), 24);
    expect(factory.create()).to.match(/^[A-Za-z0-9]+$/);
  });

  it('is deterministic for a deterministic source', () => {
    const first = new NonceFactory(new SequenceRandomSource([5, 6, 7]), 8).create();
    const second = new NonceFactory(new SequenceRandomSource([5, 6, 7]), 8).create();
    expect(first).to.equal(second);
  });
});
