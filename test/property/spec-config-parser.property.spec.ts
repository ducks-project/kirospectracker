import { expect } from 'chai';
import * as fc from 'fast-check';
import { parseSpecConfig } from '../../src/core/parsing/SpecConfigParser';
/** Property-based specification for {@link parseSpecConfig}. */
describe('parseSpecConfig (properties)', () => {
  it('never throws on arbitrary text', () => {
    fc.assert(fc.property(fc.string(), (text) => void parseSpecConfig(text)));
  });
  it('never throws on arbitrary JSON values and only yields strings or undefined', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const config = parseSpecConfig(JSON.stringify(value));
        [config.workflowType, config.specType].forEach((axis) => {
          expect(['string', 'undefined']).to.include(typeof axis);
        });
      }),
    );
  });
  it('is stable: reparsing the serialised config gives the same config', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const config = parseSpecConfig(JSON.stringify(value));
        expect(parseSpecConfig(JSON.stringify(config))).to.deep.equal(config);
      }),
    );
  });
});
