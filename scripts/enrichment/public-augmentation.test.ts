import { test } from "bun:test";
import assert from "node:assert/strict";
import { mergeReferralWithManualOverrides } from "../../src/lib/content/referral-fields";
import {
  extractYoutubeProfileImageUrl,
  extractYoutubeSubscriberCountRaw,
  parseInstagramProfileMetadata,
  parseYoutubeProfileMetadata,
  resolvePublicAugmentationTarget,
  resolvePublicReferralAugmentation,
} from "./public-augmentation";

test("resolves an X public augmentation target that uses oEmbed instead of direct page fetch", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/pryszkie",
    icon: "x",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "x-public-oembed");
  assert.equal(target.acceptHeader, "application/json");
  assert.match(target.sourceUrl, /^https:\/\/publish\.twitter\.com\/oembed\?/);
});

test("resolves an X community augmentation target that fetches the community page directly", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://x.com/i/communities/1871996451812769951",
    icon: "x",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "x-public-community");
  assert.equal(target.sourceUrl, "https://x.com/i/communities/1871996451812769951");
  assert.equal(target.acceptHeader, undefined);
});

test("resolves a Club Orange referral-host augmentation target to the canonical signup page", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://signup.cluborange.org/co/PrySzkie-42",
    icon: "cluborange",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "cluborange-referral-signup");
  assert.equal(target.originalUrl, "https://signup.cluborange.org/co/PrySzkie-42");
  assert.equal(target.sourceUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
});

test("resolves a canonical Club Orange signup referral URL through the same augmentation target", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://www.cluborange.org/signup?referral=PrySzkie-42",
    icon: "cluborange",
  });

  // Assert
  assert.ok(target);
  assert.equal(target.id, "cluborange-referral-signup");
  assert.equal(target.originalUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
  assert.equal(target.sourceUrl, "https://www.cluborange.org/signup?referral=PrySzkie-42");
});

test("parses Club Orange referral signup metadata from the canonical public signup page", () => {
  // Arrange
  const target = resolvePublicAugmentationTarget({
    url: "https://signup.cluborange.org/co/pryszkie",
    icon: "cluborange",
  });
  const html = `
    <html>
      <head>
        <title>Join Club Orange — Connect with 19K+ Bitcoiners</title>
        <meta
          name="description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta property="og:title" content="Join Club Orange — Connect with 19K+ Bitcoiners" />
        <meta
          property="og:description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta
          property="og:image"
          content="https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp"
        />
        <meta property="twitter:title" content="Join Club Orange — Connect with 19K+ Bitcoiners" />
        <meta
          property="twitter:description"
          content="Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats."
        />
        <meta
          property="twitter:image"
          content="https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp"
        />
      </head>
    </html>
  `;

  // Act
  const parsed = target?.parse(html);

  // Assert
  assert.equal(parsed?.completeness, "full");
  assert.equal(parsed?.metadata.title, "Join Club Orange — Connect with 19K+ Bitcoiners");
  assert.equal(
    parsed?.metadata.description,
    "Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.equal(
    parsed?.metadata.image,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(
    parsed?.metadata.ogImage,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(
    parsed?.metadata.twitterImage,
    "https://cdn.prod.website-files.com/example/bitcoin-social-layer.webp",
  );
  assert.equal(parsed?.metadata.sourceLabel, "signup.cluborange.org");
  assert.equal(parsed?.metadata.profileImage, undefined);
});

test("extracts referral offer and terms data from Club Orange public metadata", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    sourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    metadata: {
      title: "Join Club Orange — Connect with 19K+ Bitcoiners",
      description:
        "Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats.",
    },
  });

  assert.deepEqual(referral, {
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
      matcherId: "club-orange-signup-query-referral",
    },
    catalog: {
      source: "matcher",
      familyId: "club-orange",
      familyLabel: "Club Orange",
      offerId: "club-orange-signup",
      offerLabel: "Club Orange signup referral",
      matcherId: "club-orange-signup-query-referral",
      matcherLabel: "Canonical signup referral query",
      matcherExplanation:
        "The canonical Club Orange signup page uses the referral query parameter to carry the token.",
      canonicalProgramUrl: "https://www.cluborange.org/signup",
    },
    kind: "referral",
    visitorBenefit: "Get a Club Orange membership starting at $40/year or pay in sats.",
    ownerBenefit: "Supports the project",
    offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
    termsSummary: "Get a Club Orange membership starting at $40/year or pay in sats.",
    termsUrl: "https://www.cluborange.org/signup",
    completeness: "full",
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    termsSourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    provenance: {
      kind: "catalog",
      visitorBenefit: "generated",
      ownerBenefit: "catalog",
      offerSummary: "generated",
      termsSummary: "generated",
      termsUrl: "catalog",
    },
  });
});

