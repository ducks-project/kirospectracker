import { expect } from 'chai';
import * as fc from 'fast-check';
import { EntryDocumentResolver } from '../../src/core/EntryDocumentResolver';
import { FALLBACK_ENTRY_ORDER } from '../../src/core/EntryDocumentRules';

const resolver = new EntryDocumentResolver();
const configArb = fc.record({
  workflowType: fc.option(
    fc.oneof(fc.constantFrom('design-first', 'requirements-first'), fc.string()),
    {
      nil: undefined,
    },
  ),
  specType: fc.option(fc.oneof(fc.constantFrom('bugfix', 'feature'), fc.string()), {
    nil: undefined,
  }),
});
const documentsArb = fc.record({
  tasks: fc.boolean(),
  requirements: fc.boolean(),
  design: fc.boolean(),
  notes: fc.boolean(),
  bugfix: fc.boolean(),
});
/** Property-based specification for {@link EntryDocumentResolver}. */
describe('EntryDocumentResolver (properties)', () => {
  it('always resolves to undefined or a present document', () => {
    fc.assert(
      fc.property(configArb, documentsArb, (config, documents) => {
        const entry = resolver.resolve(config, documents);
        expect(undefined === entry || documents[entry]).to.equal(true);
      }),
    );
  });
  it('with an empty config equals the first present of requirements, design, tasks', () => {
    fc.assert(
      fc.property(documentsArb, (documents) => {
        const expected = FALLBACK_ENTRY_ORDER.find((kind) => documents[kind]);
        expect(resolver.resolve({}, documents)).to.equal(expected);
      }),
    );
  });
});
