import { expect } from 'chai';

import { RefreshCommand } from '../../src/adapters/commands/RefreshCommand';
import { ToggleLayoutCommand } from '../../src/adapters/commands/ToggleLayoutCommand';
import { SpecRepository } from '../../src/adapters/SpecRepository';
import type { ILayoutToggleable } from '../../src/adapters/ports/ILayoutToggleable';
import { SpecSnapshotFactory } from '../../src/core/SpecSnapshotFactory';
import { SpecProgressCalculator } from '../../src/core/status/SpecProgressCalculator';
import { SpecStatusResolver } from '../../src/core/status/SpecStatusResolver';
import { TasksOnlyDocumentPolicy } from '../../src/core/status/TasksOnlyDocumentPolicy';
import { TasksMarkdownParser } from '../../src/core/parsing/TasksMarkdownParser';
import { FakeSpecFileSystem } from '../helpers/fake-spec-file-system';

const WORKSPACE = '/ws';
const ROOT = `${WORKSPACE}/.kiro/specs`;

/**
 * Behaviour specification for {@link RefreshCommand} and {@link ToggleLayoutCommand}.
 */
describe('RefreshCommand and ToggleLayoutCommand', () => {
  it('refreshes the repository and discovers specs', async () => {
    const directories = new Set<string>([`${ROOT}/alpha`]);
    const files = new Map<string, string>([[`${ROOT}/alpha/tasks.md`, '- [ ] 1. Todo']]);
    const fs = new FakeSpecFileSystem([WORKSPACE], files, directories);
    const factory = new SpecSnapshotFactory(
      new TasksMarkdownParser(),
      new SpecProgressCalculator(),
      new SpecStatusResolver(new TasksOnlyDocumentPolicy()),
    );
    const repository = new SpecRepository(fs, factory, fs);
    await new RefreshCommand(repository).execute();
    expect(repository.getSpecs()).to.have.length(1);
  });

  it('delegates the toggle to the layout-toggleable dashboard', () => {
    let toggled = 0;
    const toggleable: ILayoutToggleable = {
      toggleLayout: () => {
        toggled += 1;
      },
    };
    new ToggleLayoutCommand(toggleable).execute();
    expect(toggled).to.equal(1);
  });
});
