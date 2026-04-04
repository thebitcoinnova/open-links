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

const firstElementOfType = (node: RenderedNode, type: string): RenderedElement | undefined =>
  collectElements(node).find((element) => element.type === type);

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

const simpleReferralLink = {
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

const richReferralLink = {
  id: "cluborange-referral",
  label: "Join Club Orange",
  url: "https://app.cluborange.org/pryszkie",
  type: "rich",
  icon: "cluborange",
  description: "Manual signup copy",
  metadata: {
    title: "Join Club Orange",
    description: "Fetched signup copy",
    sourceLabel: "app.cluborange.org",
    image: "/cache/content-images/cluborange-referral-preview.jpg",
    profileImage: "/cache/content-images/cluborange-referral-avatar.jpg",
  },
  enrichment: {
    profileSemantics: "non_profile",
  },
  referral: {
    kind: "referral",
    visitorBenefit: "Join Club Orange starting at $40/year",
    ownerBenefit: "Supports the project",
    offerSummary: "Get Club Orange access and connect with Bitcoin builders.",
    termsSummary:
      "Available to new members only. Pricing varies by plan and region. Additional terms may apply at signup.",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
  },
} as const satisfies OpenLink;

const softMarkerReferralLink = {
  id: "soft-referral",
  label: "OpenLinks Supporter Offer",
  url: "https://example.com/support",
  type: "simple",
  icon: "globe",
  description: "Fallback support offer copy",
  metadata: {
    title: "OpenLinks Supporter Offer",
    description: "Fallback support offer copy",
    sourceLabel: "example.com",
  },
  referral: {},
} as const satisfies OpenLink;

const oneSidedReferralLink = {
  id: "owner-benefit-only",
  label: "Support OpenLinks",
  url: "https://example.com/support",
  type: "simple",
  icon: "globe",
  description: "Fallback support offer copy",
  metadata: {
    title: "Support OpenLinks",
    description: "Fallback support offer copy",
    sourceLabel: "example.com",
  },
  referral: {
    ownerBenefit: "Supports the project",
    offerSummary: "Use this link if you want to support OpenLinks.",
  },
} as const satisfies OpenLink;

const brandIconOptions = resolveBrandIconOptions(site as SiteData);

test("simple referral cards render disclosure, benefit rows, and a sibling terms link", () => {
  // Arrange
  const tree = SimpleLinkCard({
    link: simpleReferralLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const primaryLink = firstElementOfType(tree, "a");
  const badge = firstElementWithClass(tree, "non-payment-card-referral-badge");
  const benefitRows = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("non-payment-card-referral-benefit-row")
    );
  });
  const termsSummary = firstElementWithClass(tree, "non-payment-card-referral-terms");
  const termsLink = collectElements(tree).find(
    (element) =>
      typeof element.props.class === "string" &&
      element.props.class.split(/\s+/u).includes("non-payment-card-referral-terms-link"),
  );

  // Assert
  assert.ok(frame);
  assert.equal(frame.props["data-has-referral"], "true");
  assert.ok(primaryLink);
  assert.equal(primaryLink.props["data-has-referral"], "true");
  assert.ok(badge);
  assert.equal(renderedTextContent(badge.props.children as RenderedNode), "Promo");
  assert.equal(benefitRows.length, 2);
  assert.equal(
    renderedTextContent(benefitRows[0]?.props.children as RenderedNode),
    "You getGet 20% off your first order",
  );
  assert.equal(
    renderedTextContent(benefitRows[1]?.props.children as RenderedNode),
    "SupportsSupports the project",
  );
  assert.ok(termsSummary);
  assert.equal(
    renderedTextContent(termsSummary.props.children as RenderedNode),
    "New customers only. Cannot be combined with other offers.",
  );
  assert.ok(termsLink);
  assert.equal(termsLink?.props.href, "https://example.com/referral-terms");
  assert.equal(renderedTextContent(termsLink?.props.children as RenderedNode), "Terms");

  const directChildren = (
    Array.isArray(frame.props.children) ? frame.props.children : [frame.props.children]
  )
    .filter(isRenderedElement)
    .map((element) => element.type);

  assert.deepEqual(directChildren, ["a", "div"]);
});

