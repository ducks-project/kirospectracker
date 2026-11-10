import { expect } from 'chai';
import { DomHoverPanelView } from '../../src/webview/DomHoverPanelView';
import type { IHoverRect } from '../../src/webview/computeHoverPlacement';
import type {
  IHoverAnchor,
  IHoverDom,
  IHoverPanelElement,
} from '../../src/webview/DomHoverPanelView';

/** Fake panel element recording what the adapter does to it. */
class FakePanel implements IHoverPanelElement {
  public hidden = false;
  public offsetWidth = 100;
  public offsetHeight = 50;
  public readonly props = new Map<string, string>();
  public readonly style = {
    left: '',
    top: '',
    setProperty: (name: string, value: string): void => {
      this.props.set(name, value);
    },
  };
  public readonly attributes = new Map<string, string>();
  public children: unknown[] = [];
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  public replaceChildren(...nodes: unknown[]): void {
    this.children = nodes;
  }
}

/** Fake DOM exposing one anchor at a fixed rectangle. */
class FakeDom implements IHoverDom {
  public readonly panels: FakePanel[] = [];
  public mounted: IHoverPanelElement[] = [];
  public focusInside = false;
  public constructor(
    private readonly anchors: Map<string, IHoverAnchor>,
    private readonly size = { width: 400, height: 300 },
  ) {}
  public findAnchor(folderPath: string): IHoverAnchor | undefined {
    return this.anchors.get(folderPath);
  }
  public createPanel(): IHoverPanelElement {
    const panel = new FakePanel();
    this.panels.push(panel);
    return panel;
  }
  public mountPanel(panel: IHoverPanelElement): void {
    this.mounted.push(panel);
  }
  public createIntro(text: string): unknown {
    return { text };
  }
  public createCloseButton(): unknown {
    return { close: true };
  }
  public isFocusInside(): boolean {
    return this.focusInside;
  }
  public viewport(): { width: number; height: number } {
    return this.size;
  }
}

/** Fake card recording its attributes. */
class FakeAnchor implements IHoverAnchor {
  public readonly attributes = new Map<string, string>();
  public focusCount = 0;
  public constructor(private readonly rect: IHoverRect) {}
  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  public focus(): void {
    this.focusCount += 1;
  }
  public getBoundingClientRect(): IHoverRect {
    return this.rect;
  }
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
}
const anchorAt = (left: number, bottom: number): FakeAnchor =>
  new FakeAnchor({ left, right: left + 100, top: bottom - 50, bottom });

