import { expect } from 'chai';
import type {
  DashboardOutboundMessage,
  IIntroductionMessage,
  IRenderMessage,
  ISpecUpdatedMessage,
  IStringsMessage,
} from '../../src/core/model/IDashboardMessage';
import { routeDashboardMessage } from '../../src/webview/DashboardMessageRouter';
import type { IDashboardMessageHandlers } from '../../src/webview/DashboardMessageRouter';

/** Handlers recording which message reached which handler. */
function recordingHandlers(calls: unknown[][]): IDashboardMessageHandlers {
  return {
    strings: (message) => calls.push(['strings', message]),
    render: (message) => calls.push(['render', message]),
    specUpdated: (message) => calls.push(['specUpdated', message]),
    toggleLayout: () => calls.push(['toggleLayout']),
    introduction: (message) => calls.push(['introduction', message]),
  };
}

describe('routeDashboardMessage', () => {
  const strings: IStringsMessage = { type: 'strings', language: 'en', messages: {} };
  const render = { type: 'render' } as IRenderMessage;
  const specUpdated = { type: 'specUpdated' } as ISpecUpdatedMessage;
  const introduction: IIntroductionMessage = {
    type: 'introduction',
    folderPath: '/ws/.kiro/specs/a',
    introduction: 'hi',
  };

  it('routes each message to its own handler with its payload, once', () => {
    const calls: unknown[][] = [];
    const handlers = recordingHandlers(calls);
    [strings, render, specUpdated, { type: 'toggleLayout' }, introduction].forEach((message) =>
      routeDashboardMessage(message as DashboardOutboundMessage, handlers),
    );
    expect(calls).to.deep.equal([
      ['strings', strings],
      ['render', render],
      ['specUpdated', specUpdated],
      ['toggleLayout'],
      ['introduction', introduction],
    ]);
  });

  it('ignores an unknown message type', () => {
    const calls: unknown[][] = [];
    routeDashboardMessage(
      { type: 'bogus' } as unknown as DashboardOutboundMessage,
      recordingHandlers(calls),
    );
    expect(calls).to.deep.equal([]);
  });
});
