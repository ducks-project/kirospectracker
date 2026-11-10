import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type { SpecStatus } from '../../src/core/model/SpecStatus';

/**
 * Build a minimal snapshot fixture.
 * @param name The spec folder name.
 * @param status The spec status.
 * @param workspacePath The owning workspace folder path.
 * @returns A snapshot whose folder lives under `<workspace>/.kiro/specs/<name>`.
 */
export function buildSnapshot(
  name: string,
  status: SpecStatus,
  workspacePath = '/ws',
): ISpecSnapshot {
  return {
    name,
    folderPath: `${workspacePath}/.kiro/specs/${name}`,
    workspacePath,
    documents: { tasks: true, requirements: false, design: false, notes: false, bugfix: false },
    entryDocument: undefined,
    status,
    progress: {
      requiredDone: 0,
      requiredTotal: 0,
      optionalDone: 0,
      optionalTotal: 0,
      requiredRatio: 1,
      optionalRatio: 0,
      requiredResolvedDone: 0,
      requiredResolvedCancelled: 0,
      requiredInProgress: 0,
      requiredTodo: 0,
      optionalResolvedDone: 0,
      optionalResolvedCancelled: 0,
      optionalInProgress: 0,
      optionalTodo: 0,
    },
  };
}
