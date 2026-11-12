/// <reference lib="dom" />
import { expect } from 'chai';
import { createHoverCloseButton } from '../../src/webview/preview/HoverCloseButton';
import { createPreviewIconButton } from '../../src/webview/preview/PreviewIconButton';
import type { IPreviewIconControls } from '../../src/webview/preview/PreviewIconButton';

/** Minimal fake element recording attributes, listeners and focus. */
class FakeElement {
  public className = '';
  public title = '';
  public textContent = '';
  public readonly attributes = new Map<string, string>();
  public readonly children: unknown[] = [];
  public focused = 0;
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  public appendChild(child: unknown): void {
    this.children.push(child);
  }
  public addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  public focus(): void {
    this.focused += 1;
  }
  public fire(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

/** Fake key event recording propagation and default handling. */
class FakeEvent {
  public stopped = false;
  public prevented = false;
  public constructor(
    public readonly key = '',
    public readonly shiftKey = false,
  ) {}
  public stopPropagation(): void {
    this.stopped = true;
  }
  public preventDefault(): void {
    this.prevented = true;
  }
}

/** Controller double recording calls. */
class RecordingControls implements IPreviewIconControls {
  public readonly calls: string[] = [];
  public enter(folderPath: string): void {
    this.calls.push(`enter:${folderPath}`);
  }
  public leave(): void {
    this.calls.push('leave');
  }
  public togglePin(folderPath: string): void {
    this.calls.push(`toggle:${folderPath}`);
  }
}

describe('preview icon and close buttons', () => {
  const globals = globalThis as unknown as { document?: unknown };
  let original: unknown;
  let queried: Map<string, FakeElement>;
  beforeEach(() => {
    original = globals.document;
    queried = new Map();
    globals.document = {
      createElement: (): FakeElement => new FakeElement(),
      querySelector: (selector: string): FakeElement | null => queried.get(selector) ?? null,
    };
  });
  afterEach(() => {
    globals.document = original;
  });

  const build = (controls: IPreviewIconControls): FakeElement =>
    createPreviewIconButton({
      folderPath: '/a',
      label: 'Preview a',
      glyph: {} as Node,
      controls,
    }) as unknown as FakeElement;

  it('exposes label, collapsed state and decorative glyph', () => {
    const icon = build(new RecordingControls());
    expect(icon.attributes.get('type')).to.equal('button');
    expect(icon.attributes.get('aria-label')).to.equal('Preview a');
    expect(icon.attributes.get('aria-expanded')).to.equal('false');
    expect(icon.children).to.have.length(1);
  });

  it('routes hover and focus to the controller', () => {
    const controls = new RecordingControls();
    const icon = build(controls);
    icon.fire('mouseenter');
    icon.fire('focus');
    icon.fire('mouseleave');
    icon.fire('blur');
    expect(controls.calls).to.deep.equal(['enter:/a', 'enter:/a', 'leave', 'leave']);
  });

  it('click stops propagation and toggles the pin', () => {
    const controls = new RecordingControls();
    const icon = build(controls);
    const event = new FakeEvent();
    icon.fire('click', event);
    expect(event.stopped).to.equal(true);
    expect(controls.calls).to.deep.equal(['toggle:/a']);
  });

  it('Enter and Space keydown do not reach the card', () => {
    const icon = build(new RecordingControls());
    for (const key of ['Enter', ' ']) {
      const event = new FakeEvent(key);
      icon.fire('keydown', event);
      expect(event.stopped, key).to.equal(true);
      expect(event.prevented, key).to.equal(false);
    }
    const other = new FakeEvent('a');
    icon.fire('keydown', other);
    expect(other.stopped).to.equal(false);
  });

  it('Tab on an expanded icon moves the focus to the close button', () => {
    const icon = build(new RecordingControls());
    const close = new FakeElement();
    queried.set('#card-hover-panel .card-hover-close', close);
    icon.attributes.set('aria-expanded', 'true');
    const event = new FakeEvent('Tab');
    icon.fire('keydown', event);
    expect(event.prevented).to.equal(true);
    expect(close.focused).to.equal(1);
  });

  it('Tab keeps its default when collapsed, reversed, or without close button', () => {
    const icon = build(new RecordingControls());
    const collapsed = new FakeEvent('Tab');
    icon.fire('keydown', collapsed);
    icon.attributes.set('aria-expanded', 'true');
    const shift = new FakeEvent('Tab', true);
    icon.fire('keydown', shift);
    const missing = new FakeEvent('Tab');
    icon.fire('keydown', missing);
    expect([collapsed.prevented, shift.prevented, missing.prevented]).to.deep.equal([
      false,
      false,
      false,
    ]);
  });

  it('close button is labelled and closes on click', () => {
    let closed = 0;
    const close = createHoverCloseButton('Close preview', () => {
      closed += 1;
    }) as unknown as FakeElement;
    expect(close.attributes.get('aria-label')).to.equal('Close preview');
    expect(close.title).to.equal('Close preview');
    expect(close.textContent).to.equal('\u00D7');
    close.fire('click');
    expect(closed).to.equal(1);
  });

  it('Tab on the close button closes, Shift+Tab refocuses the pinned icon', () => {
    let closed = 0;
    const close = createHoverCloseButton('Close preview', () => {
      closed += 1;
    }) as unknown as FakeElement;
    const icon = new FakeElement();
    queried.set('.card-preview[aria-expanded="true"]', icon);
    const forward = new FakeEvent('Tab');
    close.fire('keydown', forward);
    const backward = new FakeEvent('Tab', true);
    close.fire('keydown', backward);
    const other = new FakeEvent('a');
    close.fire('keydown', other);
    expect(forward.prevented).to.equal(true);
    expect(closed).to.equal(1);
    expect(backward.prevented).to.equal(true);
    expect(icon.focused).to.equal(1);
    expect(other.prevented).to.equal(false);
  });
});
