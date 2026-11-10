import type { ExcludeValue } from '../../src/core/hiding/ExcludeReconciler';
import type { ExcludeSettingKey } from '../../src/core/hiding/ExcludeSettingKey';
import { HideSpecsMode } from '../../src/core/hiding/HideSpecsMode';
import { DEFAULT_HIDDEN_STATUSES } from '../../src/core/hiding/HiddenStatusSelection';
import type { SpecChangeDelta } from '../../src/core/model/ISpecChangeDelta';
import type { IHideSpecsConfig } from '../../src/core/model/IHideSpecsConfig';
import type { ISpecSnapshot } from '../../src/core/model/ISpecSnapshot';
import type { IHideSpecsConfigReader } from '../../src/adapters/ports/IHideSpecsConfigReader';
import type {
  IFirstWriteNotice,
  IHiddenSpecsNotifier,
} from '../../src/adapters/ports/IHiddenSpecsNotifier';
import type {
  ISettingsWriter,
  SettingsWriteResult,
} from '../../src/adapters/ports/ISettingsWriter';
import type { ISpecSource } from '../../src/adapters/ports/ISpecSource';

/** One recorded settings write. */
export interface IRecordedWrite {
  readonly workspacePath: string;
  readonly setting: ExcludeSettingKey;
  readonly value: ExcludeValue | undefined;
}

/** Fake spec source whose snapshots and events the test drives. */
export class FakeSpecSource implements ISpecSource {
  /** Snapshots returned by {@link getSpecs}. */
  public specs: readonly ISpecSnapshot[] = [];
  private readonly listeners = new Set<(delta: SpecChangeDelta) => void>();

  public getSpecs(): readonly ISpecSnapshot[] {
    return this.specs;
  }

  public onDidChangeSpecs(listener: (delta: SpecChangeDelta) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Number of active listeners. */
  public get listenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Emit a delta to every listener.
   * @param delta The delta to emit.
   */
  public emit(delta: SpecChangeDelta): void {
    this.listeners.forEach((listener) => listener(delta));
  }
}

/** In-memory settings writer recording every write. */
export class FakeSettingsWriter implements ISettingsWriter {
  /** Writes in call order. */
  public readonly writes: IRecordedWrite[] = [];
  /** When set, writes reject with it. */
  public failWith: Error | undefined;
  /** Folder paths that are not open: writes to them report `folderNotFound`. */
  public readonly missingFolders = new Set<string>();
  private readonly values = new Map<string, ExcludeValue>();

  /**
   * Seed or read a stored value.
   * @param workspacePath The workspace folder path.
   * @param setting The exclusion setting.
   * @param value The value to seed; omit to only read.
   * @returns The stored value.
   */
  public value(
    workspacePath: string,
    setting: ExcludeSettingKey,
    value?: ExcludeValue,
  ): ExcludeValue | undefined {
    if (undefined !== value) {
      this.values.set(`${workspacePath}|${setting}`, value);
    }
    return this.values.get(`${workspacePath}|${setting}`);
  }

  public readExclude(workspacePath: string, setting: ExcludeSettingKey): ExcludeValue | undefined {
    return this.value(workspacePath, setting);
  }

  public async writeExclude(
    workspacePath: string,
    setting: ExcludeSettingKey,
    value: ExcludeValue | undefined,
  ): Promise<SettingsWriteResult> {
    if (undefined !== this.failWith) {
      throw this.failWith;
    }
    if (this.missingFolders.has(workspacePath)) {
      return 'folderNotFound';
    }
    this.writes.push({ workspacePath, setting, value });
    const key = `${workspacePath}|${setting}`;
    if (undefined === value) {
      this.values.delete(key);
      return 'written';
    }
    this.values.set(key, value);
    return 'written';
  }
}

/** Mutable configuration reader. */
export class FakeConfigReader implements IHideSpecsConfigReader {
  /** Configuration returned by {@link read}. */
  public config: IHideSpecsConfig = {
    mode: HideSpecsMode.Off,
    hiddenStatuses: DEFAULT_HIDDEN_STATUSES,
  };

  public read(): IHideSpecsConfig {
    return this.config;
  }
}

/** Notifier recording what it was asked to show. */
export class RecordingNotifier implements IHiddenSpecsNotifier {
  /** First-write notices shown. */
  public readonly firstWrites: IFirstWriteNotice[] = [];
  /** Reset counts shown. */
  public readonly resets: number[] = [];

  public notifyFirstWrite(notice: IFirstWriteNotice): void {
    this.firstWrites.push(notice);
  }

  public notifyReset(removed: number): void {
    this.resets.push(removed);
  }
}
