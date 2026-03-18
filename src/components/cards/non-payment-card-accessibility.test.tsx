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

const firstElementWithClass = (
  node: RenderedNode,
  className: string,
): RenderedElement | undefined =>
  collectElements(node).find((element) => {
    const classValue = element.props.class;
    return typeof classValue === "string" && classValue.split(/\s+/u).includes(className);
  });

const elementIndex = (node: RenderedNode, matcher: (element: RenderedElement) => boolean): number =>
  collectElements(node).findIndex(matcher);

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
    image: "/cache/content-images/github-avatar.jpg",
    profileImage: "/cache/content-images/github-avatar.jpg",
    followersCount: 90,
    followersCountRaw: "90 followers",
    followingCount: 87,
    followingCountRaw: "87 following",
  },
} as const satisfies OpenLink;

const richSubstackLink = {
  id: "substack",
  label: "Substack",
  url: "https://peter.ryszkiewicz.us/",
  type: "rich",
  icon: "substack",
  description: "Newsletter and long-form writing",
  metadata: {
    title: "Peter Ryszkiewicz | Substack",
    description: "Software Engineer",
    sourceLabel: "peter.ryszkiewicz.us",
    handle: "peterryszkiewicz",
    image: "/cache/content-images/substack-preview.jpg",
    profileImage: "/cache/content-images/substack-avatar.jpg",
  },
} as const satisfies OpenLink;

const simpleGithubLink = {
  ...richGithubLink,
  id: "github-simple",
  type: "simple",
} as const satisfies OpenLink;

const plainSimpleLink = {
  id: "openlinks",
  label: "OpenLinks",
  url: "https://openlinks.us",
  type: "simple",
  icon: "github",
  description: "Project homepage preview card with fallback defaults",
  metadata: {
    title: "OpenLinks",
    description: "Project homepage preview card with fallback defaults",
    sourceLabel: "openlinks.us",
  },
} as const satisfies OpenLink;

const articleRichLink = {
  id: "article",
  label: "Engineering Notes",
  url: "https://notes.openlinks.dev/launch-notes",
  type: "rich",
  icon: "notion",
  description: "Shipping notes and technical writeups",
  metadata: {
    title: "Engineering Notes",
    description: "Shipping notes and technical writeups",
    image: "/cache/content-images/article-preview.jpg",
    sourceLabel: "notes.openlinks.dev",
  },
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

test("non-profile rich fallback cards keep action-oriented accessible props from the shared shell", () => {
  // Act
  const tree = RichLinkCard({
    link: articleRichLink,
    viewModel: buildRichCardViewModel(site, articleRichLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  assertSharedCardTree(tree, {
    ariaLabel: "Open Engineering Notes in a new tab",
    describedBy: "rich-link-description-article rich-link-meta-article rich-link-source-article",
    descriptionId: "rich-link-description-article",
    metaId: "rich-link-meta-article",
    sourceId: "rich-link-source-article",
  });
});

test("rich cards keep description-image rows decorative and ordered after the description", () => {
  // Act
  const tree = RichLinkCard({
    link: richSubstackLink,
    viewModel: buildRichCardViewModel(site, richSubstackLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const descriptionImage = firstElementWithClass(tree, "non-payment-card-description-image");
  const descriptionIndex = elementIndex(
    tree,
    (element) => element.props.id === "rich-link-description-substack",
  );
  const descriptionImageIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-description-image"),
  );
  const footerIndex = elementIndex(tree, (element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" && classValue.split(/\s+/u).includes("non-payment-card-footer")
    );
  });

  assert.ok(anchor);
  assert.equal(anchor.props["data-has-description-image-row"], "true");
  assert.ok(descriptionImage);
  assert.equal(descriptionImage.props["aria-hidden"], "true");
  assert.ok(descriptionIndex >= 0);
  assert.ok(descriptionImageIndex > descriptionIndex);
  assert.ok(footerIndex > descriptionImageIndex);

  const image = firstElementOfType(descriptionImage.props.children as RenderedNode, "img");
  assert.ok(image);
  assert.equal(image.props.alt, "");
});

test("history-aware cards expose analytics then share as sibling actions without changing anchor semantics", () => {
  // Act
  const tree = RichLinkCard({
    resolveCardActions: () => [
      {
        ariaLabel: "View GitHub follower history",
        kind: "analytics",
        onClick: () => undefined,
      },
      {
        ariaLabel: "Show GitHub QR code",
        kind: "qr",
        onClick: () => undefined,
      },
      {
        ariaLabel: "Share GitHub",
        kind: "share",
        onClick: () => Promise.resolve({ message: "Link copied", status: "copied" as const }),
      },
      {
        ariaLabel: "Copy GitHub link",
        kind: "copy",
        onClick: () =>
          Promise.resolve({ message: "GitHub link copied", status: "copied" as const }),
      },
    ],
    link: richGithubLink,
    viewModel: buildRichCardViewModel(site, richGithubLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const actionRow = firstElementWithClass(tree, "card-action-row");
  const buttons = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("bottom-action-bar-action")
    );
  });

  assert.ok(anchor);
  assert.equal(anchor.props["aria-label"], "Open pRizz in a new tab");
  assert.ok(actionRow);
  assert.equal(buttons.length, 4);
  assert.equal(buttons[0]?.props["aria-label"], "View GitHub follower history");
  assert.equal(buttons[1]?.props["aria-label"], "Show GitHub QR code");
  assert.equal(buttons[2]?.props["aria-label"], "Share GitHub");
  assert.equal(buttons[3]?.props["aria-label"], "Copy GitHub link");
  assert.equal(
    firstElementWithClass(tree, "non-payment-card-summary")?.props["data-has-analytics"],
    undefined,
  );
  assert.equal(
    firstElementWithClass(tree, "non-payment-card-summary")?.props["data-has-actions"],
    "true",
  );
  assert.ok(firstElementWithClass(tree, "non-payment-card-title-row"));
});

test("cards without history still render share and copy sibling actions", () => {
  // Arrange
  const tree = SimpleLinkCard({
    resolveCardActions: () => [
      {
        ariaLabel: "Show OpenLinks QR code",
        kind: "qr",
        onClick: () => undefined,
      },
      {
        ariaLabel: "Share OpenLinks",
        kind: "share",
        onClick: () => Promise.resolve({ message: "Link copied", status: "copied" as const }),
      },
      {
        ariaLabel: "Copy OpenLinks link",
        kind: "copy",
        onClick: () =>
          Promise.resolve({ message: "OpenLinks link copied", status: "copied" as const }),
      },
    ],
    link: plainSimpleLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const actionRow = firstElementWithClass(tree, "card-action-row");
  const buttons = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("bottom-action-bar-action")
    );
  });

  // Assert
  assert.ok(actionRow);
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0]?.props["aria-label"], "Show OpenLinks QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share OpenLinks");
  assert.equal(buttons[2]?.props["aria-label"], "Copy OpenLinks link");
});

test("card action surfaces no longer render inline action status outputs", () => {
  const tree = RichLinkCard({
    resolveCardActions: () => [
      {
        ariaLabel: "Share GitHub",
        kind: "share",
        onClick: () => Promise.resolve({ message: "Link copied", status: "copied" as const }),
      },
    ],
    link: richGithubLink,
    viewModel: buildRichCardViewModel(site, richGithubLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  const outputElement = firstElementOfType(tree, "output");

  assert.equal(outputElement, undefined);
});
