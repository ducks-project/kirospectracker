/** Port remembering whether the "specs hidden" notice has already been shown. */
export interface IFirstWriteNoticeLedger {
  /**
   * Whether the notice was already shown.
   * @returns `true` once shown.
   */
  wasShown(): boolean;
  /** Record that the notice was shown. */
  markShown(): Promise<void>;
}
