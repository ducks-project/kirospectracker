import { expect } from 'chai';
import { DomHoverPanelView } from '../../src/webview/DomHoverPanelView';
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
  public readonly style = { left: '', top: '' };
  public readonly attributes = new Map<string, string>();
  public children: unknown[] = [];
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public replaceChildren(...nodes: unknown[]): void {
    this.children = nodes;
  }
}

/** Fake DOM exposing one anchor at a fixed rectangle. */
class FakeDom implements IHoverDom {
  public readonly panels: FakePanel[] = [];
  public mounted: IHoverPanelElement[] = [];
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
  public viewport(): { width: number; height: number } {
    return this.size;
  }
}

const anchorAt = (left: number, bottom: number): IHoverAnchor => ({
  getBoundingClientRect: () => ({ left, bottom }),
});

describe('DomHoverPanelView', () => {
  it('creates, mounts, fills, shows and positions the panel when the anchor exists', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(20, 100)]]));
    new DomHoverPanelView(dom).showText('/a', 'Alpha intro');
    const panel = dom.panels[0];
    expect(dom.mounted).to.deep.equal([panel]);
    expect(panel.attributes.get('role')).to.equal('tooltip');
    expect(panel.hidden).to.equal(false);
    expect(panel.children).to.deep.equal([{ text: 'Alpha intro' }]);
    expect(panel.style.left).to.equal('20px');
    expect(panel.style.top).to.equal('108px');
  });

  it('does nothing when the anchor is not rendered', () => {
    const dom = new FakeDom(new Map());
    new DomHoverPanelView(dom).showText('/missing', 'x');
    expect(dom.panels).to.have.length(0);
  });

  it('reuses one panel across shows and hides it', () => {
    const dom = new FakeDom(new Map([['/a', anchorAt(0, 0)]]));
    const view = new DomHoverPanelView(dom);
    view.showText('/a', 'one');
    view.showText('/a', 'two');
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
    new DomHoverPanelView(dom).showText('/a', 'x');
    expect(dom.panels[0].style.left).to.equal('292px');
    expect(dom.panels[0].style.top).to.equal('242px');
  });
});
