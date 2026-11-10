import type { ISpecSnapshot } from '../model/ISpecSnapshot';
import type { SpecStatus } from '../model/SpecStatus';
import { SpecExcludeGlob } from './SpecExcludeGlob';

/** A spec that should be hidden but whose name cannot be written as a glob. */
export interface ISkippedSpec {
  /** Absolute path of the owning workspace folder. */
  readonly workspacePath: string;
  /** Spec folder name. */
  readonly name: string;
}

/** Outcome of selecting the specs to hide. */
export interface IHiddenSpecSelection {
  /** Exclusion globs to write, grouped by owning workspace folder path. */
  readonly globsByWorkspace: ReadonlyMap<string, readonly string[]>;
  /** Selected specs ignored because their name has no reliable glob. */
  readonly skipped: readonly ISkippedSpec[];
}

/**
 * Pure selector choosing which specs are hidden for a set of statuses.
 */
export class HiddenSpecSelector {
  private readonly glob: SpecExcludeGlob;

  /**
   * Build the selector.
   * @param glob The glob builder (defaults to a new {@link SpecExcludeGlob}).
   */
  public constructor(glob: SpecExcludeGlob = new SpecExcludeGlob()) {
    this.glob = glob;
  }

  /**
   * Select the globs of every spec whose status is in `statuses`.
   * @param snapshots The known spec snapshots.
   * @param statuses The statuses to hide.
   * @returns The globs per workspace folder and the specs that had to be skipped.
   */
  public select(
    snapshots: readonly ISpecSnapshot[],
    statuses: ReadonlySet<SpecStatus>,
  ): IHiddenSpecSelection {
    const globsByWorkspace = new Map<string, string[]>();
    const skipped: ISkippedSpec[] = [];
    snapshots
      .filter((snapshot) => statuses.has(snapshot.status))
      .forEach((snapshot) => {
        const glob = this.glob.build(snapshot.name);
        if (undefined === glob) {
          skipped.push({ workspacePath: snapshot.workspacePath, name: snapshot.name });
          return;
        }
        const globs = globsByWorkspace.get(snapshot.workspacePath) ?? [];
        globs.push(glob);
        globsByWorkspace.set(snapshot.workspacePath, globs);
      });
    return { globsByWorkspace, skipped };
  }
}
