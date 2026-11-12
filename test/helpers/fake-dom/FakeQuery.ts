import type { FakeElement } from './FakeElement';
import type { FakeNode } from './FakeNode';
import { ELEMENT_NODE } from './FakeNode';
import { matchesSelector, parseSelector } from './FakeSelector';

/**
 * All descendant elements of a root matching a selector, in document order.
 * @param root The scope node (excluded from the result).
 * @param selector A selector within the subset of {@link parseSelector}.
 * @returns The matching elements.
 */
export function queryElements(root: FakeNode, selector: string): FakeElement[] {
  const parsed = parseSelector(selector);
  return root
    .descendants()
    .filter((node): node is FakeElement => ELEMENT_NODE === node.nodeType)
    .filter((element) => matchesSelector(element, parsed));
}
