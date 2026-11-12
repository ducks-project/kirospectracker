import { expect } from 'chai';

import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type {
  ISpecAgentGateway,
  RunScope,
  SpecAgentAvailability,
} from '../../src/core/ports/ISpecAgentGateway';
import type { IAgentErrorReporter } from '../../src/adapters/ports/IAgentErrorReporter';
import { SpecAgentActions } from '../../src/adapters/SpecAgentActions';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';

const WORKSPACE = '/ws';
const ROOT = `${WORKSPACE}/.kiro/specs`;
const ALPHA = `${ROOT}/alpha`;

/** Recording fake implementing the full {@link ISpecAgentGateway} contract. */
class FakeAgentGateway implements ISpecAgentGateway {
  public readonly synced: ISpecSnapshot[] = [];

  public readonly ran: { spec: ISpecSnapshot; scope: RunScope }[] = [];

  // eslint-disable-next-line class-methods-use-this
  public availability(): SpecAgentAvailability {
    return 'integrated';
  }

  public async syncTasks(spec: ISpecSnapshot): Promise<void> {
    this.synced.push(spec);
  }

  public async runTasks(spec: ISpecSnapshot, scope: RunScope): Promise<void> {
    this.ran.push({ spec, scope });
  }
}

/** Error reporter recording surfaced messages. */
class RecordingReporter implements IAgentErrorReporter {
  public readonly errors: string[] = [];

  public showError(message: string): void {
    this.errors.push(message);
  }
}

const BROKEN = `${ROOT}/broken`;
/** Build a repository seeded with `alpha` (in progress) and `broken` (no tasks.md). */
async function seededRepository(): Promise<SpecRepository> {
  const directories = new Set<string>([ALPHA, BROKEN]);
  const files = new Map<string, string>([[`${ALPHA}/tasks.md`, '- [x] 1. Done\n- [ ] 2. Todo']]);
  const fileSystem = new FakeSpecFileSystem([WORKSPACE], files, directories);
  const factory = new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
  const repository = new SpecRepository(fileSystem, factory, fileSystem);
  await repository.refresh();
  return repository;
}

/**
 * Behaviour specification for {@link SpecAgentActions}: both entry points resolve
 * the cached snapshot and call exactly one gateway intent.
 */
describe('SpecAgentActions', () => {
  it('calls syncTasks with the resolved snapshot', async () => {
    const gateway = new FakeAgentGateway();
    const actions = new SpecAgentActions(
      await seededRepository(),
      gateway,
      new RecordingReporter(),
    );
    await actions.syncTasks(ALPHA);
    expect(gateway.synced).to.have.length(1);
    expect(gateway.synced[0].name).to.equal('alpha');
    expect(gateway.ran).to.have.length(0);
  });

  it('calls runTasks with the resolved snapshot and the required scope', async () => {
    const gateway = new FakeAgentGateway();
    const actions = new SpecAgentActions(
      await seededRepository(),
      gateway,
      new RecordingReporter(),
    );
    await actions.runTasks(ALPHA, 'required');
    expect(gateway.ran).to.deep.equal([{ spec: gateway.ran[0]?.spec, scope: 'required' }]);
    expect(gateway.ran[0].spec.name).to.equal('alpha');
  });

  it('calls runTasks with the required-and-optional scope', async () => {
    const gateway = new FakeAgentGateway();
    const actions = new SpecAgentActions(
      await seededRepository(),
      gateway,
      new RecordingReporter(),
    );
    await actions.runTasks(ALPHA, 'required-and-optional');
    expect(gateway.ran[0].scope).to.equal('required-and-optional');
  });

  it('reports an error and calls no intent for an unknown folder', async () => {
    const gateway = new FakeAgentGateway();
    const reporter = new RecordingReporter();
    const actions = new SpecAgentActions(await seededRepository(), gateway, reporter);
    await actions.syncTasks(`${ROOT}/missing`);
    expect(gateway.synced).to.have.length(0);
    expect(reporter.errors[0]).to.contain('No spec found');
  });

  it('routes through the gateway swapped in via setGateway', async () => {
    const first = new FakeAgentGateway();
    const second = new FakeAgentGateway();
    const actions = new SpecAgentActions(await seededRepository(), first, new RecordingReporter());
    actions.setGateway(second);
    await actions.syncTasks(ALPHA);
    expect(first.synced).to.have.length(0);
    expect(second.synced).to.have.length(1);
    expect(actions.getGateway()).to.equal(second);
  });
  it('refuses runTasks of a malformed spec for both scopes without calling the gateway', async () => {
    const gateway = new FakeAgentGateway();
    const reporter = new RecordingReporter();
    const actions = new SpecAgentActions(await seededRepository(), gateway, reporter);
    await actions.runTasks(BROKEN, 'required');
    await actions.runTasks(BROKEN, 'required-and-optional');
    expect(gateway.ran).to.have.length(0);
    expect(reporter.errors).to.have.length(2);
    expect(reporter.errors[0]).to.equal(
      '"broken" is malformed (missing or unreadable tasks.md) and cannot be run.',
    );
  });
  it('refuses syncTasks of a malformed spec without calling the gateway', async () => {
    const gateway = new FakeAgentGateway();
    const reporter = new RecordingReporter();
    const actions = new SpecAgentActions(await seededRepository(), gateway, reporter);
    await actions.syncTasks(BROKEN);
    expect(gateway.synced).to.have.length(0);
    expect(reporter.errors).to.deep.equal([
      '"broken" is malformed (missing or unreadable tasks.md) and cannot be synced.',
    ]);
  });
  it('reports no error for a well-formed spec', async () => {
    const reporter = new RecordingReporter();
    const actions = new SpecAgentActions(
      await seededRepository(),
      new FakeAgentGateway(),
      reporter,
    );
    await actions.runTasks(ALPHA, 'required');
    expect(reporter.errors).to.have.length(0);
  });
});
