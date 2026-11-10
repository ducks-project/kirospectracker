import type { ISpecConfig } from '../model/ISpecConfig';
/**
 * Port isolating the undocumented `.config.kiro` format from the core, like
 * `ISpecAgentGateway` does for the agent commands: should Kiro change the
 * format, only an adapter behind this port changes.
 */
export interface ISpecConfigReader {
  /**
   * Read the configuration of a spec folder.
   * @param folderPath Absolute path of the spec folder.
   * @returns The tolerant config; empty when absent or unreadable. Never rejects.
   */
  read(folderPath: string): Promise<ISpecConfig>;
}
