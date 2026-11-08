import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import { RunTasksCommand } from '../../src/adapters/commands/RunTasksCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import { RunPromptBuilder } from '../../src/core/RunPromptBuilder';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { UnavailableAgentGateway } from '../../src/adapters/agent/UnavailableAgentGateway';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';
import { FakeWorkspaceGateway } from '../helpers/fake-workspace-gateway';

const WORKSPACE = '/ws';
const ROOT = `${WORKSPACE}/.kiro/specs`;

/** Build a run-tasks command over a repository seeded with one in-progress spec. */
async function buildRunTasksCommand(gateway: FakeWorkspaceGateway): Promise<RunTasksCommand> {
  const directories = new Set<string>([`${ROOT}/alpha`]);
  const files = new Map<string, string>([
    [`${ROOT}/alpha/tasks.md`, '- [x] 1. Done\n- [ ] 2. Todo'],
  ]);
  const fileSystem = new FakeSpecFileSystem([WORKSPACE], files, directories);
  const factory = new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
  const repository = new SpecRepository(fileSystem, factory, fileSystem);
  await repository.refresh();
  return new RunTasksCommand(
    repository,
    gateway,
    new RunPromptBuilder(),
    fileSystem,
    new TasksMarkdownParser(),
  );
}

/** A spec snapshot pointing at the seeded in-progress spec. */
const SPEC = { name: 'alpha', folderPath: `${ROOT}/alpha` } as ISpecSnapshot;

/**
 * Behaviour specification for the Null-Object {@link UnavailableAgentGateway}.
 */
describe('UnavailableAgentGateway', () => {
  it('reports availability as unavailable', async () => {
    const gateway = new UnavailableAgentGateway(
      await buildRunTasksCommand(new FakeWorkspaceGateway()),
    );
    expect(gateway.availability()).to.equal('unavailable');
  });

  it('degrades syncTasks to the honest MVP (opens tasks.md)', async () => {
    const workspace = new FakeWorkspaceGateway(false);
    const gateway = new UnavailableAgentGateway(await buildRunTasksCommand(workspace));
    await gateway.syncTasks(SPEC);
    expect(workspace.opened).to.deep.equal([`${ROOT}/alpha/tasks.md`]);
    expect(workspace.copied).to.deep.equal([]);
  });

  it('degrades runTasks to the honest MVP (opens tasks.md, consented copy)', async () => {
    const workspace = new FakeWorkspaceGateway(true);
    const gateway = new UnavailableAgentGateway(await buildRunTasksCommand(workspace));
    await gateway.runTasks(SPEC, 'required');
    expect(workspace.opened).to.deep.equal([`${ROOT}/alpha/tasks.md`]);
    expect(workspace.copied).to.have.length(1);
  });
});
