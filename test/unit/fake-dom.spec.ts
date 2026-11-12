import { expect } from 'chai';
import { createFakeDocument } from '../helpers/fake-dom/FakeDocument';
import { createFakeEvent } from '../helpers/fake-dom/FakeEvent';
import { createFakeWindow } from '../helpers/fake-dom/FakeWindow';
import { ManualClock } from '../helpers/dashboard-harness/ManualClock';

/** Fresh window and document sharing one effect timeline. */
function createPage(): {
  document: ReturnType<typeof createFakeDocument>;
  timeline: string[];
} {
  const timeline: string[] = [];
  const window = createFakeWindow('vscode-webview://test');
  return { document: createFakeDocument(window, timeline), timeline };
}

/**
 * The fake DOM is the foundation of the dashboard safety net: it must fail loudly
 * on anything it does not model, and behave like a browser on what it does.
 */
describe('fake DOM used by the dashboard harness', () => {
  it('throws on a member it does not model instead of returning undefined', () => {
    const { document } = createPage();
    const element = document.createElement('div');
    expect(() => (element as unknown as { innerHTML: string }).innerHTML).to.throw(
      'Unsupported DOM API',
    );
    expect(() => {
      (element as unknown as { innerHTML: string }).innerHTML = '<b>x</b>';
    }).to.throw('Unsupported DOM API');
    expect(() => (document as unknown as { cookie: string }).cookie).to.throw(
      'Unsupported DOM API',
    );
  });

  it('throws on a style property and a class token it does not model', () => {
    const { document } = createPage();
    const element = document.createElement('div');
    expect(() => {
      (element.style as unknown as { color: string }).color = 'red';
    }).to.throw('Unsupported DOM API');
    expect(() => element.classList.add('two words')).to.throw('Invalid class token');
  });

  it('throws on selectors outside the supported subset', () => {
    const { document } = createPage();
    ['a > b', 'a + b', 'a:hover', '*', '[data-x^="y"]', ''].forEach((selector) => {
      expect(() => document.querySelector(selector), selector).to.throw(/Unsupported selector/);
    });
  });

  it('matches tags, ids, classes, attributes, descendants and lists in document order', () => {
    const { document } = createPage();
    const app = document.getElementById('app');
    const outer = document.createElement('section');
    outer.className = 'outer wide';
    const inner = document.createElement('button');
    inner.className = 'inner';
    inner.setAttribute('aria-expanded', 'true');
    outer.appendChild(inner);
    app?.appendChild(outer);
    expect(document.querySelector('.outer .inner')).to.equal(inner);
    expect(document.querySelector('section.wide button[aria-expanded="true"]')).to.equal(inner);
    expect(document.querySelector('.inner[aria-expanded="false"]')).to.equal(null);
    expect(document.querySelectorAll('.inner, .outer')).to.deep.equal([outer, inner]);
    expect(inner.closest('.outer')).to.equal(outer);
    expect(inner.closest('.nothing')).to.equal(null);
  });

  it('dispatches capture, target and bubble listeners in browser order', () => {
    const { document } = createPage();
    const button = document.createElement('button');
    document.body.appendChild(button);
    const seen: string[] = [];
    document.addEventListener('click', () => seen.push('document-bubble'));
    document.addEventListener('click', () => seen.push('document-capture'), { capture: true });
    document.body.addEventListener('click', () => seen.push('body-bubble'));
    button.addEventListener('click', () => seen.push('target'));
    button.dispatchEvent(createFakeEvent('click', { bubbles: true }));
    expect(seen).to.deep.equal(['document-capture', 'target', 'body-bubble', 'document-bubble']);
  });

  it('stops propagation after the current node, and not for non-bubbling events', () => {
    const { document } = createPage();
    const button = document.createElement('button');
    document.body.appendChild(button);
    const seen: string[] = [];
    button.addEventListener('click', (event) => {
      seen.push('first');
      event.stopPropagation();
    });
    button.addEventListener('click', () => seen.push('second'));
    document.addEventListener('click', () => seen.push('document'));
    button.dispatchEvent(createFakeEvent('click', { bubbles: true }));
    document.addEventListener('mouseenter', () => seen.push('mouseenter-bubbled'));
    button.dispatchEvent(createFakeEvent('mouseenter'));
    expect(seen).to.deep.equal(['first', 'second']);
  });

  it('rejects unknown listener options', () => {
    const { document } = createPage();
    expect(() => document.addEventListener('click', () => undefined, { once: true })).to.throw(
      'Unsupported DOM API',
    );
  });

  it('moves a node out of its previous parent and records connected mutations', () => {
    const { document, timeline } = createPage();
    const first = document.createElement('div');
    const second = document.createElement('div');
    const child = document.createElement('span');
    first.appendChild(child);
    expect(timeline).to.deep.equal([]);
    document.body.appendChild(first);
    document.body.appendChild(second);
    second.appendChild(child);
    expect(first.childNodes).to.have.length(0);
    expect(child.parentElement).to.equal(second);
    expect(timeline).to.deep.equal(['dom']);
  });

  it('fires blur then focus, ignores hidden or unfocusable elements, and falls back to body', () => {
    const { document, timeline } = createPage();
    const one = document.createElement('button');
    const two = document.createElement('button');
    const plain = document.createElement('div');
    [one, two, plain].forEach((node) => document.body.appendChild(node));
    one.focus();
    two.focus();
    plain.focus();
    expect(document.activeElement).to.equal(two);
    expect(timeline.filter((entry) => !entry.startsWith('dom'))).to.deep.equal([
      'focus button',
      'blur button',
      'focus button',
    ]);
    two.hidden = true;
    expect(document.activeElement).to.equal(document.body);
    two.hidden = false;
    one.focus();
    document.body.replaceChildren();
    expect(document.activeElement).to.equal(document.body);
  });

  it('runs manual timers in due order and honours cancellation', () => {
    const clock = new ManualClock();
    const ran: string[] = [];
    clock.setTimeout(() => ran.push('late'), 200);
    clock.setTimeout(() => ran.push('early'), 100);
    const cancelled = clock.setTimeout(() => ran.push('cancelled'), 100);
    clock.clearTimeout(cancelled);
    clock.advance(99);
    expect(ran).to.deep.equal([]);
    clock.advance(1);
    expect(ran).to.deep.equal(['early']);
    expect(clock.pendingDelays()).to.deep.equal([100]);
    clock.advance(100);
    expect(ran).to.deep.equal(['early', 'late']);
    expect(() => clock.setTimeout('code', 0)).to.throw('Unsupported DOM API');
  });
});
