import { expect } from 'chai';
import { ResetHiddenSpecsCommand } from '../../src/adapters/commands/ResetHiddenSpecsCommand';

describe('ResetHiddenSpecsCommand', () => {
  it('asks the synchroniser to reset', async () => {
    let calls = 0;
    const command = new ResetHiddenSpecsCommand({
      reset: async () => {
        calls += 1;
        return 2;
      },
    });
    await command.execute();
    expect(calls).to.equal(1);
  });
});
