import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";
import ProfileHeader from "./ProfileHeader";
import { ProfileQuickLinks } from "./ProfileQuickLinks";

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

type QuickLinkItem = ResolvedProfileQuickLinksState["items"][number];

const createQuickLinksState = (
  hasAny: boolean,
  itemOverrides?: Partial<QuickLinkItem>,
): ResolvedProfileQuickLinksState => ({
  hasAny,
  items: hasAny
    ? [
        {
          contentOrder: itemOverrides?.contentOrder ?? 0,
          icon: itemOverrides?.icon ?? "github",
          id: itemOverrides?.id ?? "github",
          label: itemOverrides?.label ?? "GitHub",
          platform: itemOverrides?.platform ?? "github",
          url: itemOverrides?.url ?? "https://github.com/pRizz",
        },
      ]
    : [],
});

test("profile quick links render icon-only outbound links with no heading", () => {
  // Arrange
  const tree = ProfileQuickLinks({
    quickLinks: createQuickLinksState(true),
  }) as RenderedNode;

  // Act
  const nav = firstElementWithClass(tree, "profile-quick-links");
  const scroll = firstElementWithClass(tree, "profile-quick-links-scroll");
  const list = firstElementWithClass(tree, "profile-quick-links-list");
  const links = collectElements(nav?.props.children as RenderedNode).filter(
    (element) => element.type === "a",
  );

  // Assert
  assert.ok(nav);
  assert.ok(scroll);
  assert.ok(list);
  assert.equal(nav?.props["aria-label"], "Social quick links");
  assert.equal(links.length, 1);
  assert.equal(links[0]?.props["aria-label"], "Open GitHub");
  assert.equal(links[0]?.props.title, "Open GitHub");
  assert.equal(links[0]?.props.target, "_blank");
  assert.equal(links[0]?.props.rel, "noopener noreferrer");
  assert.equal(links[0]?.props["aria-current"], undefined);
  assert.equal(firstElementWithClass(tree, "profile-quick-links-heading"), undefined);
});

test("profile quick links use the shared Rumble icon instead of a text fallback", () => {
  // Arrange
  const tree = ProfileQuickLinks({
    quickLinks: createQuickLinksState(true, {
      contentOrder: 0,
      icon: "rumble",
      id: "rumble",
      label: "Rumble",
      platform: "rumble",
      url: "https://rumble.com/c/InTheLitterBox",
    }),
  }) as RenderedNode;

  // Act
  const rumbleGlyph = firstElementWithClass(tree, "profile-quick-links-glyph");

  // Assert
  assert.ok(rumbleGlyph);
  assert.equal(rumbleGlyph?.type, "svg");
});

test("profile quick links render nothing when no eligible links exist", () => {
  // Arrange
  const tree = ProfileQuickLinks({
    quickLinks: createQuickLinksState(false),
  }) as RenderedNode;

  // Assert
  assert.ok(tree === undefined || tree === "");
});

test("profile header renders quick links above the existing action bar", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(true),
  }) as RenderedNode;

  // Act
  const elements = collectElements(tree);
  const quickLinksIndex = elements.findIndex((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" && classValue.split(/\s+/u).includes("profile-quick-links")
    );
  });
  const desktopActionBarIndex = elements.findIndex((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("profile-action-bar-desktop")
    );
  });

  // Assert
  assert.notEqual(quickLinksIndex, -1);
  assert.notEqual(desktopActionBarIndex, -1);
  assert.ok(quickLinksIndex < desktopActionBarIndex);
});

test("profile header keeps the action bar present when quick links are empty", () => {
  // Arrange
  const tree = ProfileHeader({
    profile: {
      avatar: "/profile-avatar-fallback.svg",
      bio: "Engineer",
      headline: "Justice-driven builder",
      name: "Peter Ryszkiewicz",
    },
    quickLinks: createQuickLinksState(false),
  }) as RenderedNode;

  // Act
  const desktopBar = firstElementWithClass(tree, "profile-action-bar-desktop");
  const buttons = collectElements(desktopBar?.props.children as RenderedNode).filter(
    (element) => element.type === "button",
  );

  // Assert
  assert.ok(desktopBar);
  assert.equal(buttons.length, 2);
  assert.equal(firstElementWithClass(tree, "profile-quick-links"), undefined);
});
