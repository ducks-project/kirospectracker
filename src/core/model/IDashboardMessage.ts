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

/** Inbound message: run the tasks of a spec. */
export interface IRunTasksMessage {
  readonly type: 'runTasks';
  readonly folderPath: string;
}

/** Inbound message: persist the chosen layout. */
export interface ISetLayoutMessage {
  readonly type: 'setLayout';
  readonly layout: DashboardLayout;
}

/** Union of messages the extension sends to the webview. */
export type DashboardOutboundMessage = IRenderMessage | IToggleLayoutMessage | ISpecUpdatedMessage;

/** Union of messages the webview sends back to the extension. */
export type DashboardInboundMessage = IOpenDocumentMessage | IRunTasksMessage | ISetLayoutMessage;
