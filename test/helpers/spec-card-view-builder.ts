import type { ISpecCardView } from '../../src/core/model/ISpecCardView';
import type { SpecStatus } from '../../src/core/model/SpecStatus';

/**
 * Build a card view with zero progress; override any field.
 * @param status The spec status.
 * @param overrides Fields to override.
 * @returns A card view fixture.
 */
export function buildCardView(
  status: SpecStatus,
  overrides: Partial<ISpecCardView> = {},
): ISpecCardView {
  return {
    name: 'alpha',
    folderPath: '/ws/.kiro/specs/alpha',
    folderKey: '/ws',
    ownerLabel: 'ws',
    documents: { tasks: true, requirements: false, design: false, notes: false, bugfix: false },
    entryDocument: undefined,
    status,
    progress: {
      requiredDone: 0,
      requiredTotal: 0,
      optionalDone: 0,
      optionalTotal: 0,
      requiredRatio: 0,
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
    ...overrides,
  };
}
