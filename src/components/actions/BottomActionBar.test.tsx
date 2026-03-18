import assert from "node:assert/strict";
import test from "node:test";
import { BottomActionBar } from "./BottomActionBar";

type RenderedNode = string | number | boolean | null | undefined | RenderedElement | RenderedNode[];

interface RenderedElement {
  props: Record<string, unknown>;
  type: unknown;
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
      props: normalizedProps,
      type,
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
  "props" in value &&
  "type" in value;

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

test("bottom action bar renders button and link actions with labels", () => {
  // Arrange
  const tree = BottomActionBar({
    items: [
      {
        ariaLabel: "Share profile",
        kind: "share",
        label: "Share",
        onClick: () => undefined,
      },
      {
        ariaLabel: "Open Tip Jar",
        href: "https://example.com/tips",
        kind: "open",
        label: "Open",
        target: "_blank",
      },
    ],
    label: "Profile actions",
  }) as RenderedNode;

  // Act
  const group = firstElementWithClass(tree, "bottom-action-bar");
  const buttons = collectElements(tree).filter((element) => element.type === "button");
  const links = collectElements(tree).filter((element) => element.type === "a");
  const legend = firstElementWithClass(tree, "bottom-action-bar-legend");

  // Assert
  assert.ok(group);
  assert.ok(legend);
  assert.equal(legend.props.children, "Profile actions");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]?.props["aria-label"], "Share profile");
  assert.equal(links.length, 1);
  assert.equal(links[0]?.props["aria-label"], "Open Tip Jar");
  assert.equal(links[0]?.props.href, "https://example.com/tips");
});

test("bottom action bar preserves active state for toggle-style actions", () => {
  // Arrange
  const tree = BottomActionBar({
    items: [
      {
        active: true,
        ariaLabel: "Back to links",
        kind: "analytics",
        label: "Back",
        onClick: () => undefined,
      },
    ],
    label: "Profile actions",
  }) as RenderedNode;

  // Act
  const button = collectElements(tree).find((element) => element.type === "button");

  // Assert
  assert.ok(button);
  assert.equal(button.props["aria-pressed"], true);
  assert.equal(button.props["data-active"], "true");
});

test("bottom action bar returns no markup when there are no items", () => {
  // Arrange
  const tree = BottomActionBar({
    items: [],
    label: "Empty actions",
  }) as RenderedNode;

  // Assert
  assert.equal(collectElements(tree).length, 0);
});
