import { createFakeClassList } from './FakeClassList';
import type { FakeClassList } from './FakeClassList';
import { queryElements } from './FakeQuery';
import { matchesSelector, parseSelector } from './FakeSelector';
import type { ISelectable } from './FakeSelector';
import { createFakeStyle } from './FakeStyle';
import type { ISerializableStyle } from './FakeStyle';
import { ELEMENT_NODE, FakeNode, TEXT_NODE, createFakeText } from './FakeNode';
import type { FakeText } from './FakeNode';
import { strictProxy } from './strict-proxy';

/** XHTML namespace of the elements built by `createElement`. */
export const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
/** SVG namespace of the elements built by `createElementNS`. */
export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Deterministic layout box reported for every element (the fake has no layout engine). */
const BOX_SIZE = 16;
/** Deterministic `offsetWidth` of every element. */
const OFFSET_WIDTH = 240;
/** Deterministic `offsetHeight` of every element. */
const OFFSET_HEIGHT = 96;
/** Columns of the deterministic rectangle grid. */
const RECT_COLUMNS = 40;
/** Rows of the deterministic rectangle grid. */
const RECT_ROWS = 30;
/** Horizontal step between two deterministic rectangles. */
const RECT_STEP_X = 12;
/** Vertical step between two deterministic rectangles. */
const RECT_STEP_Y = 18;
/** Offset of the first deterministic rectangle. */
const RECT_ORIGIN = 8;

/** Tags that can take focus without a `tabindex`. */
const NATIVELY_FOCUSABLE: ReadonlySet<string> = new Set(['button', 'input', 'select', 'textarea']);

/** What an element needs from its document. */
export interface IElementOwner {
  /**
   * Move the focus to an element, firing `blur`/`focus` as a browser does.
   * @param element The element to focus.
   */
  focusElement(element: FakeElement): void;
}

/** Rectangle reported by `getBoundingClientRect`. */
export interface IFakeRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * A DOM element. It models the subset of `Element` the dashboard uses; any
 * other member throws (see `strictProxy`).
 */
export class FakeElement extends FakeNode implements ISelectable {
  public readonly localName: string;
  public readonly namespaceURI: string;
  public readonly ownerDocument: IElementOwner;
  public readonly classList: FakeClassList;
  public readonly style: ISerializableStyle;
  public readonly attributes = new Map<string, string>();
  /** The `value` property of form controls (distinct from the `value` attribute). */
  public valueProperty = '';

  /**
   * Build an element.
   * @param owner The owning document.
   * @param localName Tag name (lower-case for HTML elements).
   * @param namespaceURI Element namespace.
   */
  public constructor(owner: IElementOwner, localName: string, namespaceURI: string) {
    super(ELEMENT_NODE);
    this.ownerDocument = owner;
    this.localName = localName;
    this.namespaceURI = namespaceURI;
    this.style = createFakeStyle() as ISerializableStyle;
    const { attributes } = this;
    this.classList = createFakeClassList({
      read: () => attributes.get('class') ?? '',
      write: (value) => {
        attributes.set('class', value);
        this.notifyMutation();
      },
    });
  }

  /**
   * The parent when it is an element.
   * @returns The parent element, or `null`.
   */
  public get parentElement(): FakeElement | null {
    const parent = this.parentNode;
    return null !== parent && ELEMENT_NODE === parent.nodeType ? (parent as FakeElement) : null;
  }

  public get className(): string {
    return this.getAttribute('class') ?? '';
  }

  public set className(value: string) {
    this.setAttribute('class', value);
  }

  public get id(): string {
    return this.getAttribute('id') ?? '';
  }

  public get title(): string {
    return this.getAttribute('title') ?? '';
  }

  public set title(value: string) {
    this.setAttribute('title', value);
  }

  public get type(): string {
    return this.getAttribute('type') ?? '';
  }

  public set type(value: string) {
    this.setAttribute('type', value);
  }

  public get placeholder(): string {
    return this.getAttribute('placeholder') ?? '';
  }

  public set placeholder(value: string) {
    this.setAttribute('placeholder', value);
  }

  public get value(): string {
    return this.valueProperty;
  }

  public set value(value: string) {
    this.valueProperty = String(value);
  }

  public get hidden(): boolean {
    return this.attributes.has('hidden');
  }

  public set hidden(value: boolean) {
    if (value) {
      this.attributes.set('hidden', '');
    } else {
      this.attributes.delete('hidden');
    }
    this.notifyMutation();
  }

  public get textContent(): string {
    return this.childNodes
      .map((child) =>
        TEXT_NODE === child.nodeType
          ? (child as FakeText).data
          : (child as FakeElement).textContent,
      )
      .join('');
  }

