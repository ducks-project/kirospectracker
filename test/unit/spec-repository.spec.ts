import { expect } from 'chai';

import { SpecRepository } from '../../src/adapters/SpecRepository';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecStatus } from '../../src/core/model/SpecStatus';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';

/** Workspace root used across the repository fixtures. */
const WORKSPACE = '/ws';

/**
 * Build a snapshot factory wired with the real core collaborators.
 * @returns The pure snapshot factory.
 */
function makeFactory(): SpecSnapshotFactory {
  return new SpecSnapshotFactory(
    new TasksMarkdownParser(),
    new SpecProgressCalculator(),
    new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
  );
}

/**
 * Seed a fake file system with two specs plus a `.history/` directory.
 * @returns The seeded fake.
 */
function seededFileSystem(): FakeSpecFileSystem {
  const root = `${WORKSPACE}/.kiro/specs`;
  const directories = new Set<string>([`${root}/alpha`, `${root}/beta`, `${root}/.history`]);
  const files = new Map<string, string>([
    [`${root}/alpha/tasks.md`, '- [x] 1. Done\n- [ ] 2. Todo'],
    [`${root}/alpha/requirements.md`, '# Req'],
    [`${root}/beta/tasks.md`, '- [x] 1. Done'],
  ]);
  return new FakeSpecFileSystem([WORKSPACE], files, directories);
}

/**
 * Flush pending microtasks so a fire-and-forget change handler can settle.
 * @returns A promise resolving on the next microtask turn.
 */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Behaviour specification for {@link SpecRepository}.
 */
describe('SpecRepository', () => {
  it('discovers each spec folder, excluding .history', async () => {
    const repository = new SpecRepository(seededFileSystem(), makeFactory(), seededFileSystem());
    const specs = await repository.refresh();
    const names = specs.map((spec) => spec.name).sort();
    expect(names).to.deep.equal(['alpha', 'beta']);
  });

  it('resolves status from tasks.md through the core', async () => {
    const repository = new SpecRepository(seededFileSystem(), makeFactory(), seededFileSystem());
    const specs = await repository.refresh();
    const alpha = specs.find((spec) => 'alpha' === spec.name);
    const beta = specs.find((spec) => 'beta' === spec.name);
    expect(alpha?.status).to.equal(SpecStatus.InProgress);
    expect(beta?.status).to.equal(SpecStatus.FullyCompleted);
  });

  it('marks a spec with no tasks.md as Malformed without aborting the others', async () => {
    // Seed alpha with a directory but no tasks.md; beta keeps its tasks.md.
    const root = `${WORKSPACE}/.kiro/specs`;
    const directories = new Set<string>([`${root}/alpha`, `${root}/beta`]);
    const files = new Map<string, string>([[`${root}/beta/tasks.md`, '- [ ] 1. Todo']]);
    const partial = new FakeSpecFileSystem([WORKSPACE], files, directories);
    const repository = new SpecRepository(partial, makeFactory(), partial);
    const specs = await repository.refresh();
    const alpha = specs.find((spec) => 'alpha' === spec.name);
    expect(alpha?.status).to.equal(SpecStatus.Malformed);
    expect(specs).to.have.length(2);
  });

  it('returns an empty result when no workspace folder is open', async () => {
    const empty = new FakeSpecFileSystem([], new Map(), new Set());
    const repository = new SpecRepository(empty, makeFactory(), empty);
    expect(await repository.refresh()).to.deep.equal([]);
  });

  it('re-parses only the affected spec on a file change and notifies', async () => {
    const root = `${WORKSPACE}/.kiro/specs`;
    const fs = seededFileSystem();
    const repository = new SpecRepository(fs, makeFactory(), fs);
    await repository.refresh();
    let notified = 0;
    repository.onDidChangeSpecs(() => {
      notified += 1;
    });
    // Mutate alpha's tasks.md to fully done, then emit a change on it.
    fs.setFile(`${root}/alpha/tasks.md`, '- [x] 1. Done\n- [x] 2. Done');
    fs.emit(`${root}/alpha/tasks.md`);
    await flush();
    const alpha = repository.getSpecs().find((spec) => 'alpha' === spec.name);
    expect(alpha?.status).to.equal(SpecStatus.FullyCompleted);
    expect(notified).to.equal(1);
  });

  it('routes a change to the right spec when sibling names share a prefix', async () => {
    const root = `${WORKSPACE}/.kiro/specs`;
    // 'auth' is seeded before 'auth-v2' so the first prefix match would be wrong.
    const directories = new Set<string>([`${root}/auth`, `${root}/auth-v2`]);
    const files = new Map<string, string>([
      [`${root}/auth/tasks.md`, '- [x] 1. Done\n- [ ] 2. Todo'],
      [`${root}/auth-v2/tasks.md`, '- [ ] 1. Todo'],
    ]);
    const fs = new FakeSpecFileSystem([WORKSPACE], files, directories);
    const repository = new SpecRepository(fs, makeFactory(), fs);
    await repository.refresh();
    // Edit auth-v2 to fully done and emit the change on it.
    fs.setFile(`${root}/auth-v2/tasks.md`, '- [x] 1. Done');
    fs.emit(`${root}/auth-v2/tasks.md`);
    await flush();
    const auth = repository.getSpecs().find((spec) => 'auth' === spec.name);
    const authV2 = repository.getSpecs().find((spec) => 'auth-v2' === spec.name);
    // auth-v2 flips to completed; auth (untouched, prefix name) stays as is.
    expect(authV2?.status).to.equal(SpecStatus.FullyCompleted);
    expect(auth?.status).to.equal(SpecStatus.InProgress);
  });

  it('notifies a view that resolved against an empty cache once discovery completes', async () => {
    // Reproduces the real activation ordering: a view resolves and renders
    // from the still-empty cache BEFORE the initial refresh() completes, then
    // the completed refresh must notify so the view re-renders the discovered
    // specs. Mirrors SpecDashboardViewProvider.resolveWebviewView, which reads
    // getSpecs() on resolve and re-reads it on every onDidChangeSpecs.
    const fs = seededFileSystem();
    const repository = new SpecRepository(fs, makeFactory(), fs);
    let rendered: readonly string[] = [];
    const render = (): void => {
      rendered = repository
        .getSpecs()
        .map((spec) => spec.name)
        .sort();
    };
    repository.onDidChangeSpecs(render);
    // The view resolves first and renders the empty cache (discovery pending).
    render();
    expect(rendered).to.deep.equal([]);
    // Discovery completes (activation fires refresh without awaiting it).
    await repository.refresh();
    await flush();
    expect(rendered).to.deep.equal(['alpha', 'beta']);
  });

  it('releases its subscription on dispose', async () => {
    const fs = seededFileSystem();
    const repository = new SpecRepository(fs, makeFactory(), fs);
    await repository.refresh();
    repository.dispose();
    expect(repository.getSpecs()).to.deep.equal([]);
  });
});
