import type { IRenderMessage } from '../../../src/core/model/IDashboardMessage';
import type { IGlobalTaskStats } from '../../../src/core/model/IGlobalTaskStats';
import type { ISpecCardView } from '../../../src/core/model/ISpecCardView';
import type { ISpecDocuments } from '../../../src/core/model/ISpecDocuments';
import type { ISpecProgress } from '../../../src/core/model/ISpecProgress';
import type { ISpecStats } from '../../../src/core/model/ISpecStats';
import type { SpecDocumentKind } from '../../../src/core/model/SpecDocumentKind';
import { SpecStatus } from '../../../src/core/model/SpecStatus';

/** First workspace folder of the fixtures. */
export const FOLDER_A = '/work/alpha-app';
/** Second workspace folder of the fixtures. */
export const FOLDER_B = '/work/beta-lib';
/** Third workspace folder, used by the large generated set. */
export const FOLDER_C = '/work/gamma-tool';

/** Path of the spec folder of a fixture card. */
export function specPath(folder: string, name: string): string {
  return `${folder}/.kiro/specs/${name}`;
}

/** Counts a progress fixture is built from (every omitted count is zero). */
export interface IProgressCounts {
  readonly requiredDone?: number;
  readonly requiredCancelled?: number;
  readonly requiredInProgress?: number;
  readonly requiredTodo?: number;
  readonly optionalDone?: number;
  readonly optionalCancelled?: number;
  readonly optionalInProgress?: number;
  readonly optionalTodo?: number;
}

/**
 * Build a consistent progress value from per-state counts.
 * @param counts Per-state counts.
 * @returns The progress.
 */
export function progress(counts: IProgressCounts = {}): ISpecProgress {
  const rDone = counts.requiredDone ?? 0;
  const rCancelled = counts.requiredCancelled ?? 0;
  const rInProgress = counts.requiredInProgress ?? 0;
  const rTodo = counts.requiredTodo ?? 0;
  const oDone = counts.optionalDone ?? 0;
  const oCancelled = counts.optionalCancelled ?? 0;
  const oInProgress = counts.optionalInProgress ?? 0;
  const oTodo = counts.optionalTodo ?? 0;
  const rTotal = rDone + rCancelled + rInProgress + rTodo;
  const oTotal = oDone + oCancelled + oInProgress + oTodo;
  return {
    requiredDone: rDone + rCancelled,
    requiredTotal: rTotal,
    optionalDone: oDone + oCancelled,
    optionalTotal: oTotal,
    requiredRatio: 0 === rTotal ? 0 : (rDone + rCancelled) / rTotal,
    optionalRatio: 0 === oTotal ? 0 : (oDone + oCancelled) / oTotal,
    requiredResolvedDone: rDone,
    requiredResolvedCancelled: rCancelled,
    requiredInProgress: rInProgress,
    requiredTodo: rTodo,
    optionalResolvedDone: oDone,
    optionalResolvedCancelled: oCancelled,
    optionalInProgress: oInProgress,
    optionalTodo: oTodo,
  };
}

/**
 * Presence flags listing the given documents.
 * @param kinds The documents that exist.
 * @returns The presence flags.
 */
export function documents(...kinds: SpecDocumentKind[]): ISpecDocuments {
  return {
    requirements: kinds.includes('requirements'),
    design: kinds.includes('design'),
    tasks: kinds.includes('tasks'),
    notes: kinds.includes('notes'),
    bugfix: kinds.includes('bugfix'),
  };
}

/** Everything that varies between fixture cards. */
export interface ICardSpec {
  readonly name: string;
  readonly folder: string;
  readonly status: SpecStatus;
  readonly docs: readonly SpecDocumentKind[];
  readonly entry: SpecDocumentKind | undefined;
  readonly counts?: IProgressCounts;
}

/**
 * Build a card view.
 * @param spec The varying parts.
 * @returns The card.
 */
export function card(spec: ICardSpec): ISpecCardView {
  return {
    name: spec.name,
    folderPath: specPath(spec.folder, spec.name),
    folderKey: spec.folder,
    ownerLabel: spec.folder.slice(spec.folder.lastIndexOf('/') + 1),
    documents: documents(...spec.docs),
    status: spec.status,
    progress: progress(spec.counts),
    entryDocument: spec.entry,
  };
}

