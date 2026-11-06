/**
 * Fine-grained delta describing a single scoped spec change.
 *
 * Carrying the affected spec's folder path lets listeners re-process only that
 * spec instead of fanning out over every cached snapshot.
 */
export interface ISpecChangedDelta {
  /** Discriminant selecting the scoped-change branch. */
  readonly type: 'specChanged';

  /** Absolute path of the spec folder whose cached snapshot changed. */
  readonly folderPath: string;
}

/**
 * Delta describing a full cache (re)population.
 *
 * Emitted on mount and on a full re-discovery, where listeners must re-process
 * every snapshot because the whole set may have changed.
 */
export interface ISpecFullRefreshDelta {
  /** Discriminant selecting the full-refresh branch. */
  readonly type: 'fullRefresh';
}

/**
 * Discriminated union carried by the repository change event.
 *
 * It replaces the former payloadless callback so the dashboard and decoration
 * providers can react incrementally to a scoped change while still handling a
 * full refresh.
 */
export type SpecChangeDelta = ISpecChangedDelta | ISpecFullRefreshDelta;
