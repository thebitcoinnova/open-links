import assert from "node:assert/strict";
import test from "node:test";
import { TopUtilityBar } from "./TopUtilityBar";

type RenderedNode = string | number | boolean | null | undefined | RenderedElement | RenderedNode[];

interface RenderedElement {
  type: unknown;
  props: Record<string, unknown>;
}

const reactRuntime = {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: RenderedNode[]) {
    const normalizedChildren =
      children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    const normalizedProps =
      normalizedChildren === undefined
        ? { ...(props ?? {}) }
        : { ...(props ?? {}), children: normalizedChildren };

    if (typeof type === "function") {
      return type(normalizedProps);
    }

    return {
      type,
      props: normalizedProps,
    } satisfies RenderedElement;
  },
  Fragment(props: { children?: RenderedNode }) {
    return props.children ?? null;
  },
};

(
  globalThis as typeof globalThis & {
    React?: typeof reactRuntime;
  }
).React = reactRuntime;

const isRenderedElement = (value: RenderedNode): value is RenderedElement =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  "props" in value;

const collectElements = (node: RenderedNode): RenderedElement[] => {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectElements(entry));
  }

  if (!isRenderedElement(node)) {
    return [];
  }

  return [node, ...collectElements(node.props.children as RenderedNode)];
};

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

test("top utility bar wraps long site titles inside a dedicated text element", () => {
  // Arrange
  const longTitle =
    "OpenLinks for Builders With Extremely Long Words That Should Still Stay Inside the Mobile Header";
  const tree = TopUtilityBar({
    title: longTitle,
  }) as RenderedNode;

  // Act
  const header = collectElements(tree).find((element) => element.type === "header");
  const brandText = firstElementWithClass(tree, "utility-brand-text");
  const actions = firstElementWithClass(tree, "utility-actions");

  // Assert
  assert.ok(header);
  assert.equal(header.props["data-sticky-mobile"], "true");
  assert.ok(brandText);
  assert.equal(brandText.props.children, longTitle);
  assert.ok(actions);
  assert.equal(actions.props["aria-label"], "Display controls");
});
