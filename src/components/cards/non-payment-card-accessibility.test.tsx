import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { buildRichCardViewModel } from "../../lib/ui/rich-card-policy";
import { RichLinkCard } from "./RichLinkCard";
import { SimpleLinkCard } from "./SimpleLinkCard";

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

const assertSharedCardTree = (
  tree: RenderedNode,
  expected: {
    ariaLabel: string;
    describedBy: string;
    descriptionId: string;
    metaId: string;
    sourceId: string;
  },
) => {
  const anchor = firstElementOfType(tree, "a");
  assert.ok(anchor);
  assert.equal(anchor.props["aria-label"], expected.ariaLabel);
  assert.equal(anchor.props["aria-describedby"], expected.describedBy);
  assert.ok(!("aria-labelledby" in anchor.props));

  const renderedIds = new Set(
    collectElements(tree)
      .map((element) => element.props.id)
      .filter((value): value is string => typeof value === "string"),
  );

  assert.ok(renderedIds.has(expected.descriptionId));
  assert.ok(renderedIds.has(expected.metaId));
  assert.ok(renderedIds.has(expected.sourceId));
};

const site = {
  title: "OpenLinks",
  description: "Profile links",
  theme: {
    active: "openlinks",
    available: ["openlinks"],
  },
  ui: {
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "cover",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

const richGithubLink = {
  id: "github",
  label: "GitHub",
  url: "https://github.com/pRizz",
  type: "rich",
  icon: "github",
  description: "Code, experiments, and open-source projects",
  metadata: {
    title: "pRizz - Overview",
    description:
      "An agentic engineer, making things in the AI space, Bitcoin space, and many others.",
    sourceLabel: "github.com",
    handle: "prizz",
    image: "/generated/images/github-avatar.jpg",
    profileImage: "/generated/images/github-avatar.jpg",
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  },
} as const satisfies OpenLink;

const simpleGithubLink = {
  ...richGithubLink,
  id: "github-simple",
  type: "simple",
} as const satisfies OpenLink;

const brandIconOptions = resolveBrandIconOptions(site as SiteData);

test("simple non-payment cards render action-oriented accessible props from the shared shell", () => {
  // Act
  const tree = SimpleLinkCard({
    link: simpleGithubLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  assertSharedCardTree(tree, {
    ariaLabel: "Open pRizz in a new tab",
    describedBy:
      "simple-link-description-github-simple simple-link-meta-github-simple simple-link-source-github-simple",
    descriptionId: "simple-link-description-github-simple",
    metaId: "simple-link-meta-github-simple",
    sourceId: "simple-link-source-github-simple",
  });
});

test("rich non-payment cards render action-oriented accessible props from the shared shell", () => {
  // Act
  const tree = RichLinkCard({
    link: richGithubLink,
    viewModel: buildRichCardViewModel(site, richGithubLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  assertSharedCardTree(tree, {
    ariaLabel: "Open pRizz in a new tab",
    describedBy: "rich-link-description-github rich-link-meta-github rich-link-source-github",
    descriptionId: "rich-link-description-github",
    metaId: "rich-link-meta-github",
    sourceId: "rich-link-source-github",
  });
});
