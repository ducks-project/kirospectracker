/** Command id removing every exclusion entry the extension wrote. */
export const RESET_HIDDEN_SPECS_COMMAND_ID = 'kirospectracker.resetHiddenSpecs';

/** Narrow view of the synchroniser the command needs. */
export interface IHiddenSpecsResetter {
  /**
   * Remove every entry the extension owns.
   * @returns The number of entries removed.
   */
  reset(): Promise<number>;
}

/** Command handler for "Reset Hidden Specs". */
export class ResetHiddenSpecsCommand {
  private readonly resetter: IHiddenSpecsResetter;

  /**
   * Build the command.
   * @param resetter The synchroniser removing the owned entries.
   */
  public constructor(resetter: IHiddenSpecsResetter) {
    this.resetter = resetter;
  }

  /** Remove all owned exclusion entries. */
  public async execute(): Promise<void> {
    await this.resetter.reset();
  }
}
