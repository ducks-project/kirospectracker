import type { RunScope } from './ports/ISpecAgentGateway';

/**
 * Fixed agent-message templates, kept as pure data in one place (DRY).
 *
 * Only the spec name is interpolated into `syncTasks`; the run messages are
 * constant strings. This is a security property: the agent instruction is a
 * fixed, human-readable template, never built from untrusted free text and
 * never evaluated as code. The spec name originates from a `.kiro/specs/<name>/`
 * folder name already trusted by the repository.
 *
 * The strings are the verbatim templates from the ROADMAP v0.7.0 milestone.
 */
export const SPEC_AGENT_MESSAGES = {
  /**
   * Message asking the agent to update/sync a spec's tasks.
   * @param specName The spec name to interpolate.
   * @returns The ready-to-send message.
   */
  syncTasks: (specName: string): string => `Update the tasks for the ${specName}`,

  /**
   * Message asking the agent to run all required tasks.
   * @returns The ready-to-send message.
   */
  runRequired: (): string => `Run all required tasks`,

  /**
   * Message asking the agent to run required and optional tasks.
   * @returns The ready-to-send message.
   */
  runRequiredAndOptional: (): string => `Run required and optional tasks`,
} as const;

/**
 * Build the run message for a given scope, so a caller holding only a
 * {@link RunScope} need not branch on the scope itself (DRY).
 * @param scope The run scope.
 * @returns The ready-to-send run message.
 */
export function runMessageForScope(scope: RunScope): string {
  if ('required-and-optional' === scope) {
    return SPEC_AGENT_MESSAGES.runRequiredAndOptional();
  }
  return SPEC_AGENT_MESSAGES.runRequired();
}
