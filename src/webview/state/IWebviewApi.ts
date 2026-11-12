import type { DashboardInboundMessage, DashboardLayout } from '../../core/model/IDashboardMessage';
import type { SpecFilterKey } from '../../core/model/SpecFilterKey';

/** Persisted webview state surviving re-renders and view reloads. */
export interface IWebviewState {
  readonly layout?: DashboardLayout;
  readonly filterKeys?: readonly SpecFilterKey[];
  readonly folderKeys?: readonly string[];
}

/** Minimal shape of the VS Code webview API injected into the global scope. */
export interface IWebviewApi {
  postMessage(message: DashboardInboundMessage): void;
  getState(): IWebviewState | undefined;
  setState(state: IWebviewState): void;
}
