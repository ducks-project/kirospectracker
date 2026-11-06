import { expect } from 'chai';

import { RunTasksCommand } from '../../src/adapters/commands/RunTasksCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import { RunPromptBuilder } from '../../src/core/RunPromptBuilder';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';
import { FakeWorkspaceGateway } from '../helpers/fake-workspace-gateway';

const WORKSPACE = '/ws';
const ROOT = `${WORKSPACE}/.kiro/specs`;

/**
 * Build a repository seeded with one in-progress spec and one malformed spec.
 * @returns The seeded, refreshed repository.
 */
async function seededRepository(): Promise<SpecRepository> {
  const directories = new Set<string>([`${ROOT}/alpha`, `${ROOT}/broken`]);
  const files = new Map<string, string>([
    [`${ROOT}/alpha/tasks.md`, '- [x] 1. Done\n- [ ] 2. Todo'],
  ]);
  const fs = new FakeSpecFileSystem([WORKSPACE], files, directories);
  const factory = new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
  const repository = new SpecRepository(fs, factory, fs);
  await repository.refresh();
  return repository;
}

/**
 * Behaviour specification for {@link RunTasksCommand}.
 */
describe('RunTasksCommand', () => {
  it('opens tasks.md and does not copy without consent', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway(false);
    const command = new RunTasksCommand(repository, gateway, new RunPromptBuilder());
    await command.execute(`${ROOT}/alpha`);
    expect(gateway.opened).to.deep.equal([`${ROOT}/alpha/tasks.md`]);
    expect(gateway.copied).to.deep.equal([]);
  });

  it('copies the prompt only after explicit consent', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway(true);
    const command = new RunTasksCommand(repository, gateway, new RunPromptBuilder());
    await command.execute(`${ROOT}/alpha`);
    expect(gateway.copied).to.have.length(1);
    expect(gateway.copied[0]).to.contain('- Todo');
    expect(gateway.infos).to.have.length(1);
  });

  it('refuses a malformed spec with a clear error', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway(true);
    const command = new RunTasksCommand(repository, gateway, new RunPromptBuilder());
    await command.execute(`${ROOT}/broken`);
    expect(gateway.opened).to.deep.equal([]);
    expect(gateway.errors[0]).to.contain('malformed');
  });

  it('errors when the spec is unknown', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway(true);
    const command = new RunTasksCommand(repository, gateway, new RunPromptBuilder());
    await command.execute(`${ROOT}/missing`);
    expect(gateway.errors[0]).to.contain('No spec found');
  });
});
