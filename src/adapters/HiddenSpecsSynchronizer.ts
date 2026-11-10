import { Debouncer } from '../core/Debouncer';
import type { IScheduler } from '../core/ports/IScheduler';
import { ExcludeReconciler } from '../core/hiding/ExcludeReconciler';
import { type ExcludeSettingKey, MANAGED_EXCLUDE_SETTINGS } from '../core/hiding/ExcludeSettingKey';
import { HideSpecsModeMapper } from '../core/hiding/HideSpecsMode';
import { HiddenSpecSelector, type ISkippedSpec } from '../core/hiding/HiddenSpecSelector';
import type { OwnershipRegistry } from '../core/hiding/OwnershipRegistry';
import type { IFirstWriteNoticeLedger } from './ports/IFirstWriteNoticeLedger';
import type { IAgentDiagnosticSink } from './ports/IAgentDiagnosticSink';
import type { IHiddenSpecsNotifier } from './ports/IHiddenSpecsNotifier';
import type { IHideSpecsConfigReader } from './ports/IHideSpecsConfigReader';
import type { IOwnershipStore } from './ports/IOwnershipStore';
import type { ISettingsWriter } from './ports/ISettingsWriter';
import type { ISpecSource } from './ports/ISpecSource';

/** Coalescing window, in milliseconds, for bursts of spec / configuration events. */
export const HIDE_SYNC_DELAY_MS = 400;

/** Debounce key shared by every synchronisation request. */
const SYNC_KEY = 'hideSpecs.sync';

/** Collaborators of {@link HiddenSpecsSynchronizer}. */
export interface IHiddenSpecsDependencies {
  readonly specs: ISpecSource;
  readonly config: IHideSpecsConfigReader;
  readonly writer: ISettingsWriter;
  readonly store: IOwnershipStore;
  readonly ledger: IFirstWriteNoticeLedger;
  readonly notifier: IHiddenSpecsNotifier;
  readonly diagnostics: IAgentDiagnosticSink;
  readonly scheduler: IScheduler;
}

/** Result of applying a desired state to every (workspace, setting) pair. */
interface IApplyOutcome {
  readonly registry: OwnershipRegistry;
  readonly added: number;
  readonly removed: number;
  readonly firstAddedWorkspace: string | undefined;
}

/** Resolves the keys that should be hidden for one (workspace, setting) pair. */
type DesiredResolver = (workspacePath: string, setting: ExcludeSettingKey) => readonly string[];

/**
 * Keeps the exclusion settings of each workspace folder in line with the specs
 * whose status the user chose to hide.
 *
 * It is host-agnostic (every effect goes through a port). Runs are debounced,
 * serialised and idempotent: nothing is written when the settings already match,
 * and each (folder, setting) gets at most one `update`. It only listens to spec
 * and `kirospectracker.hideSpecs` changes (wired by the composition root), never
 * to the exclusion settings it writes, so a write cannot trigger itself.
 */
export class HiddenSpecsSynchronizer {
  private readonly deps: IHiddenSpecsDependencies;
  private readonly debouncer: Debouncer;
  private readonly reconciler = new ExcludeReconciler();
  private readonly selector = new HiddenSpecSelector();
  private readonly modes = new HideSpecsModeMapper();
  private readonly loggedSkips = new Set<string>();
  private readonly loggedMissingFolders = new Set<string>();
  private unsubscribe: (() => void) | undefined;
  private ready = false;
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Build the synchroniser.
   * @param deps The ports it works through.
   */
  public constructor(deps: IHiddenSpecsDependencies) {
    this.deps = deps;
    this.debouncer = new Debouncer(deps.scheduler, HIDE_SYNC_DELAY_MS);
  }

  /** Start listening to spec changes; the first full refresh arms synchronisation. */
  public start(): void {
    this.unsubscribe = this.deps.specs.onDidChangeSpecs((delta) => {
      this.ready = this.ready || 'fullRefresh' === delta.type;
      this.requestSync();
    });
  }

  /** Request a debounced synchronisation (spec or configuration change). */
  public requestSync(): void {
    this.debouncer.schedule(SYNC_KEY, () => {
      void this.sync();
    });
  }

  /**
   * Synchronise now (serialised after any run in flight).
   * @returns A promise settled once the run ended; it never rejects.
   */
  public sync(): Promise<void> {
    return this.enqueue(() => this.runSync());
  }

  /**
   * Remove every entry the extension owns, from every settings file.
   * @returns The number of entries removed.
   */
  public reset(): Promise<number> {
    return this.enqueue(() => this.runReset());
  }

