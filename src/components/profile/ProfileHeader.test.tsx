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

const firstElementOfType = (node: RenderedNode, type: string): RenderedElement | undefined =>
  collectElements(node).find((element) => element.type === type);

test("profile header renders analytics and share buttons in order when analytics is available", () => {
  // Arrange
  const tree = ProfileHeader({
    analyticsAvailable: true,
    onAnalyticsToggle: () => undefined,
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const buttons = collectElements(tree).filter((element) => element.type === "button");

  // Assert
  assert.equal(buttons[0]?.props["aria-label"], "View follower analytics");
  assert.equal(buttons[1]?.props["aria-label"], "Show profile QR code");
  assert.equal(buttons[2]?.props["aria-label"], "Share profile");
  assert.equal(buttons[3]?.props["aria-label"], "Copy profile link");
});

test("profile header flips the analytics button label when the analytics view is active", () => {
  // Arrange
  const tree = ProfileHeader({
    analyticsActive: true,
    analyticsAvailable: true,
    onAnalyticsToggle: () => undefined,
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const buttons = collectElements(tree).filter((element) => element.type === "button");

  // Assert
  assert.equal(buttons[0]?.props["aria-label"], "Back to links");
  assert.equal(buttons[1]?.props["aria-label"], "Show profile QR code");
  assert.equal(buttons[2]?.props["aria-label"], "Share profile");
  assert.equal(buttons[3]?.props["aria-label"], "Copy profile link");
});

test("profile header still renders QR, share, and copy when analytics is unavailable", () => {
  // Arrange
  const tree = ProfileHeader({
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Act
  const buttons = collectElements(tree).filter((element) => element.type === "button");

  // Assert
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0]?.props["aria-label"], "Show profile QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share profile");
  assert.equal(buttons[2]?.props["aria-label"], "Copy profile link");
});

test("profile header no longer renders an inline share status output", () => {
  // Arrange
  const tree = ProfileHeader({
    analyticsAvailable: true,
    onAnalyticsToggle: () => undefined,
    onProfileQrOpen: () => undefined,
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
  }) as RenderedNode;

  // Assert
  assert.equal(firstElementOfType(tree, "output"), undefined);
});
