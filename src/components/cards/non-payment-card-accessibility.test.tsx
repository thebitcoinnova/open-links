import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { buildRichCardViewModel, buildSimpleCardViewModel } from "../../lib/ui/rich-card-policy";
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

const mockImageDimensionsByUrl = new Map<string, { naturalWidth: number; naturalHeight: number }>([
  ["/cache/content-images/substack-preview.jpg", { naturalWidth: 2400, naturalHeight: 900 }],
  [
    "/cache/content-images/substack-square-preview.jpg",
    { naturalWidth: 1200, naturalHeight: 1200 },
  ],
]);

class MockImage {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;

  set src(value: string) {
    const maybeDimensions = mockImageDimensionsByUrl.get(value);
    this.complete = true;
    this.naturalWidth = maybeDimensions?.naturalWidth ?? 0;
    this.naturalHeight = maybeDimensions?.naturalHeight ?? 0;
  }

  addEventListener() {}

  removeEventListener() {}
}

(
  globalThis as typeof globalThis & {
    Image?: typeof Image;
  }
).Image = MockImage as unknown as typeof Image;

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

const renderedTextContent = (node: RenderedNode): string => {
  if (Array.isArray(node)) {
    return node.map((entry) => renderedTextContent(entry)).join("");
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!isRenderedElement(node)) {
    return "";
  }

  return renderedTextContent(node.props.children as RenderedNode);
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

const richSubstackSquarePreviewLink = {
  ...richSubstackLink,
  id: "substack-square",
  metadata: {
    ...richSubstackLink.metadata,
    image: "/cache/content-images/substack-square-preview.jpg",
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

const emailSimpleLink = {
  id: "email",
  label: "Email",
  url: "mailto:hello.team@example.com?subject=Hi%20there",
  type: "simple",
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

const referralSimpleLink = {
  id: "coffee-referral",
  label: "Get Coffee",
  url: "https://example.com/coffee?ref=openlinks",
  type: "simple",
  icon: "globe",
  description: "Ordinary fallback copy",
  metadata: {
    title: "Coffee",
    description: "Ordinary fallback copy",
    sourceLabel: "example.com",
  },
  referral: {
    kind: "promo",
    visitorBenefit: "Get 20% off your first order",
    ownerBenefit: "Supports the project",
    offerSummary: "Save on your first bag of coffee.",
    termsSummary: "New customers only. Cannot be combined with other offers.",
    termsUrl: "https://example.com/referral-terms",
  },
} as const satisfies OpenLink;

const longSimpleLink = {
  id: "openlinks-long",
  label: "OpenLinks With A Remarkably Long Label Built To Stress Narrow Mobile Card Width",
  url: "https://openlinks.us",
  type: "simple",
  icon: "globe",
  description:
    "A description with exceedinglylongsegmentsandaverylongcustomdomainreference.example.openlinks.dev that should remain inside the card.",
  metadata: {
    title: "OpenLinks With A Remarkably Long Label Built To Stress Narrow Mobile Card Width",
    description:
      "A description with exceedinglylongsegmentsandaverylongcustomdomainreference.example.openlinks.dev that should remain inside the card.",
    sourceLabel:
      "very-long-custom-domain-for-openlinks-mobile-overflow-checks.example.openlinks.dev",
  },
} as const satisfies OpenLink;

const longHandleRichLink = {
  ...richGithubLink,
  id: "github-long-handle",
  metadata: {
    ...richGithubLink.metadata,
    description:
      "An agentic engineer with a deliberatelylongprofiledescriptionthatneedstowrapcleanlyinsideitscardcontainer.",
    handle: "averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks",
    sourceLabel:
      "custom-github-mirror-subdomain-used-for-mobile-overflow-regression-checks.example.dev",
    title: "averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks - Overview",
  },
  url: "https://github.com/averyveryverylonghandlewithoutnaturalbreakpointsforwrappingchecks",
} as const satisfies OpenLink;

const longArticleRichLink = {
  ...articleRichLink,
  id: "article-long",
  description:
    "Shipping notes with an intentionallylongslugsegmentthatneedstobreakinsidearichcardwithoutwideningthelayout.",
  label: "Engineering Notes With A Long Rich Card Title For Mobile Layout Safety",
  metadata: {
    ...articleRichLink.metadata,
    description:
      "Shipping notes with an intentionallylongslugsegmentthatneedstobreakinsidearichcardwithoutwideningthelayout.",
    sourceLabel:
      "notes-with-a-very-long-subdomain-for-mobile-overflow-regression-checks.openlinks.dev",
    title: "Engineering Notes With A Long Rich Card Title For Mobile Layout Safety",
  },
  url: "https://notes-with-a-very-long-subdomain-for-mobile-overflow-regression-checks.openlinks.dev/launch-notes",
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

test("rich cards render top banners decoratively ahead of the summary flow", () => {
  // Act
  const tree = RichLinkCard({
    link: richSubstackLink,
    viewModel: buildRichCardViewModel(site, richSubstackLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const topBanner = firstElementWithClass(tree, "non-payment-card-profile-preview-top-banner");
  const summaryIndex = elementIndex(tree, (element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("non-payment-card-summary")
    );
  });
  const descriptionIndex = elementIndex(
    tree,
    (element) => element.props.id === "rich-link-description-substack",
  );
  const topBannerIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-profile-preview-top-banner"),
  );

  assert.ok(anchor);
  assert.equal(anchor.props["data-has-profile-preview-media"], "true");
  assert.equal(anchor.props["data-profile-preview-render"], "top-banner");
  assert.ok(topBanner);
  assert.equal(topBanner.props["aria-hidden"], "true");
  assert.ok(topBannerIndex >= 0);
  assert.ok(summaryIndex > topBannerIndex);
  assert.ok(descriptionIndex >= 0);
  assert.ok(descriptionIndex > topBannerIndex);

  const image = firstElementOfType(topBanner.props.children as RenderedNode, "img");
  assert.ok(image);
  assert.equal(image.props.alt, "");
});

test("legacy bottom-row placement keeps preview media after the description and before the footer", () => {
  // Arrange
  const legacyPlacementSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          placement: {
            default: "bottom-row",
          },
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const tree = RichLinkCard({
    link: richSubstackLink,
    viewModel: buildRichCardViewModel(legacyPlacementSite, richSubstackLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const bottomRowPreview = firstElementWithClass(
    tree,
    "non-payment-card-profile-preview-bottom-row",
  );
  const descriptionIndex = elementIndex(
    tree,
    (element) => element.props.id === "rich-link-description-substack",
  );
  const bottomRowIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-profile-preview-bottom-row"),
  );
  const footerIndex = elementIndex(tree, (element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" && classValue.split(/\s+/u).includes("non-payment-card-footer")
    );
  });

  assert.ok(anchor);
  assert.equal(anchor.props["data-profile-preview-render"], "bottom-row");
  assert.ok(bottomRowPreview);
  assert.ok(descriptionIndex >= 0);
  assert.ok(bottomRowIndex > descriptionIndex);
  assert.ok(footerIndex > bottomRowIndex);
});

test("compact-end fallback renders after footer content when a preview image is too tall for the banner slot", () => {
  // Arrange
  const compactFallbackSite = {
    ...site,
    ui: {
      richCards: {
        ...site.ui.richCards,
        descriptionImageRow: {
          bannerMinAspectRatio: 2,
          nonBannerFallback: {
            default: "compact-end",
          },
        },
      },
    },
  } as const satisfies SiteData;

  // Act
  const tree = RichLinkCard({
    link: richSubstackSquarePreviewLink,
    viewModel: buildRichCardViewModel(compactFallbackSite, richSubstackSquarePreviewLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const compactPreview = firstElementWithClass(
    tree,
    "non-payment-card-profile-preview-compact-end",
  );
  const compactPreviewIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-profile-preview-compact-end"),
  );
  const footerIndex = elementIndex(tree, (element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" && classValue.split(/\s+/u).includes("non-payment-card-footer")
    );
  });

  assert.ok(anchor);
  assert.equal(anchor.props["data-profile-preview-render"], "compact-end");
  assert.ok(compactPreview);
  assert.ok(footerIndex >= 0);
  assert.ok(compactPreviewIndex > footerIndex);
});

test("email cards expose contact-aware semantics and the dedicated mail icon", () => {
  // Act
  const tree = SimpleLinkCard({
    link: emailSimpleLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const description = firstElementWithClass(tree, "non-payment-card-description-email");
  const icon = firstElementWithClass(tree, "card-icon");
  const iconTitle = icon
    ? firstElementOfType(icon.props.children as RenderedNode, "title")
    : undefined;

  assert.ok(anchor);
  assert.ok(frame);
  assert.ok(description);
  assert.ok(icon);
  assert.ok(iconTitle);
  assert.equal(anchor.props["aria-label"], "Send email to hello.team@example.com");
  assert.equal(anchor.props["aria-describedby"], "simple-link-description-email");
  assert.equal(anchor.props["data-link-kind"], "contact");
  assert.equal(anchor.props["data-link-scheme"], "mailto");
  assert.equal(anchor.props["data-contact-kind"], "email");
  assert.equal(frame.props["data-link-kind"], "contact");
  assert.equal(frame.props["data-link-scheme"], "mailto");
  assert.equal(frame.props["data-contact-kind"], "email");
  assert.equal(renderedTextContent(iconTitle.props.children as RenderedNode), "Mail");
});

test("history-aware cards expose stats after share actions without changing anchor semantics", () => {
  // Act
  const tree = RichLinkCard({
    resolveCardActions: () => [
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
      {
        ariaLabel: "View GitHub follower history",
        kind: "analytics",
        onClick: () => undefined,
      },
    ],
    link: richGithubLink,
    viewModel: buildRichCardViewModel(site, richGithubLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Assert
  const anchor = firstElementOfType(tree, "a");
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const actionRow = firstElementWithClass(tree, "card-action-row");
  const buttons = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("bottom-action-bar-action")
    );
  });

  assert.ok(anchor);
  assert.ok(frame);
  assert.equal(anchor.props["aria-label"], "Open pRizz in a new tab");
  assert.ok(actionRow);
  assert.equal(buttons.length, 4);
  assert.equal(buttons[0]?.props["aria-label"], "Show GitHub QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share GitHub");
  assert.equal(buttons[2]?.props["aria-label"], "Copy GitHub link");
  assert.equal(buttons[3]?.props["aria-label"], "View GitHub follower history");
  assert.equal(frame.props["data-card-variant"], "rich");
  assert.equal(frame.props["data-has-actions"], "true");
  assert.equal(frame.props["data-has-profile-layout"], "true");
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
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const actionRow = firstElementWithClass(tree, "card-action-row");
  const buttons = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("bottom-action-bar-action")
    );
  });

  // Assert
  assert.ok(frame);
  assert.ok(actionRow);
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0]?.props["aria-label"], "Show OpenLinks QR code");
  assert.equal(buttons[1]?.props["aria-label"], "Share OpenLinks");
  assert.equal(buttons[2]?.props["aria-label"], "Copy OpenLinks link");
  assert.equal(frame.props["data-card-variant"], "simple");
  assert.equal(frame.props["data-has-actions"], "true");
  assert.equal(frame.props["data-has-profile-layout"], "false");

  const frameChildren = (
    Array.isArray(frame.props.children) ? frame.props.children : [frame.props.children]
  ) as RenderedNode[];
  const directChildren = frameChildren.filter(isRenderedElement);

  assert.equal(directChildren.length, 2);
  assert.equal(directChildren[0]?.type, "a");
  assert.equal(directChildren[1]?.type, "fieldset");
});

test("referral cards keep the shared primary anchor semantics while exposing a sibling terms link", () => {
  // Arrange
  const tree = SimpleLinkCard({
    link: referralSimpleLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const anchor = firstElementOfType(tree, "a");
  const badgeIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-referral-badge"),
  );
  const benefitIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-referral-benefit-row"),
  );
  const descriptionIndex = elementIndex(
    tree,
    (element) => element.props.id === "simple-link-description-coffee-referral",
  );
  const termsSummaryIndex = elementIndex(
    tree,
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-referral-terms"),
  );
  const termsLink = firstElementWithClass(tree, "non-payment-card-referral-terms-link");

  // Assert
  assert.ok(frame);
  assert.ok(anchor);
  assert.equal(anchor.props["aria-label"], "Open Get Coffee in a new tab");
  assert.equal(anchor.props["data-has-referral"], "true");
  assert.ok(badgeIndex >= 0);
  assert.ok(benefitIndex > badgeIndex);
  assert.ok(descriptionIndex > benefitIndex);
  assert.ok(termsSummaryIndex > descriptionIndex);
  assert.ok(termsLink);
  assert.equal(termsLink.props["aria-label"], "Open terms for Get Coffee in a new tab");

  const frameChildren = (
    Array.isArray(frame.props.children) ? frame.props.children : [frame.props.children]
  ) as RenderedNode[];
  const directChildren = frameChildren.filter(isRenderedElement);

  assert.equal(directChildren.length, 2);
  assert.equal(directChildren[0]?.type, "a");
  assert.equal(directChildren[1]?.type, "div");
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

test("simple cards preserve long title, description, and footer source copy in shared text surfaces", () => {
  // Arrange
  const viewModel = buildSimpleCardViewModel(site, longSimpleLink);
  const tree = SimpleLinkCard({
    link: longSimpleLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const title = firstElementWithClass(tree, "non-payment-card-title");
  const description = firstElementWithClass(tree, "non-payment-card-description");
  const footerSourceLabel = firstElementWithClass(tree, "non-payment-card-source-label");

  // Assert
  assert.ok(title);
  assert.equal(title.props.children, viewModel.title);
  assert.ok(description);
  assert.equal(description.props.children, viewModel.description);
  assert.ok(footerSourceLabel);
  assert.equal(footerSourceLabel.props.children, viewModel.footerSourceLabel);
});

test("rich profile cards preserve long handles inside shared header meta items", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, longHandleRichLink);
  const tree = RichLinkCard({
    link: longHandleRichLink,
    viewModel,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const handle = firstElementWithClass(tree, "card-handle");
  const description = firstElementWithClass(tree, "non-payment-card-description");
  const footerSourceLabel = firstElementWithClass(tree, "non-payment-card-source-label");

  // Assert
  assert.ok(handle);
  assert.equal(handle.props.children, viewModel.headerMetaItems[0]?.text);
  assert.ok(description);
  assert.equal(description.props.children, viewModel.description);
  assert.ok(footerSourceLabel);
  assert.equal(footerSourceLabel.props.children, viewModel.footerSourceLabel);
});

test("rich fallback cards preserve long source labels in both header and footer text surfaces", () => {
  // Arrange
  const viewModel = buildRichCardViewModel(site, longArticleRichLink);
  const tree = RichLinkCard({
    link: longArticleRichLink,
    viewModel,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const title = firstElementWithClass(tree, "non-payment-card-title");
  const headerSource = firstElementWithClass(tree, "card-source-inline");
  const footerSourceLabel = firstElementWithClass(tree, "non-payment-card-source-label");
  const description = firstElementWithClass(tree, "non-payment-card-description");

  // Assert
  assert.ok(title);
  assert.equal(title.props.children, viewModel.title);
  assert.ok(headerSource);
  assert.equal(headerSource.props.children, viewModel.headerMetaItems[0]?.text);
  assert.ok(footerSourceLabel);
  assert.equal(footerSourceLabel.props.children, viewModel.footerSourceLabel);
  assert.ok(description);
  assert.equal(description.props.children, viewModel.description);
});
