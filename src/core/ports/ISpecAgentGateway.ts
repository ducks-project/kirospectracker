import type { ISpecSnapshot } from '../model/ISpecSnapshot';

/** Scope of a run request. */
export type RunScope = 'required' | 'required-and-optional';

/**
 * Availability of the underlying agent integration, as a strong, discriminated
 * contract so the UI can be honest in three states rather than guessing.
 *
 * - `integrated`: a real agent command surface was detected and is driven.
 * - `degraded`: no agent surface; actions degrade to the honest MVP.
 * - `unavailable`: the Null-Object fallback (same honest MVP behaviour).
 */
export type SpecAgentAvailability = 'integrated' | 'degraded' | 'unavailable';

/**
 * Port (Dependency Inversion) describing the INTENT of driving an agent to act
 * on a spec. Concrete adapters map these intents to a host's command surface;
 * the core and the UI never know which host (Kiro, a future official API, or a
 * null fallback) is behind it.
 *
 * The contract is deliberately tight (three members, Interface Segregation): it
 * takes the existing immutable {@link ISpecSnapshot}, so no new `vscode` type
 * crosses the boundary. A future "abort" need would be a separate port, not a
 * widening of this one.
 */
export interface ISpecAgentGateway {
  /**
   * Report whether the real integration is available (capability query).
   * @returns The current availability state.
   */
  availability(): SpecAgentAvailability;

  /**
   * Ask the agent to update/sync the spec's tasks.
   * @param spec The immutable spec snapshot.
   */
  syncTasks(spec: ISpecSnapshot): Promise<void>;

  /**
   * Ask the agent to run the spec's tasks for the given scope.
   * @param spec The immutable spec snapshot.
   * @param scope The run scope (required, or required and optional).
   */
  runTasks(spec: ISpecSnapshot, scope: RunScope): Promise<void>;
}
