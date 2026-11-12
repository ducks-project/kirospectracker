import { DashboardDriver } from './DashboardDriver';
import { DashboardHost } from './DashboardHost';

/** A named, replayable interaction with the dashboard. */
export interface IDashboardScenario {
  /** Unique, file-name-safe name; also the name of its reference file. */
  readonly name: string;
  /** Boot-time environment overrides. */
  readonly boot?: {
    readonly locationOrigin?: string;
    readonly persistedState?: unknown;
  };
  /** Set to `false` to record the node count instead of the whole body (large scenarios). */
  readonly fullDom?: boolean;
  /**
   * Play the scenario. Each `checkpoint` records what happened so far; the
   * driver appends the final state itself.
   * @param driver The driver over the booted dashboard.
   */
  run(driver: DashboardDriver): void;
}

/**
 * Boot the bundle in a fresh fake page, play a scenario and return its text.
 * @param bundle The dashboard bundle source.
 * @param scenario The scenario.
 * @returns The serialised observation, compared with the versioned reference.
 */
export function runDashboardScenario(bundle: string, scenario: IDashboardScenario): string {
  const host = new DashboardHost({ bundle, ...scenario.boot });
  const driver = new DashboardDriver(host);
  driver.checkpoint('boot');
  scenario.run(driver);
  return `# scenario: ${scenario.name}\n${driver.finish(false !== scenario.fullDom)}`;
}
