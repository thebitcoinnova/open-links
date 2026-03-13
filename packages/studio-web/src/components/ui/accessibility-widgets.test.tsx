import assert from "node:assert/strict";
import test from "node:test";
import { buttonClassName } from "./button";
import { LabeledInput } from "./field";
import StatusNotice from "./status-notice";

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

const firstElementOfType = (node: RenderedNode, type: string): RenderedElement | undefined =>
  collectElements(node).find((element) => element.type === type);

test("labeled inputs render a persistent label and described-by wiring", () => {
  const tree = LabeledInput({
    id: "editor-profile-name",
    label: "Name",
    maybeDescription: "Displayed on your public profile.",
    value: "Peter",
  }) as RenderedNode;

  const label = firstElementOfType(tree, "label");
  const input = firstElementOfType(tree, "input");
  const description = firstElementOfType(tree, "p");

  assert.equal(label?.props.for, "editor-profile-name");
  assert.equal(label?.props.children, "Name");
  assert.equal(input?.props.id, "editor-profile-name");
  assert.equal(input?.props["aria-describedby"], "editor-profile-name-description");
  assert.equal(description?.props.id, "editor-profile-name-description");
});

test("status notices expose assertive live-region semantics for alerts", () => {
  const tree = StatusNotice({
    children: "Save failed",
    tone: "alert",
  }) as RenderedNode;

  const root = firstElementOfType(tree, "div");
  assert.equal(root?.props.role, "alert");
  assert.equal(root?.props["aria-live"], "assertive");
});

test("buttonClassName keeps the shared button focus treatment for link-styled actions", () => {
  const className = buttonClassName({
    class: "bg-white text-ink",
    size: "lg",
    variant: "outline",
  });

  assert.match(className, /focus-visible:ring-2/u);
  assert.match(className, /h-12/u);
  assert.match(className, /border/u);
});
