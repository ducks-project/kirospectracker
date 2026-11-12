import { createHash } from 'crypto';
import type { FakeElement } from './FakeElement';
import { SVG_NAMESPACE } from './FakeElement';
import { ELEMENT_NODE, TEXT_NODE } from './FakeNode';
import type { FakeNode, FakeText } from './FakeNode';

/** Marker appended to the element that owns the focus. */
const ACTIVE_MARKER = '  [active]';

/** Attribute values longer than this are replaced by their length and a digest. */
const LONG_VALUE_LENGTH = 80;
/** Hex characters kept from the digest of a long value. */
const DIGEST_LENGTH = 12;

/**
 * Serialise an attribute value; long values (SVG path data) are abbreviated to
 * their length and a digest, which keeps the reference small yet sensitive.
 * @param value The attribute value.
 * @returns The JSON-quoted value, or a `long(...)` marker.
 */
function attributeValue(value: string): string {
  if (LONG_VALUE_LENGTH >= value.length) {
    return JSON.stringify(value);
  }
  const digest = createHash('sha1').update(value).digest('hex').slice(0, DIGEST_LENGTH);
  return `long(${value.length} chars, sha1 ${digest})`;
}

/**
 * Compare two strings by code unit, independent of the locale.
 * @param left First string.
 * @param right Second string.
 * @returns A negative, zero or positive number.
 */
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Tag name as serialised: SVG elements get an `svg:` prefix.
 * @param element The element.
 * @returns The qualified tag.
 */
function qualifiedTag(element: FakeElement): string {
  return SVG_NAMESPACE === element.namespaceURI ? `svg:${element.localName}` : element.localName;
}

/**
 * Short, stable description of an element for logs: tag, classes, accessible label.
 * @param element The element.
 * @returns For instance `button.card-preview[aria-label="Preview alpha"]`.
 */
export function describeElement(element: FakeElement): string {
  const classes = (element.getAttribute('class') ?? '').split(/\s+/).filter((c) => '' !== c);
  const label = element.getAttribute('aria-label');
  const classPart = 0 === classes.length ? '' : `.${classes.join('.')}`;
  const labelPart = null === label ? '' : `[aria-label=${JSON.stringify(label)}]`;
  return `${qualifiedTag(element)}${classPart}${labelPart}`;
}

/**
 * Serialise the opening line of an element: tag, attributes sorted by name, inline
 * style, form value, and the active marker.
 * @param element The element.
 * @param active The element that owns the focus.
 * @returns The line, without indentation.
 */
function elementLine(element: FakeElement, active: FakeElement): string {
  const entries = Array.from(element.attributes.entries());
  const style = element.style.serialize();
  if ('' !== style) {
    entries.push(['style', style]);
  }
  const attributes = entries
    .sort(([left], [right]) => compareText(left, right))
    .map(([name, value]) => ` ${name}=${attributeValue(value)}`)
    .join('');
  const value =
    '' === element.valueProperty ? '' : ` .value=${JSON.stringify(element.valueProperty)}`;
  const marker = active === element ? ACTIVE_MARKER : '';
  return `<${qualifiedTag(element)}${attributes}${value}>${marker}`;
}

/**
 * Serialise a node and its subtree as an indented, line-oriented text tree.
 * Attributes are sorted, text nodes are JSON strings, and the `hidden` state is
 * the `hidden` attribute itself.
 * @param node The root of the subtree.
 * @param active The element that owns the focus.
 * @param depth Indentation depth of the root.
 * @returns The lines.
 */
export function serializeTree(node: FakeNode, active: FakeElement, depth = 0): string[] {
  const indent = '  '.repeat(depth);
  if (TEXT_NODE === node.nodeType) {
    return [`${indent}${JSON.stringify((node as FakeText).data)}`];
  }
  if (ELEMENT_NODE !== node.nodeType) {
    throw new Error('Only elements and text nodes can be serialised');
  }
  const element = node as FakeElement;
  const lines = [`${indent}${elementLine(element, active)}`];
  element.childNodes.forEach((child) => {
    lines.push(...serializeTree(child, active, depth + 1));
  });
  return lines;
}
