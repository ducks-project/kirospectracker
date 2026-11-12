import type { FakeElement } from '../fake-dom/FakeElement';
import { createFakeEvent } from '../fake-dom/FakeEvent';
import type { FakeEvent } from '../fake-dom/FakeEvent';
import type { FakeEventTarget } from '../fake-dom/FakeEventTarget';
import { describeElement, serializeTree } from '../fake-dom/dom-serializer';
import { WEBVIEW_ORIGIN } from './DashboardHost';
import type { DashboardHost } from './DashboardHost';

/** Keys that make a focused native button fire `click` (Enter on keydown, Space modelled alike). */
const NATIVE_ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/** Options of {@link DashboardDriver.key}. */
export interface IKeyOptions {
  readonly shiftKey?: boolean;
}

/**
 * Plays user and host actions against a booted dashboard and records an
 * observation log: checkpoints list what changed since the previous one (posted
 * messages, `setState` calls, focus transitions) plus the pending timers, the
 * active element and optionally parts of the DOM.
 *
 * Simulated, not native: a click does not move the focus, a `Tab` key has no
 * default focus traversal, and an Enter/Space keydown that is not
 * default-prevented on an enabled `<button>` also fires its `click`.
 */
export class DashboardDriver {
  private readonly host: DashboardHost;
  private readonly lines: string[] = [];
  private effectsLogged = 0;
  private createdElements = 0;
  private createdSvgElements = 0;

  /**
   * Build a driver over a booted host.
   * @param host The booted dashboard host.
   */
  public constructor(host: DashboardHost) {
    this.host = host;
  }

  /** The fake document, for scenario lookups. */
  public get document(): DashboardHost['document'] {
    return this.host.document;
  }

  /**
   * Deliver a message from the extension host to the webview.
   * @param data The payload.
   * @param origin The `event.origin` (defaults to the trusted webview origin).
   */
  public post(data: unknown, origin: string = WEBVIEW_ORIGIN): void {
    this.host.deliver(data, origin);
  }

  /**
   * The single element matching a selector; throws when there is none.
   * @param selector Selector within the supported subset.
   * @returns The first match.
   */
  public query(selector: string): FakeElement {
    const found = this.host.document.querySelector(selector);
    if (null === found) {
      throw new Error(`Scenario error: nothing matches "${selector}"`);
    }
    return found;
  }

  /**
   * The first descendant of an element matching a selector; throws when there is none.
   * @param root The scope element.
   * @param selector Selector within the supported subset.
   * @returns The first match.
   */
  public inside(root: FakeElement, selector: string): FakeElement {
    const found = root.querySelector(selector);
    if (null === found) {
      throw new Error(`Scenario error: nothing matches "${selector}" inside the element`);
    }
    return found;
  }

  /**
   * Every element matching a selector.
   * @param selector Selector within the supported subset.
   * @returns The matches, in document order.
   */
  public queryAll(selector: string): FakeElement[] {
    return this.host.document.querySelectorAll(selector);
  }

  /**
   * The mounted card whose title is the given name.
   * @param name The spec name.
   * @returns The `article.card` element.
   */
  public card(name: string): FakeElement {
    const found = this.queryAll('article.card').find(
      (article) => name === article.querySelector('.card-title')?.textContent,
    );
    if (undefined === found) {
      throw new Error(`Scenario error: no mounted card named "${name}"`);
    }
    return found;
  }

  /**
   * Snapshot of the mounted card nodes by name, to tell replaced nodes from kept ones.
   * @returns Card nodes keyed by spec name.
   */
  public cardNodes(): ReadonlyMap<string, FakeElement> {
    return new Map(
      this.queryAll('article.card').map((article) => [
        article.querySelector('.card-title')?.textContent ?? '',
        article,
      ]),
    );
  }

  /**
   * Record, per card, whether its node was kept or replaced since a snapshot.
   * @param before Result of an earlier {@link cardNodes}.
   * @param label Note prefix.
   */
  public noteNodeReuse(before: ReadonlyMap<string, FakeElement>, label: string): void {
    const after = this.cardNodes();
    const verdicts = Array.from(after.entries()).map(([name, node]) =>
      before.has(name)
        ? `${name}=${before.get(name) === node ? 'kept' : 'replaced'}`
        : `${name}=new`,
    );
    this.note(`${label}: ${verdicts.join(', ')}`);
  }

  /**
   * Like {@link noteNodeReuse} but only counts, for large card sets.
   * @param before Result of an earlier {@link cardNodes}.
   * @param label Note prefix.
   */
  public noteNodeReuseCounts(before: ReadonlyMap<string, FakeElement>, label: string): void {
    const after = Array.from(this.cardNodes().entries());
    const kept = after.filter(([name, node]) => before.get(name) === node).length;
    const created = after.filter(([name]) => !before.has(name)).length;
    this.note(`${label}: kept=${kept}, replaced=${after.length - kept - created}, new=${created}`);
  }

  /**
   * Dispatch a bubbling `click` as a pointer would (nothing happens on a disabled
   * button; clicking something not rendered is a scenario error).
   * @param target The clicked element.
   * @returns The event.
   */
  public click(target: FakeElement): FakeEvent {
    this.assertInteractive(target, 'click');
    const event = createFakeEvent('click', { bubbles: true });
    if ('button' === target.localName && null !== target.getAttribute('disabled')) {
      return event;
    }
    target.dispatchEvent(event);
    return event;
  }

