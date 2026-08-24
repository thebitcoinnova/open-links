import assert from "node:assert/strict";
import test from "node:test";
import type { OpenLink, SiteData } from "../../lib/content/load-content";
import { resolveBrandIconOptions } from "../../lib/icons/brand-icon-options";
import { buildRichCardViewModel, buildSimpleCardViewModel } from "../../lib/ui/rich-card-policy";
import { RichLinkCard } from "./RichLinkCard";
import { SimpleLinkCard } from "./SimpleLinkCard";

import {
  RenderedElement,
  type RenderedNode,
  articleRichLink,
  assertSharedCardTree,
  brandIconOptions,
  collectElements,
  elementIndex,
  emailSimpleLink,
  firstElementOfType,
  firstElementWithClass,
  isRenderedElement,
  longArticleRichLink,
  longHandleRichLink,
  longSimpleLink,
  mockImageDimensionsByUrl,
  plainSimpleLink,
  reactRuntime,
  referralSimpleLink,
  renderedTextContent,
  richGithubLink,
  richSubstackLink,
  richSubstackSquarePreviewLink,
  simpleGithubLink,
  site,
} from "./non-payment-card-accessibility.test-helpers";

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
