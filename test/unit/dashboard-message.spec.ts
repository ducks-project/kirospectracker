import { expect } from 'chai';

import type {
  DashboardInboundMessage,
  DashboardOutboundMessage,
  IIntroductionMessage,
  IRequestIntroductionMessage,
} from '../../src/core/model/IDashboardMessage';

/**
 * Behaviour specification for the requirements-introduction hover protocol.
 *
 * The protocol is a pair of type-only discriminated-union members: the webview
 * sends {@link IRequestIntroductionMessage} on hover and the host replies with a
 * {@link IIntroductionMessage} correlated by `folderPath`. These assertions pin
 * the discriminants and the correlation contract, and double as a compile-time
 * check that both members belong to their respective unions.
 */
describe('Dashboard introduction hover protocol', () => {
  const folderPath = '/ws/.kiro/specs/alpha';

  it('types the inbound request as a member of the inbound union', () => {
    const request: DashboardInboundMessage = {
      type: 'requestIntroduction',
      folderPath,
    };
    expect(request.type).to.equal('requestIntroduction');
    expect((request as IRequestIntroductionMessage).folderPath).to.equal(folderPath);
  });

  it('types the outbound reply as a member of the outbound union', () => {
    const reply: DashboardOutboundMessage = {
      type: 'introduction',
      folderPath,
      introduction: 'The intro.',
    };
    expect(reply.type).to.equal('introduction');
    expect((reply as IIntroductionMessage).introduction).to.equal('The intro.');
  });

  it('correlates a reply to its request by folderPath', () => {
    const request: IRequestIntroductionMessage = { type: 'requestIntroduction', folderPath };
    const reply: IIntroductionMessage = {
      type: 'introduction',
      folderPath: request.folderPath,
      introduction: undefined,
    };
    expect(reply.folderPath).to.equal(request.folderPath);
  });

  it('carries an undefined introduction when none can be derived', () => {
    const reply: IIntroductionMessage = {
      type: 'introduction',
      folderPath,
      introduction: undefined,
    };
    expect(reply.introduction).to.equal(undefined);
  });
});
