import { expect } from 'chai';
import { ExcludeReconciler } from '../../src/core/hiding/ExcludeReconciler';

describe('ExcludeReconciler', () => {
  const reconciler = new ExcludeReconciler();

  it('adds absent keys and takes ownership', () => {
    const result = reconciler.reconcile({ '**/.git': true }, [], ['b', 'a']);
    expect(result.changed).to.equal(true);
    expect(result.value).to.deep.equal({ '**/.git': true, a: true, b: true });
    expect(result.owned).to.deep.equal(['a', 'b']);
  });

  it('never touches a key already present, whatever its value', () => {
    const result = reconciler.reconcile({ a: false, b: true }, [], ['a', 'b']);
    expect(result.changed).to.equal(false);
    expect(result.value).to.deep.equal({ a: false, b: true });
    expect(result.owned).to.deep.equal([]);
  });

  it('removes only owned keys that became undesired', () => {
    const result = reconciler.reconcile({ mine: true, theirs: true }, ['mine'], []);
    expect(result.value).to.deep.equal({ theirs: true });
    expect(result.owned).to.deep.equal([]);
    expect(result.removed).to.deep.equal(['mine']);
  });

  it('removes the setting entirely when it becomes empty', () => {
    const result = reconciler.reconcile({ mine: true }, ['mine'], []);
    expect(result.changed).to.equal(true);
    expect(result.value).to.equal(undefined);
  });

  it('releases an owned key the user edited without rewriting', () => {
    const result = reconciler.reconcile({ mine: false }, ['mine'], []);
    expect(result.changed).to.equal(false);
    expect(result.owned).to.deep.equal([]);
  });

  it('releases an unwanted owned key the user deleted and does not re-add over a user edit', () => {
    const deleted = reconciler.reconcile({}, ['mine'], []);
    expect(deleted.changed).to.equal(false);
    expect(deleted.owned).to.deep.equal([]);
    expect(deleted.withdrawn).to.deep.equal([]);
    const edited = reconciler.reconcile({ mine: false }, ['mine'], ['mine']);
    expect(edited.changed).to.equal(false);
    expect(edited.owned).to.deep.equal([]);
  });

  it('remembers a still-desired key the user deleted and does not rewrite it', () => {
    const result = reconciler.reconcile({ other: true }, ['mine'], ['mine']);
    expect(result.changed).to.equal(false);
    expect(result.owned).to.deep.equal([]);
    expect(result.withdrawn).to.deep.equal(['mine']);
  });
  it('keeps not rewriting a withdrawn key while it stays desired', () => {
    const result = reconciler.reconcile(undefined, [], ['mine'], ['mine']);
    expect(result.changed).to.equal(false);
    expect(result.withdrawn).to.deep.equal(['mine']);
  });
  it("remembers a key edited to false, and keeps it the user's", () => {
    const result = reconciler.reconcile({ mine: false }, ['mine'], ['mine']);
    expect(result.changed).to.equal(false);
    expect(result.value).to.deep.equal({ mine: false });
    expect(result.withdrawn).to.deep.equal(['mine']);
  });
  it('forgets a withdrawal once the key is no longer desired, then rewrites it', () => {
    const forgotten = reconciler.reconcile(undefined, [], [], ['mine']);
    expect(forgotten.withdrawn).to.deep.equal([]);
    const again = reconciler.reconcile(undefined, [], ['mine'], forgotten.withdrawn);
    expect(again.value).to.deep.equal({ mine: true });
    expect(again.owned).to.deep.equal(['mine']);
  });
  it('is idempotent once in sync', () => {
    const first = reconciler.reconcile(undefined, [], ['a']);
    const second = reconciler.reconcile(first.value, first.owned, ['a']);
    expect(second.changed).to.equal(false);
    expect(second.value).to.deep.equal(first.value);
    expect(second.owned).to.deep.equal(['a']);
  });

  it('does not mutate its inputs', () => {
    const current = Object.freeze({ a: true });
    const owned = Object.freeze(['a']);
    expect(() => reconciler.reconcile(current, owned, ['b'])).to.not.throw();
  });
});
