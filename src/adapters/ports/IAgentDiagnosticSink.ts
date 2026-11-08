/**
 * Port the agent adapter writes an observability diagnostic through, so the
 * selection logic can record WHAT it detected and WHICH path it took without
 * importing `vscode`.
 *
 * The real implementation appends to a host `OutputChannel` named "Kiro Spec
 * Tracker"; a fake records the lines in unit tests. Keeping the sink behind this
 * thin abstraction (Dependency Inversion) means the detection/selection logic in
 * {@link KiroChatAgentGateway} stays fully unit-testable while the host-only
 * channel lives in an excluded `Vscode*` wrapper.
 */
export interface IAgentDiagnosticSink {
  /**
   * Append one diagnostic line.
   * @param line The human-readable diagnostic line.
   */
  append(line: string): void;
}
