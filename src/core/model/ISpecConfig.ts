/**
 * Tolerant view of a spec's `.config.kiro` file.
 *
 * The format is NOT publicly documented by Kiro: these two axes were observed on
 * real workspaces (`workflowType` is `requirements-first` or `design-first`,
 * `specType` is `feature` or `bugfix`). Values are kept as raw trimmed strings so
 * an unknown value never throws; interpreting them is the resolver's job.
 */
export interface ISpecConfig {
  /** Raw `workflowType` value, or `undefined` when missing or not a string. */
  readonly workflowType?: string;
  /** Raw `specType` value, or `undefined` when missing or not a string. */
  readonly specType?: string;
}