test("rich referral cards keep promo-image-led layout while rendering referral chrome in text surfaces", () => {
  // Arrange
  const tree = RichLinkCard({
    link: richReferralLink,
    viewModel: buildRichCardViewModel(site, richReferralLink),
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const frame = firstElementWithClass(tree, "non-payment-card-frame");
  const badge = firstElementWithClass(tree, "non-payment-card-referral-badge");
  const description = firstElementWithClass(tree, "non-payment-card-description");
  const previewLead = firstElementWithClass(tree, "non-payment-card-lead-media");
  const footerSourceLabel = firstElementWithClass(tree, "non-payment-card-source-label");
  const termsLink = firstElementWithClass(tree, "non-payment-card-referral-terms-link");

  // Assert
  assert.ok(frame);
  assert.equal(frame.props["data-has-referral"], "true");
  assert.equal(frame.props["data-card-variant"], "rich");
  assert.equal(frame.props["data-has-referral-terms-link"], "true");
  assert.equal(frame.props["data-lead-kind"], "preview");
  assert.equal(frame.props["data-image-treatment"], "cover");
  assert.ok(badge);
  assert.equal(renderedTextContent(badge.props.children as RenderedNode), "Referral");
  assert.ok(description);
  assert.equal(
    renderedTextContent(description.props.children as RenderedNode),
    "Get Club Orange access and connect with Bitcoin builders.",
  );
  assert.ok(previewLead);
  assert.ok(footerSourceLabel);
  assert.equal(
    renderedTextContent(footerSourceLabel.props.children as RenderedNode),
    "app.cluborange.org",
  );
  assert.ok(termsLink);
  assert.equal(termsLink.props.href, "https://www.cluborange.org/signup?referral=pryszkie");

  const summary = firstElementWithClass(tree, "non-payment-card-summary");
  const termsSummary = firstElementWithClass(tree, "non-payment-card-referral-terms");
  const summaryChildren = Array.isArray(summary?.props.children)
    ? summary?.props.children
    : [summary?.props.children];

  assert.ok(summary);
  assert.ok(description);
  assert.ok(termsSummary);
  assert.equal(summaryChildren.includes(description), true);
  assert.equal(summaryChildren.includes(termsSummary), true);
});

test("soft referral markers fall back to a generic badge without empty benefit rows", () => {
  // Arrange
  const tree = SimpleLinkCard({
    link: softMarkerReferralLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const badge = firstElementWithClass(tree, "non-payment-card-referral-badge");
  const benefitRows = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("non-payment-card-referral-benefit-row")
    );
  });
  const description = firstElementWithClass(tree, "non-payment-card-description");

  // Assert
  assert.ok(badge);
  assert.equal(renderedTextContent(badge.props.children as RenderedNode), "Referral");
  assert.equal(benefitRows.length, 0);
  assert.ok(description);
  assert.equal(
    renderedTextContent(description.props.children as RenderedNode),
    "Fallback support offer copy",
  );
});

test("one-sided referral disclosures render only the populated benefit row", () => {
  // Arrange
  const tree = SimpleLinkCard({
    link: oneSidedReferralLink,
    site,
    brandIconOptions,
    themeFingerprint: "test",
  }) as RenderedNode;

  // Act
  const benefitRows = collectElements(tree).filter((element) => {
    const classValue = element.props.class;
    return (
      typeof classValue === "string" &&
      classValue.split(/\s+/u).includes("non-payment-card-referral-benefit-row")
    );
  });

  // Assert
  assert.equal(benefitRows.length, 1);
  assert.equal(benefitRows[0]?.props["data-benefit-kind"], "owner");
  assert.equal(
    renderedTextContent(benefitRows[0]?.props.children as RenderedNode),
    "SupportsSupports the project",
  );
});
