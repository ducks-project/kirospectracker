import type { SpecRepository } from '../SpecRepository';

/** Command identifier contributed in package.json. */
export const REFRESH_COMMAND_ID = 'kirospectracker.refresh';

/**
 * Command re-discovering every spec across the workspace.
 *
 * It is a thin wrapper over {@link SpecRepository.refresh}; the repository emits
 * its change event, which the providers already observe to re-render.
 */
export class RefreshCommand {
  private readonly repository: SpecRepository;

  /**
   * Build the command over the repository.
   * @param repository The spec repository to refresh.
   */
  public constructor(repository: SpecRepository) {
    this.repository = repository;
  }

  /**
   * Refresh the whole spec set.
   */
  public async execute(): Promise<void> {
    await this.repository.refresh();
  }
}
