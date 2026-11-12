import { createFakeEvent } from './FakeEvent';
import { createFakeElement, HTML_NAMESPACE, SVG_NAMESPACE } from './FakeElement';
import type { FakeElement, IElementOwner } from './FakeElement';
import type { FakeEventTarget } from './FakeEventTarget';
import { queryElements } from './FakeQuery';
import { DOCUMENT_NODE, ELEMENT_NODE, FakeNode } from './FakeNode';
import { describeElement } from './dom-serializer';
import { strictProxy } from './strict-proxy';

/** Id of the dashboard root in the HTML the extension generates. */
export const APP_ROOT_ID = 'app';

/**
 * The document: `html > head + body > main#app`, as `DashboardHtmlBuilder` emits it.
 * It owns the focus model (one active element; `blur` then `focus` events) and
 * counts element creations, a deterministic proxy for rendering cost.
 */
export class FakeDocument extends FakeNode implements IElementOwner {
  /** Number of `createElement` calls. */
  public createElementCalls = 0;
  /** Number of `createElementNS` calls. */
  public createElementNSCalls = 0;
  private readonly timeline: string[];
  private bodyElement: FakeElement | undefined = undefined;
  private focused: FakeElement | undefined = undefined;
  private parentTarget: FakeEventTarget | undefined = undefined;

  /**
   * Build an empty document.
   * @param timeline Shared, ordered log of observable effects; the document appends
   *   `focus <el>`, `blur <el>` and `dom` (one entry per run of tree mutations).
   */
  public constructor(timeline: string[]) {
    super(DOCUMENT_NODE);
    this.timeline = timeline;
  }

  /**
   * Build the page skeleton and attach the window as the event parent.
   * Must be called once, on the proxy.
   * @param parent The window the events bubble to.
   */
  public initialise(parent: FakeEventTarget): void {
    this.parentTarget = parent;
    const html = this.build('html');
    const body = this.build('body');
    const app = this.build('main');
    app.setAttribute('id', APP_ROOT_ID);
    app.setAttribute('aria-live', 'polite');
    body.appendChild(app);
    html.appendChild(this.build('head'));
    html.appendChild(body);
    this.appendChild(html);
    this.bodyElement = body;
    this.mutationListener = () => this.recordMutation();
  }

  /** @inheritdoc */
  protected override eventParent(): FakeEventTarget | undefined {
    return this.parentTarget;
  }

  public get body(): FakeElement {
    if (undefined === this.bodyElement) {
      throw new Error('The fake document is not initialised');
    }
    return this.bodyElement;
  }

  /**
   * The focused element, or the body when nothing (or an element that was
   * removed or hidden meanwhile) has the focus.
   * @returns The active element.
   */
  public get activeElement(): FakeElement {
    if (undefined !== this.focused && this.focused.isShown()) {
      return this.focused;
    }
    this.focused = undefined;
    return this.body;
  }

  /**
   * Create an HTML element.
   * @param tag Tag name.
   * @returns The element.
   */
  public createElement(tag: string): FakeElement {
    this.createElementCalls += 1;
    return this.build(String(tag).toLowerCase(), HTML_NAMESPACE);
  }

  /**
   * Create an element in the SVG (or XHTML) namespace.
   * @param namespace Namespace URI.
   * @param tag Tag name.
   * @returns The element.
   */
  public createElementNS(namespace: string, tag: string): FakeElement {
    if (SVG_NAMESPACE !== namespace && HTML_NAMESPACE !== namespace) {
      throw new Error(`Unsupported DOM API: createElementNS with namespace "${namespace}"`);
    }
    this.createElementNSCalls += 1;
    return this.build(String(tag), namespace);
  }

  /**
   * Find an element by id.
   * @param id The id.
   * @returns The first element carrying it, or `null`.
   */
  public getElementById(id: string): FakeElement | null {
    return queryElements(this, `#${id}`)[0] ?? null;
  }

  /**
   * First element matching a selector.
   * @param selector Selector within the supported subset.
   * @returns The element, or `null`.
   */
  public querySelector(selector: string): FakeElement | null {
    return queryElements(this, selector)[0] ?? null;
  }

  /**
   * Every element matching a selector, in document order.
   * @param selector Selector within the supported subset.
   * @returns The elements.
   */
  public querySelectorAll(selector: string): FakeElement[] {
    return queryElements(this, selector);
  }

  /** @inheritdoc */
  public focusElement(element: FakeElement): void {
    if (!element.isFocusable()) {
      return;
    }
    const previous = this.activeElement;
    if (previous === element) {
      return;
    }
    if (ELEMENT_NODE === previous.nodeType && previous !== this.body) {
      this.focused = undefined;
      this.timeline.push(`blur ${describeElement(previous)}`);
      previous.dispatchEvent(createFakeEvent('blur'));
    }
    this.focused = element;
    this.timeline.push(`focus ${describeElement(element)}`);
    element.dispatchEvent(createFakeEvent('focus'));
  }

  private recordMutation(): void {
    if ('dom' !== this.timeline[this.timeline.length - 1]) {
      this.timeline.push('dom');
    }
  }

  private build(tag: string, namespace: string = HTML_NAMESPACE): FakeElement {
    return createFakeElement(this, tag, namespace);
  }
}

/**
 * Create a strict, initialised document.
 * @param parent The window the document events bubble to.
 * @param timeline Shared ordered log of observable effects.
 * @returns The document.
 */
export function createFakeDocument(parent: FakeEventTarget, timeline: string[]): FakeDocument {
  const document = strictProxy(new FakeDocument(timeline), 'Document');
  document.initialise(parent);
  return document;
}
