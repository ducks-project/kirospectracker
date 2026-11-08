import { expect } from 'chai';

import type { IAgentErrorReporter } from '../../src/adapters/ports/IAgentErrorReporter';
import { KiroChatAgentGateway } from '../../src/adapters/agent/KiroChatAgentGateway';
import { UnavailableAgentGateway } from '../../src/adapters/agent/UnavailableAgentGateway';
import { RunTasksCommand } from '../../src/adapters/commands/RunTasksCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import { RunPromptBuilder } from '../../src/core/RunPromptBuilder';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { createSpecAgentGateway } from '../../src/adapters/agent/SpecAgentGatewayFactory';
import { FakeCommandGateway } from '../helpers/fake-command-gateway';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';
import { FakeWorkspaceGateway } from '../helpers/fake-workspace-gateway';

/** Silent error reporter conforming to the full contract. */
const reporter: IAgentErrorReporter = { showError: () => undefined };

/** Build a Null-Object fallback over a minimal real run-tasks command. */
async function buildFallback(): Promise<UnavailableAgentGateway> {
  const fileSystem = new FakeSpecFileSystem([], new Map(), new Set());
  const factory = new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
  const repository = new SpecRepository(fileSystem, factory, fileSystem);
  await repository.refresh();
  const runTasks = new RunTasksCommand(
    repository,
    new FakeWorkspaceGateway(),
    new RunPromptBuilder(),
    fileSystem,
    new TasksMarkdownParser(),
  );
  return new UnavailableAgentGateway(runTasks);
}

/**
 * Behaviour specification for {@link createSpecAgentGateway}: it selects the
 * adapter by detected capability and honors the disable setting.
 */
describe('createSpecAgentGateway', () => {
  it('selects the Kiro adapter when a kiroAgent command is present and enabled', async () => {
    const commands = new FakeCommandGateway(['kiroAgent.executions.queueUserMessage']);
    const gateway = await createSpecAgentGateway(commands, reporter, await buildFallback(), true);
    expect(gateway).to.be.instanceOf(KiroChatAgentGateway);
  });

  it('selects the Kiro adapter when only the generic chat-open command is present', async () => {
    const commands = new FakeCommandGateway(['workbench.action.chat.open']);
    const gateway = await createSpecAgentGateway(commands, reporter, await buildFallback(), true);
    expect(gateway).to.be.instanceOf(KiroChatAgentGateway);
  });

  it('selects the Null Object when no usable command surface exists', async () => {
    const commands = new FakeCommandGateway(['some.unrelated.command']);
    const fallback = await buildFallback();
    const gateway = await createSpecAgentGateway(commands, reporter, fallback, true);
    expect(gateway).to.equal(fallback);
  });

  it('always binds the Null Object when the integration is disabled', async () => {
    const commands = new FakeCommandGateway(['kiroAgent.executions.queueUserMessage']);
    const fallback = await buildFallback();
    const gateway = await createSpecAgentGateway(commands, reporter, fallback, false);
    expect(gateway).to.equal(fallback);
  });
});