  /** Stop listening and drop any pending run. */
  public dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.debouncer.cancelAll();
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async runSync(): Promise<void> {
    if (!this.ready) {
      return;
    }
    try {
      await this.applyConfiguration();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.deps.diagnostics.append(`Hide specs: synchronisation failed: ${message}`);
    }
  }

  private async applyConfiguration(): Promise<void> {
    const config = this.deps.config.read();
    const registry = this.deps.store.load();
    const target = this.modes.settingFor(config.mode);
    if (undefined === target && registry.isEmpty()) {
      return;
    }
    const snapshots = this.deps.specs.getSpecs();
    const selection =
      undefined === target
        ? { globsByWorkspace: new Map<string, readonly string[]>(), skipped: [] }
        : this.selector.select(snapshots, config.hiddenStatuses);
    this.logSkipped(selection.skipped);
    const workspaces = new Set([
      ...snapshots.map((s) => s.workspacePath),
      ...registry.workspaces(),
    ]);
    const desired: DesiredResolver = (workspacePath, setting) =>
      setting === target ? (selection.globsByWorkspace.get(workspacePath) ?? []) : [];
    const outcome = await this.apply(registry, workspaces, desired);
    await this.announce(outcome, target);
  }

  private async runReset(): Promise<number> {
    const registry = this.deps.store.load();
    const outcome = await this.apply(registry, new Set(registry.workspaces()), () => []);
    this.deps.notifier.notifyReset(outcome.removed);
    return outcome.removed;
  }

  private async apply(
    initial: OwnershipRegistry,
    workspaces: ReadonlySet<string>,
    desired: DesiredResolver,
  ): Promise<IApplyOutcome> {
    let registry = initial;
    let added = 0;
    let removed = 0;
    let firstAddedWorkspace: string | undefined;
    try {
      for (const workspacePath of workspaces) {
        for (const setting of MANAGED_EXCLUDE_SETTINGS) {
          const result = await this.reconcileOne(registry, workspacePath, setting, desired);
          registry = result.registry;
          added += result.added;
          removed += result.removed;
          firstAddedWorkspace =
            firstAddedWorkspace ?? (0 < result.added ? workspacePath : undefined);
        }
      }
    } finally {
      await this.deps.store.save(registry);
    }
    return { registry, added, removed, firstAddedWorkspace };
  }

  private async reconcileOne(
    registry: OwnershipRegistry,
    workspacePath: string,
    setting: ExcludeSettingKey,
    desired: DesiredResolver,
  ): Promise<{ registry: OwnershipRegistry; added: number; removed: number }> {
    const current = this.deps.writer.readExclude(workspacePath, setting);
    const result = this.reconciler.reconcile(
      current,
      registry.keysFor(workspacePath, setting),
      desired(workspacePath, setting),
      registry.withdrawnFor(workspacePath, setting),
    );
    if (result.changed) {
      const outcome = await this.deps.writer.writeExclude(workspacePath, setting, result.value);
      if ('folderNotFound' === outcome) {
        this.logMissingFolder(workspacePath);
        return { registry, added: 0, removed: 0 };
      }
    }
    return {
      registry: registry
        .with(workspacePath, setting, result.owned)
        .withWithdrawn(workspacePath, setting, result.withdrawn),
      added: result.added.length,
      removed: result.removed.length,
    };
  }
  private logMissingFolder(workspacePath: string): void {
    if (this.loggedMissingFolders.has(workspacePath)) {
      return;
    }
    this.loggedMissingFolders.add(workspacePath);
    this.deps.diagnostics.append(
      `Hide specs: "${workspacePath}" is not an open workspace folder; nothing was written for it.`,
    );
  }
  private async announce(
    outcome: IApplyOutcome,
    target: ExcludeSettingKey | undefined,
  ): Promise<void> {
    const { firstAddedWorkspace } = outcome;
    if (undefined === target || undefined === firstAddedWorkspace || this.deps.ledger.wasShown()) {
      return;
    }
    await this.deps.ledger.markShown();
    this.deps.notifier.notifyFirstWrite({
      count: outcome.added,
      setting: target,
      workspacePath: firstAddedWorkspace,
    });
  }

  private logSkipped(skipped: readonly ISkippedSpec[]): void {
    skipped.forEach(({ workspacePath, name }) => {
      const key = `${workspacePath}\u0000${name}`;
      if (this.loggedSkips.has(key)) {
        return;
      }
      this.loggedSkips.add(key);
      this.deps.diagnostics.append(
        `Hide specs: "${name}" cannot be hidden: its name has no reliable exclusion glob.`,
      );
    });
  }
}