  public set textContent(value: string) {
    const text = String(value);
    this.replaceChildren(...('' === text ? [] : [createFakeText(text)]));
  }

  public get offsetWidth(): number {
    return OFFSET_WIDTH;
  }

  public get offsetHeight(): number {
    return OFFSET_HEIGHT;
  }

  /**
   * Set an attribute (HTML element names are lower-cased, SVG ones keep their case).
   * @param name Attribute name.
   * @param value Attribute value (coerced to a string).
   */
  public setAttribute(name: string, value: string): void {
    this.attributes.set(this.attributeName(name), String(value));
    this.notifyMutation();
  }

  /**
   * Read an attribute.
   * @param name Attribute name.
   * @returns The value, or `null` when absent.
   */
  public getAttribute(name: string): string | null {
    return this.attributes.get(this.attributeName(name)) ?? null;
  }

  /**
   * Remove an attribute.
   * @param name Attribute name.
   */
  public removeAttribute(name: string): void {
    this.attributes.delete(this.attributeName(name));
    this.notifyMutation();
  }

  /**
   * First descendant matching a selector.
   * @param selector Selector within the supported subset.
   * @returns The element, or `null`.
   */
  public querySelector(selector: string): FakeElement | null {
    return queryElements(this, selector)[0] ?? null;
  }

  /**
   * Every descendant matching a selector, in document order.
   * @param selector Selector within the supported subset.
   * @returns The elements (an array, not a live `NodeList`).
   */
  public querySelectorAll(selector: string): FakeElement[] {
    return queryElements(this, selector);
  }

  /**
   * Nearest inclusive ancestor matching a selector.
   * @param selector Selector within the supported subset.
   * @returns The element, or `null`.
   */
  public closest(selector: string): FakeElement | null {
    const parsed = parseSelector(selector);
    if (matchesSelector(this, parsed)) {
      return this;
    }
    for (let node = this.parentElement; null !== node; node = node.parentElement) {
      if (matchesSelector(node, parsed)) {
        return node;
      }
    }
    return null;
  }

  /** Give the element the focus when it is focusable (otherwise a no-op, as in browsers). */
  public focus(): void {
    this.ownerDocument.focusElement(this);
  }

  /**
   * Whether the element is rendered: connected and not hidden (itself or through
   * an ancestor, as the UA stylesheet gives `[hidden]` `display: none`).
   * @returns `true` when shown.
   */
  public isShown(): boolean {
    if (!this.isConnected || this.hidden) {
      return false;
    }
    for (let node = this.parentElement; null !== node; node = node.parentElement) {
      if (node.hidden) {
        return false;
      }
    }
    return true;
  }

  /**
   * Whether the element can take focus right now: shown, not disabled, and a form
   * control or `tabindex` carrier.
   * @returns `true` when focusable.
   */
  public isFocusable(): boolean {
    if (!this.isShown() || this.attributes.has('disabled')) {
      return false;
    }
    return NATIVELY_FOCUSABLE.has(this.localName) || this.attributes.has('tabindex');
  }

  /**
   * Deterministic rectangle derived from the element's rank in its tree. The fake
   * has no layout engine; the rank makes anchors differ so the placement logic
   * is exercised, and it only changes when the DOM structure changes.
   * @returns The rectangle.
   */
  public getBoundingClientRect(): IFakeRect {
    const root = this.rootNode();
    const rank = [root, ...root.descendants()]
      .filter((node) => ELEMENT_NODE === node.nodeType)
      .indexOf(this);
    const left = RECT_ORIGIN + RECT_STEP_X * (rank % RECT_COLUMNS);
    const top = RECT_ORIGIN + RECT_STEP_Y * (rank % RECT_ROWS);
    return { left, right: left + BOX_SIZE, top, bottom: top + BOX_SIZE };
  }

  private attributeName(name: string): string {
    return HTML_NAMESPACE === this.namespaceURI ? name.toLowerCase() : name;
  }
}

/** An element of the HTML namespace (`instanceof HTMLElement`); SVG elements are plain elements. */
export class FakeHtmlElement extends FakeElement {}

/**
 * Create a strict element.
 * @param owner The owning document.
 * @param localName Tag name.
 * @param namespaceURI Element namespace.
 * @returns A `FakeHtmlElement` for the HTML namespace, a `FakeElement` otherwise.
 */
export function createFakeElement(
  owner: IElementOwner,
  localName: string,
  namespaceURI: string,
): FakeElement {
  const element =
    HTML_NAMESPACE === namespaceURI
      ? new FakeHtmlElement(owner, localName, namespaceURI)
      : new FakeElement(owner, localName, namespaceURI);
  return strictProxy(element, `Element<${localName}>`);
}
