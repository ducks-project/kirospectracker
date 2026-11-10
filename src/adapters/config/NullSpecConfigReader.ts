import type { ISpecConfig } from '../../core/model/ISpecConfig';
import type { ISpecConfigReader } from '../../core/ports/ISpecConfigReader';
import { EMPTY_SPEC_CONFIG } from '../../core/parsing/SpecConfigParser';
/**
 * Null Object {@link ISpecConfigReader}: always an empty config, so entry
 * resolution uses the fallback order. Mirrors `UnavailableAgentGateway`.
 */
export class NullSpecConfigReader implements ISpecConfigReader {
  /**
   * Return the empty config.
   * @returns The empty config.
   */
  // eslint-disable-next-line class-methods-use-this
  public async read(): Promise<ISpecConfig> {
    return EMPTY_SPEC_CONFIG;
  }
}
