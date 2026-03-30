import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedLinkReferralConfig } from "../content/referral-fields";
import {
  formatReferralDisclosureLabel,
  resolveReferralCardPresentation,
} from "./referral-card-presentation";

test("formats approved referral kinds into human-readable disclosure labels", () => {
  // Arrange
  const cases = [
    ["referral", "Referral"],
    ["affiliate", "Affiliate"],
    ["promo", "Promo"],
    ["invite", "Invite"],
  ] as const;

  // Act / Assert
  for (const [kind, label] of cases) {
    assert.equal(formatReferralDisclosureLabel(kind), label);
  }
});

test("falls back to a generic disclosure label for soft referral markers", () => {
  // Act
  const presentation = resolveReferralCardPresentation({} satisfies ResolvedLinkReferralConfig);

  // Assert
  assert.equal(presentation?.disclosureLabel, "Referral");
  assert.deepEqual(presentation?.benefitRows, []);
  assert.equal(presentation?.offerSummary, undefined);
  assert.equal(presentation?.terms, undefined);
});

test("orders benefit rows visitor-first and preserves one-sided disclosures", () => {
  // Arrange
  const referral = {
    ownerBenefit: "Supports the project",
    visitorBenefit: "Get $20 off your first order",
  } satisfies ResolvedLinkReferralConfig;

  // Act
  const presentation = resolveReferralCardPresentation(referral);

  // Assert
  assert.deepEqual(presentation?.benefitRows, [
    {
      kind: "visitor",
      label: "You get",
      value: "Get $20 off your first order",
    },
    {
      kind: "owner",
      label: "Supports",
      value: "Supports the project",
    },
  ]);
});

test("keeps offer summaries available for the shared description slot", () => {
  // Arrange
  const referral = {
    kind: "promo",
    offerSummary: "Get 20% off your first order",
  } satisfies ResolvedLinkReferralConfig;

  // Act
  const presentation = resolveReferralCardPresentation(referral);

  // Assert
  assert.equal(presentation?.disclosureLabel, "Promo");
  assert.equal(presentation?.offerSummary, "Get 20% off your first order");
});

test("keeps short terms inline and exposes a quiet terms link when available", () => {
  // Arrange
  const referral = {
    termsSummary: "New users only. Terms apply.",
    termsUrl: "https://example.com/referral-terms",
  } satisfies ResolvedLinkReferralConfig;

  // Act
  const presentation = resolveReferralCardPresentation(referral);

  // Assert
  assert.deepEqual(presentation?.terms, {
    inlineSummary: "New users only. Terms apply.",
    isTruncated: false,
    linkLabel: "Terms",
    url: "https://example.com/referral-terms",
  });
});

test("truncates long inline terms without dropping the quiet terms link", () => {
  // Arrange
  const referral = {
    termsSummary:
      "Available to new customers in participating regions only. Discount applies to the first qualifying order and may not be combined with other offers or loyalty credits.",
    termsUrl: "https://example.com/referral-terms",
  } satisfies ResolvedLinkReferralConfig;

  // Act
  const presentation = resolveReferralCardPresentation(referral);

  // Assert
  assert.equal(presentation?.terms?.isTruncated, true);
  assert.ok(presentation?.terms?.inlineSummary?.endsWith("..."));
  assert.equal(presentation?.terms?.linkLabel, "Terms");
  assert.equal(presentation?.terms?.url, "https://example.com/referral-terms");
});