  /**
   * Press a key on an element: a bubbling `keydown`, then the native `click` of an
   * enabled button when Enter or Space was not default-prevented.
   * @param target The focused element.
   * @param key The `KeyboardEvent.key` value.
   * @param options Modifier keys.
   * @returns The keydown event (inspect `defaultPrevented`).
   */
  public key(target: FakeElement, key: string, options: IKeyOptions = {}): FakeEvent {
    this.assertInteractive(target, `key ${key}`);
    const event = createFakeEvent('keydown', { bubbles: true, key, shiftKey: options.shiftKey });
    target.dispatchEvent(event);
    if (
      !event.defaultPrevented &&
      NATIVE_ACTIVATION_KEYS.has(key) &&
      'button' === target.localName
    ) {
      this.click(target);
    }
    return event;
  }

  /**
   * Type into a text input: set its value and dispatch a bubbling `input` event.
   * @param input The input element.
   * @param text The full new value.
   */
  public type(input: FakeElement, text: string): void {
    this.assertInteractive(input, 'type');
    input.value = text;
    input.dispatchEvent(createFakeEvent('input', { bubbles: true }));
  }

  /**
   * Move the pointer onto an element (`mouseenter`, which does not bubble).
   * @param target The element.
   */
  public hover(target: FakeElement): void {
    this.assertInteractive(target, 'hover');
    target.dispatchEvent(createFakeEvent('mouseenter'));
  }

  /**
   * Move the pointer off an element (`mouseleave`, which does not bubble).
   * @param target The element.
   */
  public unhover(target: FakeElement): void {
    target.dispatchEvent(createFakeEvent('mouseleave'));
  }

  /**
   * Dispatch a non-bubbling `scroll` on a target (an element, or the document).
   * @param target The scrolled node.
   */
  public scroll(target: FakeEventTarget): void {
    target.dispatchEvent(createFakeEvent('scroll'));
  }

  /**
   * Let time pass on the manual clock.
   * @param milliseconds Duration.
   */
  public advance(milliseconds: number): void {
    this.host.clock.advance(milliseconds);
  }

  /**
   * Add a free-form observation to the log.
   * @param text The observation.
   */
  public note(text: string): void {
    this.lines.push(`note: ${text}`);
  }

  /**
   * Record how many elements were created since the previous call: a
   * deterministic proxy for rendering cost (exact equality is expected).
   * @param label What was measured.
   */
  public noteCreationCost(label: string): void {
    const { createElementCalls, createElementNSCalls } = this.host.document;
    this.note(
      `${label}: createElement=${createElementCalls - this.createdElements}, ` +
        `createElementNS=${createElementNSCalls - this.createdSvgElements}`,
    );
    this.createdElements = createElementCalls;
    this.createdSvgElements = createElementNSCalls;
  }

  /**
   * Log what changed since the previous checkpoint.
   * @param label Checkpoint title.
   * @param domSelectors Selectors whose matches (with subtrees) are serialised.
   */
  public checkpoint(label: string, ...domSelectors: string[]): void {
    const { effects } = this.host;
    this.lines.push(`## ${label}`);
    const fresh = effects.slice(this.effectsLogged);
    this.lines.push(`effects (+${fresh.length}):`);
    fresh.forEach((entry, index) => {
      this.lines.push(`  ${this.effectsLogged + index + 1}. ${entry}`);
    });
    this.effectsLogged = effects.length;
    const delays = this.host.clock.pendingDelays();
    this.lines.push(`timers: [${delays.map((delay) => `+${delay}ms`).join(', ')}]`);
    this.lines.push(`active: ${describeElement(this.host.document.activeElement)}`);
    domSelectors.forEach((selector) => this.appendDom(selector));
  }

  /**
   * Close the log with the listener order and the body, and return it.
   * @param fullDom Whether to serialise the whole body (otherwise only the element count).
   * @returns The full text of the scenario observation.
   */
  public finish(fullDom = true): string {
    this.checkpoint('final');
    this.lines.push(`window listeners: ${this.describeListeners(this.host.window)}`);
    this.lines.push(`document listeners: ${this.describeListeners(this.host.document)}`);
    const { document } = this.host;
    if (!fullDom) {
      this.lines.push(`dom: ${document.body.descendants().length} nodes below body`);
      return `${this.lines.join('\n')}\n`;
    }
    this.lines.push('dom:');
    this.lines.push(...serializeTree(document.body, document.activeElement, 1));
    return `${this.lines.join('\n')}\n`;
  }

  private appendDom(selector: string): void {
    const { document } = this.host;
    this.lines.push(`dom ${selector}:`);
    this.queryAll(selector).forEach((element) => {
      this.lines.push(...serializeTree(element, document.activeElement, 1));
    });
  }

  private describeListeners(target: FakeEventTarget): string {
    return target
      .listenerRecords()
      .map((record) => (record.capture ? `${record.type}(capture)` : record.type))
      .join(', ');
  }

  private assertInteractive(target: FakeElement, action: string): void {
    if (!target.isShown()) {
      throw new Error(`Scenario error: cannot ${action} an element that is not shown`);
    }
  }
}
