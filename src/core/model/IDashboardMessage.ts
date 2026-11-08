import type { RunScope } from '../ports/ISpecAgentGateway';
import type { ISpecCardView } from './ISpecCardView';
import type { ISpecStats } from './ISpecStats';

/** Document keys the webview can request to open. */
export type SpecDocumentKind = 'requirements' | 'design' | 'tasks' | 'notes';

/** Layout modes the dashboard can render. */
export type DashboardLayout = 'list' | 'grid';

/** Outbound message: render the current card views and aggregate stats. */
export interface IRenderMessage {
  readonly type: 'render';
  readonly cards: readonly ISpecCardView[];
  readonly stats: ISpecStats;
}

/** Outbound message: update a single changed card and the aggregate stats. */
export interface ISpecUpdatedMessage {
  readonly type: 'specUpdated';
  readonly card: ISpecCardView;
  readonly stats: ISpecStats;
}

/** Outbound message: toggle the dashboard layout (list <-> grid). */
export interface IToggleLayoutMessage {
  readonly type: 'toggleLayout';
}

/** Inbound message: open one document of a spec. */
export interface IOpenDocumentMessage {
  readonly type: 'openDocument';
  readonly folderPath: string;
  readonly document: SpecDocumentKind;
}

/** Inbound message: run the tasks of a spec for the given scope. */
export interface IRunTasksMessage {
  readonly type: 'runTasks';
  readonly folderPath: string;
  readonly scope: RunScope;
}

/** Inbound message: sync/update the tasks files of a spec. */
export interface ISyncFilesMessage {
  readonly type: 'syncFiles';
  readonly folderPath: string;
}

/** Inbound message: persist the chosen layout. */
export interface ISetLayoutMessage {
  readonly type: 'setLayout';
  readonly layout: DashboardLayout;
}

/**
 * Inbound message: the webview has mounted and wired its message listener.
 *
 * It is posted once on every (re)load of the webview document, which is the
 * signal the host waits for before posting the first `render`. VS Code disposes
 * and re-creates the webview when the view is hidden and shown again, so the
 * reopened document boots with an empty DOM; this handshake lets the host
 * (re)send the current cached state without racing the script boot.
 */
export interface IReadyMessage {
  readonly type: 'ready';
}

/** Union of messages the extension sends to the webview. */
export type DashboardOutboundMessage = IRenderMessage | IToggleLayoutMessage | ISpecUpdatedMessage;

/** Union of messages the webview sends back to the extension. */
export type DashboardInboundMessage =
  | IOpenDocumentMessage
  | IRunTasksMessage
  | ISyncFilesMessage
  | ISetLayoutMessage
  | IReadyMessage;
