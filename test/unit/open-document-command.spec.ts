import { expect } from 'chai';

import { OpenDocumentCommand } from '../../src/adapters/commands/OpenDocumentCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
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
 * Build a repository with one spec having tasks.md and requirements.md only.
 * @returns The seeded, refreshed repository.
 */
async function seededRepository(): Promise<SpecRepository> {
  const directories = new Set<string>([`${ROOT}/alpha`]);
  const files = new Map<string, string>([
    [`${ROOT}/alpha/tasks.md`, '- [ ] 1. Todo'],
    [`${ROOT}/alpha/requirements.md`, '# Req'],
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
 * Behaviour specification for {@link OpenDocumentCommand}.
 */
describe('OpenDocumentCommand', () => {
  it('opens a present document', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway();
    const command = new OpenDocumentCommand(repository, gateway);
    await command.execute(`${ROOT}/alpha`, 'requirements');
    expect(gateway.opened).to.deep.equal([`${ROOT}/alpha/requirements.md`]);
  });

  it('refuses an absent document with a readable message', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway();
    const command = new OpenDocumentCommand(repository, gateway);
    await command.execute(`${ROOT}/alpha`, 'design');
    expect(gateway.opened).to.deep.equal([]);
    expect(gateway.errors[0]).to.contain('design');
  });

  it('errors when the spec is unknown', async () => {
    const repository = await seededRepository();
    const gateway = new FakeWorkspaceGateway();
    const command = new OpenDocumentCommand(repository, gateway);
    await command.execute(`${ROOT}/missing`, 'tasks');
    expect(gateway.errors[0]).to.contain('No spec found');
  });
  it('opens bugfix.md as a first-class document and refuses it when absent', async () => {
    const directories = new Set<string>([`${ROOT}/bug`]);
    const files = new Map<string, string>([
      [`${ROOT}/bug/tasks.md`, '- [ ] 1. Todo'],
      [`${ROOT}/bug/bugfix.md`, '# Bug'],
    ]);
    const fs = new FakeSpecFileSystem([WORKSPACE], files, directories);
    const factory = new SpecSnapshotFactory(
      new TasksMarkdownParser(),
      new SpecProgressCalculator(),
      new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
    );
    const repository = new SpecRepository(fs, factory, fs);
    await repository.refresh();
    const gateway = new FakeWorkspaceGateway();
    const command = new OpenDocumentCommand(repository, gateway);
    await command.execute(`${ROOT}/bug`, 'bugfix');
    expect(gateway.opened).to.deep.equal([`${ROOT}/bug/bugfix.md`]);
    const other = await seededRepository();
    const otherGateway = new FakeWorkspaceGateway();
    await new OpenDocumentCommand(other, otherGateway).execute(`${ROOT}/alpha`, 'bugfix');
    expect(otherGateway.errors[0]).to.contain('bugfix');
  });
});
