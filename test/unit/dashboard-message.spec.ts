import { expect } from 'chai';

import type {
  DashboardInboundMessage,
  DashboardOutboundMessage,
  IIntroductionMessage,
  IRequestIntroductionMessage,
  IStringsMessage,
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
  it('types openDocument with the bugfix kind', () => {
    const open: DashboardInboundMessage = { type: 'openDocument', folderPath, document: 'bugfix' };
    expect(open.type).to.equal('openDocument');
  });
});
/**
 * The host sends its translated catalogue to the webview as a typed message.
 */
describe('Dashboard strings protocol', () => {
  it('types the strings catalogue as a member of the outbound union', () => {
    const strings: DashboardOutboundMessage = {
      type: 'strings',
      language: 'fr',
      messages: { 'Clear search': 'Effacer la recherche' },
    };
    expect(strings.type).to.equal('strings');
    expect((strings as IStringsMessage).messages['Clear search']).to.equal('Effacer la recherche');
  });
});
