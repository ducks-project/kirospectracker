/** Maximum number of task titles listed in the generated prompt. */
const MAX_LISTED_TASKS = 20;

/**
 * Pure builder producing the ready-to-paste execution prompt for a spec.
 *
 * The MVP copies this text to the clipboard only after explicit consent; the
 * builder itself is `vscode`-free and deterministic, so it is gate-covered. It
 * references no undocumented Kiro command: the prompt is plain instructions for
 * the user to run in the Kiro chat.
 */
export class RunPromptBuilder {
  /** Cap on the number of task titles embedded in the prompt. */
  private readonly maxListedTasks: number;

  /**
   * Build a prompt builder with an optional task-listing cap.
   * @param maxListedTasks Maximum task titles to embed (defaults to 20).
   */
  public constructor(maxListedTasks: number = MAX_LISTED_TASKS) {
    this.maxListedTasks = maxListedTasks;
  }

  /**
   * Build the execution prompt for a spec.
   * @param specName The spec name.
   * @param pendingTaskTitles Titles of the not-yet-done leaf tasks, in order.
   * @returns The ready-to-paste prompt text.
   */
  public build(specName: string, pendingTaskTitles: readonly string[]): string {
    const listed = pendingTaskTitles.slice(0, this.maxListedTasks);
    const bullets = listed.map((title) => `- ${title}`).join('\n');
    const header = `Execute the remaining tasks of the Kiro spec "${specName}" in order.`;
    if (0 === listed.length) {
      return `${header}\nAll tasks are already completed.`;
    }
    return `${header}\nRemaining tasks:\n${bullets}`;
  }
}
