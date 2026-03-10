import assert from "node:assert/strict";
import test from "node:test";
import { ProfileHeader } from "./ProfileHeader";

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

test("profile header renders analytics and share buttons in order when analytics is available", () => {
  const tree = ProfileHeader({
    analyticsAvailable: true,
    onAnalyticsToggle: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  const buttons = collectElements(tree).filter((element) => element.type === "button");
  assert.equal(buttons[0]?.props["aria-label"], "View follower analytics");
  assert.equal(buttons[1]?.props["aria-label"], "Share profile");
});

test("profile header flips the analytics button label when the analytics view is active", () => {
  const tree = ProfileHeader({
    analyticsActive: true,
    analyticsAvailable: true,
    onAnalyticsToggle: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  const buttons = collectElements(tree).filter((element) => element.type === "button");
  assert.equal(buttons[0]?.props["aria-label"], "Back to links");
});

test("profile header still renders share when analytics is unavailable", () => {
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  const buttons = collectElements(tree).filter((element) => element.type === "button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]?.props["aria-label"], "Share profile");
});