test("keeps manual Club Orange overrides authoritative over catalog-backed generated output", () => {
  const generatedReferral = resolvePublicReferralAugmentation({
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    sourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    metadata: {
      title: "Join Club Orange — Connect with 19K+ Bitcoiners",
      description:
        "Join 19,000+ Bitcoiners in 71 countries. Get a Club Orange membership starting at $40/year or pay in sats.",
    },
  });

  const merged = mergeReferralWithManualOverrides(
    {
      catalogRef: {
        familyId: "club-orange",
        offerId: "club-orange-signup",
        matcherId: "club-orange-signup-co-path",
      },
      ownerBenefit: "Supports the project",
      termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    },
    generatedReferral,
    undefined,
  );

  assert.equal(merged?.ownerBenefit, "Supports the project");
  assert.equal(merged?.termsUrl, "https://www.cluborange.org/signup?referral=pryszkie");
  assert.equal(
    merged?.visitorBenefit,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.deepEqual(merged?.provenance, {
    kind: "catalog",
    visitorBenefit: "generated",
    ownerBenefit: "manual",
    offerSummary: "generated",
    termsSummary: "generated",
    termsUrl: "manual",
  });
});

test("prefers omission over inference for ambiguous direct referral pages", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Example Company",
      description: "We build tools for teams.",
    },
  });

  assert.deepEqual(referral, {
    kind: "promo",
    completeness: "none",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("captures partial referral output when only the promo headline is clear", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Get $20 off your first order",
      description: "Discover premium widgets.",
    },
  });

  assert.deepEqual(referral, {
    kind: "promo",
    visitorBenefit: "Get $20 off your first order",
    offerSummary: "Get $20 off your first order",
    completeness: "partial",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("captures an explicit visitor benefit from static public copy", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Premium Widgets",
      description: "Get $20 off your first order.",
    },
  });

  assert.deepEqual(referral, {
    kind: "promo",
    visitorBenefit: "Get $20 off your first order.",
    offerSummary: "Get $20 off your first order.",
    completeness: "partial",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("captures an explicit owner benefit from static public copy", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "referral",
    },
    metadata: {
      title: "Example Company",
      description: "Supports the project.",
    },
  });

  assert.deepEqual(referral, {
    kind: "referral",
    ownerBenefit: "Supports the project.",
    completeness: "none",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("captures both visitor and owner benefits when static public copy states both sides directly", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Premium Widgets",
      description: "Get $20 off your first order. Supports the project.",
    },
  });

  assert.deepEqual(referral, {
    kind: "promo",
    visitorBenefit: "Get $20 off your first order.",
    ownerBenefit: "Supports the project.",
    offerSummary: "Get $20 off your first order.",
    completeness: "partial",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("captures visitor and owner benefits from browser-supplied candidate text using the same explicit-only rules", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Example Company",
      description: "Discover premium widgets.",
    },
    benefitTextCandidates: ["Get $20 off your first order.", "Supports the project."],
  });

  assert.deepEqual(referral, {
    kind: "promo",
    visitorBenefit: "Get $20 off your first order.",
    ownerBenefit: "Supports the project.",
    completeness: "none",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});

test("skips public referral extraction when the resolved url is auth gated", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://bit.ly/private-offer",
    sourceUrl: "https://bit.ly/private-offer",
    finalUrl: "https://example.com/login?ref=alice",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "referral",
    },
    metadata: {
      title: "Get $20 off your first order",
      description: "New users only.",
    },
  });

  assert.equal(referral, undefined);
});

test("omits visitor and owner benefits when the public copy is too ambiguous", () => {
  const referral = resolvePublicReferralAugmentation({
    originalUrl: "https://example.com/deal",
    sourceUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
    manualReferral: {
      kind: "promo",
    },
    metadata: {
      title: "Example Company",
      description: "Discover premium widgets and member perks.",
    },
  });

  assert.deepEqual(referral, {
    kind: "promo",
    completeness: "none",
    originalUrl: "https://example.com/deal",
    resolvedUrl: "https://example.com/deal",
    strategyId: "public-direct-html",
  });
});