describe('DomHoverPanelView', () => {
  it('creates, mounts, fills, shows and positions the panel when the anchor exists', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(20, 100)]]));
    new DomHoverPanelView(dom).showText('/a', 'Alpha intro', false);
    const panel = dom.panels[0];
    expect(dom.mounted).to.deep.equal([panel]);
    expect(panel.attributes.get('role')).to.equal('tooltip');
    expect(panel.hidden).to.equal(false);
    expect(panel.children).to.deep.equal([{ text: 'Alpha intro' }]);
    expect(panel.style.left).to.equal('20px');
    expect(panel.style.top).to.equal('108px');
    expect(panel.attributes.get('id')).to.equal('card-hover-panel');
    expect(panel.attributes.get('data-side')).to.equal('below');
    expect(panel.props.get('--arrow-left')).to.equal('50px');
  });
  it('flips above near the bottom of the viewport', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(20, 290)]]));
    new DomHoverPanelView(dom).showText('/a', 'x', false);
    expect(dom.panels[0].attributes.get('data-side')).to.equal('above');
  });
  it('sets aria-describedby on the card and removes it on hide', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', false);
    expect(anchor.attributes.get('aria-describedby')).to.equal('card-hover-panel');
    view.hide();
    expect(anchor.attributes.has('aria-describedby')).to.equal(false);
  });
  it('moves aria-describedby when shown for another card', () => {
    const first = anchorAt(0, 100);
    const second = anchorAt(0, 200);
    const dom = new FakeDom(
      new Map([
        ['/a', first],
        ['/b', second],
      ]),
    );
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', false);
    view.showText('/b', 'y', false);
    expect(first.attributes.has('aria-describedby')).to.equal(false);
    expect(second.attributes.has('aria-describedby')).to.equal(true);
  });

  it('does nothing when the anchor is not rendered', () => {
    const dom = new FakeDom(new Map());
    new DomHoverPanelView(dom).showText('/missing', 'x', false);
    expect(dom.panels).to.have.length(0);
  });

  it('reuses one panel across shows and hides it', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(0, 0)]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'one', false);
    view.showText('/a', 'two', false);
    expect(dom.panels).to.have.length(1);
    view.hide();
    expect(dom.panels[0].hidden).to.equal(true);
  });

  it('hide is a no-op before any panel exists', () => {
    const dom = new FakeDom(new Map());
    new DomHoverPanelView(dom).hide();
    expect(dom.panels).to.have.length(0);
  });

  it('clamps the panel inside the viewport', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(390, 290)]]));
    new DomHoverPanelView(dom).showText('/a', 'x', false);
    expect(dom.panels[0].style.left).to.equal('292px');
    expect(dom.panels[0].style.top).to.equal('182px');
  });
  it('shows hover mode as an inert tooltip described from the icon', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    new DomHoverPanelView(dom).showText('/a', 'x', false);
    const panel = dom.panels[0];
    expect(panel.attributes.get('role')).to.equal('tooltip');
    expect(panel.attributes.get('data-pinned')).to.equal('false');
    expect(panel.attributes.has('aria-label')).to.equal(false);
    expect(panel.children).to.deep.equal([{ text: 'x' }]);
    expect(anchor.attributes.get('aria-expanded')).to.equal('false');
    expect(anchor.attributes.has('aria-controls')).to.equal(false);
  });
  it('shows pinned mode as a labelled group with a close button controlled by the icon', () => {
    const anchor = anchorAt(20, 100);
    anchor.setAttribute('aria-label', 'Preview alpha');
    const dom = new FakeDom(new Map([['/a', anchor]]));
    new DomHoverPanelView(dom).showText('/a', 'x', true);
    const panel = dom.panels[0];
    expect(panel.attributes.get('role')).to.equal('group');
    expect(panel.attributes.get('aria-label')).to.equal('Preview alpha');
    expect(panel.attributes.get('data-pinned')).to.equal('true');
    expect(panel.children).to.deep.equal([{ text: 'x' }, { close: true }]);
    expect(anchor.attributes.get('aria-expanded')).to.equal('true');
    expect(anchor.attributes.get('aria-controls')).to.equal('card-hover-panel');
    expect(anchor.attributes.has('aria-describedby')).to.equal(false);
  });
  it('goes back to hover mode when re-shown unpinned', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', true);
    view.showText('/a', 'x', false);
    expect(dom.panels[0].attributes.get('role')).to.equal('tooltip');
    expect(dom.panels[0].children).to.have.length(1);
    expect(anchor.attributes.get('aria-describedby')).to.equal('card-hover-panel');
    expect(anchor.attributes.has('aria-controls')).to.equal(false);
  });
  it('resets the icon expanded state on hide', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', true);
    view.hide();
    expect(anchor.attributes.get('aria-expanded')).to.equal('false');
    expect(anchor.attributes.has('aria-controls')).to.equal(false);
  });
  it('returns the focus to the icon when a pinned panel holding it is hidden', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', true);
    dom.focusInside = true;
    view.hide();
    expect(anchor.focusCount).to.equal(1);
  });
  it('leaves the focus alone when the pinned panel does not hold it', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', true);
    view.hide();
    expect(anchor.focusCount).to.equal(0);
  });
  it('never steals the focus when hiding a hover-mode panel', () => {
    const anchor = anchorAt(20, 100);
    const dom = new FakeDom(new Map([['/a', anchor]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'x', false);
    dom.focusInside = true;
    view.hide();
    expect(anchor.focusCount).to.equal(0);
  });
  it('anchors the placement on the small icon rectangle', () => {
    const icon = new FakeAnchor({ left: 100, right: 124, top: 40, bottom: 64 });
    const dom = new FakeDom(new Map([['/a', icon]]));
    new DomHoverPanelView(dom).showText('/a', 'x', false);
    expect(dom.panels[0].style.left).to.equal('100px');
    expect(dom.panels[0].style.top).to.equal('72px');
    expect(dom.panels[0].props.get('--arrow-left')).to.equal('14px');
  });
});
