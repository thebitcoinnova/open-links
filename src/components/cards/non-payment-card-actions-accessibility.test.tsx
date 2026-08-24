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
