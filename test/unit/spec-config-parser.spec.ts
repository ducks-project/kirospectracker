import { expect } from 'chai';
import { EMPTY_SPEC_CONFIG, parseSpecConfig } from '../../src/core/parsing/SpecConfigParser';
/** Behaviour specification for {@link parseSpecConfig}. */
describe('parseSpecConfig', () => {
  it('reads both axes from valid JSON, ignoring extra keys', () => {
    const text = '{"specId":"x","workflowType":"design-first","specType":"feature","other":1}';
    expect(parseSpecConfig(text)).to.deep.equal({
      workflowType: 'design-first',
      specType: 'feature',
    });
  });
  it('returns the empty config for an absent file', () => {
    expect(parseSpecConfig(undefined)).to.equal(EMPTY_SPEC_CONFIG);
  });
  it('tolerates empty, malformed and non-object roots', () => {
    ['', '{', 'null', '[]', '42', '"str"', 'true'].forEach((text) => {
      expect(parseSpecConfig(text), text).to.equal(EMPTY_SPEC_CONFIG);
    });
  });
  it('treats an empty object and missing keys as missing values', () => {
    expect(parseSpecConfig('{}')).to.deep.equal({
      workflowType: undefined,
      specType: undefined,
    });
    expect(parseSpecConfig('{"specType":"bugfix"}').workflowType).to.equal(undefined);
  });
  it('ignores non-string and blank values but keeps unknown strings', () => {
    expect(parseSpecConfig('{"workflowType":1,"specType":"  "}')).to.deep.equal({
      workflowType: undefined,
      specType: undefined,
    });
    expect(parseSpecConfig('{"workflowType":" weird "}').workflowType).to.equal('weird');
  });
});