/** Alpha: in progress, every state present, several documents, entry `requirements`. */
export const ALPHA = card({
  name: 'alpha',
  folder: FOLDER_A,
  status: SpecStatus.InProgress,
  docs: ['requirements', 'design', 'tasks'],
  entry: 'requirements',
  counts: { requiredDone: 3, requiredCancelled: 1, requiredInProgress: 1, requiredTodo: 2 },
});
/** Beta: not started, tasks only. */
export const BETA = card({
  name: 'beta',
  folder: FOLDER_A,
  status: SpecStatus.NotStarted,
  docs: ['tasks'],
  entry: 'tasks',
  counts: { requiredTodo: 4, optionalTodo: 1 },
});
/** Gamma: completed, in the second folder. */
export const GAMMA = card({
  name: 'gamma',
  folder: FOLDER_B,
  status: SpecStatus.Completed,
  docs: ['requirements', 'design', 'tasks'],
  entry: 'requirements',
  counts: { requiredDone: 5, optionalTodo: 2 },
});
/** Delta: fully completed, optional tasks done too. */
export const DELTA = card({
  name: 'delta',
  folder: FOLDER_B,
  status: SpecStatus.FullyCompleted,
  docs: ['requirements', 'tasks'],
  entry: 'requirements',
  counts: { requiredDone: 2, optionalDone: 1, optionalCancelled: 1 },
});
/** Epsilon: malformed and without any document or entry document. */
export const EPSILON = card({
  name: 'epsilon',
  folder: FOLDER_A,
  status: SpecStatus.Malformed,
  docs: [],
  entry: undefined,
});
/** Zeta: only a notes annex, so no entry document (disabled card, no preview). */
export const ZETA = card({
  name: 'zeta',
  folder: FOLDER_B,
  status: SpecStatus.NotStarted,
  docs: ['notes'],
  entry: undefined,
});
/** Eta: a bugfix spec with singular counts (one done, one cancelled). */
export const ETA = card({
  name: 'eta',
  folder: FOLDER_A,
  status: SpecStatus.InProgress,
  docs: ['bugfix', 'tasks'],
  entry: 'bugfix',
  counts: { requiredDone: 1, requiredCancelled: 1, requiredTodo: 1 },
});
/** Theta: malformed yet with a readable tasks file and an entry document. */
export const THETA = card({
  name: 'theta',
  folder: FOLDER_B,
  status: SpecStatus.Malformed,
  docs: ['tasks'],
  entry: 'tasks',
});
/** Iota: a name full of markup characters, which must stay inert text. */
export const IOTA = card({
  name: 'iota <b>"&"</b>',
  folder: FOLDER_B,
  status: SpecStatus.NotStarted,
  docs: ['design'],
  entry: 'design',
});

/** The full fixture set: every status, malformed, no entry document, two folders. */
export const FULL_CARDS: readonly ISpecCardView[] = [
  ALPHA,
  BETA,
  GAMMA,
  DELTA,
  EPSILON,
  ZETA,
  ETA,
  THETA,
  IOTA,
];
/** A small set (active and completed groups, two folders) for interaction scenarios. */
export const SMALL_CARDS: readonly ISpecCardView[] = [ALPHA, BETA, GAMMA];

/**
 * Aggregate counts of a set of cards.
 * @param cards The cards.
 * @returns The stats.
 */
export function statsOf(cards: readonly ISpecCardView[]): ISpecStats {
  const count = (...statuses: SpecStatus[]): number =>
    cards.filter((candidate) => statuses.includes(candidate.status)).length;
  return {
    total: cards.length,
    completed: count(SpecStatus.Completed, SpecStatus.FullyCompleted),
    inProgress: count(SpecStatus.InProgress),
    notStarted: count(SpecStatus.NotStarted),
    malformed: count(SpecStatus.Malformed),
  };
}

/** Global task stats used by every fixture render (values are arbitrary but fixed). */
export const GLOBAL_TASK_STATS: IGlobalTaskStats = {
  done: 12,
  cancelled: 1,
  inProgress: 2,
  todo: 9,
  total: 24,
  percentComplete: 0.5416666667,
};

/**
 * A `render` message for a set of cards.
 * @param cards The cards.
 * @param globalTaskStats Global task stats (defaults to {@link GLOBAL_TASK_STATS}).
 * @returns The message.
 */
export function renderMessage(
  cards: readonly ISpecCardView[],
  globalTaskStats: IGlobalTaskStats = GLOBAL_TASK_STATS,
): IRenderMessage {
  return { type: 'render', cards, stats: statsOf(cards), globalTaskStats };
}

/**
 * A large generated set of cards (cost scenario).
 * @param count Number of cards.
 * @returns The cards, cycling through statuses, folders and entry documents.
 */
export function generatedCards(count: number): readonly ISpecCardView[] {
  const statuses = Object.values(SpecStatus);
  const folders = [FOLDER_A, FOLDER_B, FOLDER_C];
  const kinds: SpecDocumentKind[] = ['requirements', 'design', 'tasks', 'notes', 'bugfix'];
  return Array.from({ length: count }, (_unused, index) =>
    card({
      name: `spec-${String(index).padStart(3, '0')}`,
      folder: folders[index % folders.length],
      status: statuses[index % statuses.length],
      docs: kinds.slice(0, 1 + (index % kinds.length)),
      entry: 0 === index % 7 ? undefined : kinds[index % 3],
      counts: { requiredDone: index % 4, requiredInProgress: index % 2, requiredTodo: index % 3 },
    }),
  );
}
