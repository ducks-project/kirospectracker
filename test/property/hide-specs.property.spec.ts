import { expect } from 'chai';
import * as fc from 'fast-check';
import { ExcludeReconciler, type ExcludeValue } from '../../src/core/hiding/ExcludeReconciler';
import { HiddenSpecSelector } from '../../src/core/hiding/HiddenSpecSelector';
import { SpecExcludeGlob } from '../../src/core/hiding/SpecExcludeGlob';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { buildSnapshot } from '../helpers/spec-snapshot-builder';
import { vscodeGlobMatches } from '../helpers/vscode-glob-oracle';

/** Characters stressing the glob engine, mixed with plain ones. */
const NAME_CHARS = [..."ab-_. *?[]{}()!,^#é'"];
const nameArb = fc
  .array(fc.constantFrom(...NAME_CHARS), { minLength: 1, maxLength: 8 })
  .map((c) => c.join(''));
const keyArb = fc.constantFrom('k1', 'k2', 'k3', 'k4', 'k5');
const keysArb = fc.uniqueArray(keyArb);
const currentArb = fc
  .dictionary(keyArb, fc.boolean())
  .map((value): ExcludeValue | undefined => (0 === Object.keys(value).length ? undefined : value));
const statusArb = fc.constantFrom(...Object.values(SpecStatus));

describe('SpecExcludeGlob (properties)', () => {
  const glob = new SpecExcludeGlob();

  it('every supported name yields a glob matching exactly its folder and files', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const built = glob.build(name);
        fc.pre(undefined !== built);
        const pattern = built as string;
        expect(vscodeGlobMatches(pattern, `/w/.kiro/specs/${name}`)).to.equal(true);
        expect(vscodeGlobMatches(pattern, `/w/.kiro/specs/${name}/design.md`)).to.equal(true);
        expect(vscodeGlobMatches(pattern, `/w/.kiro/specs/${name}x`)).to.equal(false);
        expect(vscodeGlobMatches(pattern, `/w/.kiro/specs/x${name}/a.md`)).to.equal(false);
        expect(vscodeGlobMatches(pattern, '/w/.kiro/specs')).to.equal(false);
      }),
      { numRuns: 500 },
    );
  });

  it('rejects exactly the names it cannot write reliably', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        expect(undefined === glob.build(name)).to.equal(
          name.includes('{') || name !== name.trimEnd(),
        );
      }),
    );
  });
});

describe('ExcludeReconciler (properties)', () => {
  const reconciler = new ExcludeReconciler();

  it('never alters or removes a key the extension does not own', () => {
    fc.assert(
      fc.property(currentArb, keysArb, keysArb, (current, owned, desired) => {
        const result = reconciler.reconcile(current, owned, desired);
        const next = result.value ?? {};
        Object.entries(current ?? {}).forEach(([key, value]) => {
          const mine = owned.includes(key) && true === value;
          if (!mine) {
            expect(next[key], key).to.equal(value);
          }
        });
      }),
    );
  });

  it('is idempotent: reconciling its own output changes nothing', () => {
    fc.assert(
      fc.property(currentArb, keysArb, keysArb, (current, owned, desired) => {
        const first = reconciler.reconcile(current, owned, desired);
        const second = reconciler.reconcile(first.value, first.owned, desired, first.withdrawn);
        expect(second.changed).to.equal(false);
        expect(second.owned).to.have.members([...first.owned]);
      }),
    );
  });

  it('only owns keys that are present and true after the write', () => {
    fc.assert(
      fc.property(currentArb, keysArb, keysArb, (current, owned, desired) => {
        const result = reconciler.reconcile(current, owned, desired);
        result.owned.forEach((key) => {
          expect((result.value ?? current ?? {})[key]).to.equal(true);
        });
      }),
    );
  });

  it('ends with every desired key present, unless the user holds it otherwise', () => {
    fc.assert(
      fc.property(currentArb, keysArb, keysArb, (current, owned, desired) => {
        const result = reconciler.reconcile(current, owned, desired);
        const next = result.value ?? {};
        desired.forEach((key) => {
          const lost = result.withdrawn.includes(key);
          expect(key in next || lost || key in (current ?? {})).to.equal(true);
        });
      }),
    );
  });

  it('resetting (desired = none) leaves only keys the user holds', () => {
    fc.assert(
      fc.property(currentArb, keysArb, (current, owned) => {
        const result = reconciler.reconcile(current, owned, []);
        const next = result.value ?? {};
        owned.forEach((key) => {
          if (true === (current ?? {})[key]) {
            expect(key in next).to.equal(false);
          }
        });
        expect(result.owned).to.deep.equal([]);
      }),
    );
  });
});

describe('ExcludeReconciler withdrawal (properties)', () => {
  const reconciler = new ExcludeReconciler();
  it('never rewrites a key the user removed while it stays desired; rewrites after a cycle', () => {
    fc.assert(
      fc.property(keysArb, (desired) => {
        const first = reconciler.reconcile(undefined, [], desired);
        // The user deletes every key we wrote.
        const afterUser = reconciler.reconcile(undefined, first.owned, desired, first.withdrawn);
        expect(afterUser.changed).to.equal(false);
        expect(afterUser.owned).to.deep.equal([]);
        // Later runs, still desired: never rewritten.
        const later = reconciler.reconcile(
          undefined,
          afterUser.owned,
          desired,
          afterUser.withdrawn,
        );
        expect(later.changed).to.equal(false);
        // Unhide, then hide again: written normally.
        const unhidden = reconciler.reconcile(undefined, later.owned, [], later.withdrawn);
        expect(unhidden.withdrawn).to.deep.equal([]);
        const rehidden = reconciler.reconcile(
          undefined,
          unhidden.owned,
          desired,
          unhidden.withdrawn,
        );
        expect(Object.keys(rehidden.value ?? {}).sort()).to.deep.equal([...desired].sort());
      }),
    );
  });
  it('only remembers desired keys and never touches the user value because of it', () => {
    fc.assert(
      fc.property(currentArb, keysArb, keysArb, keysArb, (current, owned, desired, withdrawn) => {
        const result = reconciler.reconcile(current, owned, desired, withdrawn);
        result.withdrawn.forEach((key) => expect(desired).to.include(key));
        result.added.forEach((key) => expect(withdrawn).to.not.include(key));
        const next = result.value ?? {};
        Object.entries(current ?? {}).forEach(([key, value]) => {
          if (false === value) {
            expect(next[key], key).to.equal(false);
          }
        });
      }),
    );
  });
});
describe('HiddenSpecSelector (properties)', () => {
  const selector = new HiddenSpecSelector();

  it('selects exactly the specs whose status is chosen (plus skipped ones)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(nameArb, statusArb), { maxLength: 12 }),
        fc.uniqueArray(statusArb),
        (entries, statuses) => {
          const unique = [...new Map(entries).entries()];
          const chosen = new Set(statuses);
          const selection = selector.select(
            unique.map(([name, status]) => buildSnapshot(name, status)),
            chosen,
          );
          const selected = unique.filter(([, status]) => chosen.has(status)).length;
          const written = selection.globsByWorkspace.get('/ws')?.length ?? 0;
          expect(written + selection.skipped.length).to.equal(selected);
        },
      ),
    );
  });
});
