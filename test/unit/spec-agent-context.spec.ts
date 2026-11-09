import { expect } from 'chai';

import {
  buildFolderContextToken,
  composeMessageWithFolderContext,
} from '../../src/core/SpecAgentContext';
import { runMessageForScope, SPEC_AGENT_MESSAGES } from '../../src/core/SpecAgentMessages';

/**
 * Behaviour specification for {@link buildFolderContextToken} and
 * {@link composeMessageWithFolderContext}: the pure composition of an in-prompt
 * `#[[folder:<fsPath>]]` context token with the fixed agent templates, plus the
 * graceful no-folder degradation to the plain template.
 */
describe('SpecAgentContext', () => {
  describe('buildFolderContextToken', () => {
    it('builds the folder token with the exact #[[folder:<fsPath>]] shape', () => {
      expect(buildFolderContextToken('/w/.kiro/specs/spec-tracker')).to.equal(
        '#[[folder:/w/.kiro/specs/spec-tracker]]',
      );
    });

    it('does not alter the folder path it embeds', () => {
      const fsPath = '/abs/path/with spaces/.kiro/specs/my-spec';
      expect(buildFolderContextToken(fsPath)).to.equal(`#[[folder:${fsPath}]]`);
    });
  });

  describe('composeMessageWithFolderContext', () => {
    it('prepends the folder token on its own line before the run-required template', () => {
      const composed = composeMessageWithFolderContext(
        runMessageForScope('required'),
        '/w/.kiro/specs/spec-tracker',
      );
      expect(composed).to.equal('#[[folder:/w/.kiro/specs/spec-tracker]]\nRun all required tasks');
    });

    it('prepends the folder token before the run-required-and-optional template', () => {
      const composed = composeMessageWithFolderContext(
        runMessageForScope('required-and-optional'),
        '/w/.kiro/specs/spec-tracker',
      );
      expect(composed).to.equal(
        '#[[folder:/w/.kiro/specs/spec-tracker]]\nRun required and optional tasks',
      );
    });

    it('prepends the folder token before the sync-tasks template', () => {
      const composed = composeMessageWithFolderContext(
        SPEC_AGENT_MESSAGES.syncTasks('spec-tracker'),
        '/w/.kiro/specs/spec-tracker',
      );
      expect(composed).to.equal(
        '#[[folder:/w/.kiro/specs/spec-tracker]]\nUpdate the tasks for the spec-tracker',
      );
    });

    it('returns the PLAIN template with NO token when the folder path is empty', () => {
      const composed = composeMessageWithFolderContext(runMessageForScope('required'), '');
      expect(composed).to.equal('Run all required tasks');
      expect(composed).to.not.contain('#[[folder:');
    });

    it('builds the composed message from the token and the exact template', () => {
      const template = runMessageForScope('required');
      const fsPath = '/w/.kiro/specs/spec-tracker';
      expect(composeMessageWithFolderContext(template, fsPath)).to.equal(
        `${buildFolderContextToken(fsPath)}\n${template}`,
      );
    });
  });
});
