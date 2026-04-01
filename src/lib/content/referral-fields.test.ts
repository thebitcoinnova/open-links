import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_MEANINGFUL_FIELDS,
  hasMeaningfulReferralContent,
  isReferralCompleteness,
  isReferralKind,
  mergeReferralWithManualOverrides,
  normalizeReferralCatalogRef,
  normalizeReferralConfig,
  normalizeReferralProvenance,
  resolveReferralCompleteness,
} from "./referral-fields";

test("referral kinds are limited to the approved umbrella values", () => {
  assert.equal(isReferralKind("referral"), true);
  assert.equal(isReferralKind("affiliate"), true);
  assert.equal(isReferralKind("promo"), true);
  assert.equal(isReferralKind("invite"), true);
  assert.equal(isReferralKind("creator-support"), false);
});

test("soft referral markers stay valid while kind-only entries are not meaningful disclosure", () => {
  assert.deepEqual(normalizeReferralConfig({}), {});
  assert.equal(hasMeaningfulReferralContent({}), false);
  assert.equal(hasMeaningfulReferralContent({ kind: "promo" }), false);
  assert.deepEqual(REFERRAL_MEANINGFUL_FIELDS, [
    "visitorBenefit",
    "ownerBenefit",
    "offerSummary",
    "termsSummary",
    "termsUrl",
    "code",
  ]);
});

test("one-sided referral disclosure counts as meaningful content", () => {
  assert.equal(
    hasMeaningfulReferralContent({
      visitorBenefit: "Get $20 off your first order",
    }),
    true,
  );
  assert.equal(
    hasMeaningfulReferralContent({
      ownerBenefit: "Supports the project",
    }),
    true,
  );
});

test("manual referral fields override generated values while blank manual fields do not block fill-in", () => {
  const merged = mergeReferralWithManualOverrides(
    {
      visitorBenefit: "Get 20% off",
      ownerBenefit: "  ",
      termsSummary: "New users only",
    },
    {
      visitorBenefit: "Generated visitor benefit",
      ownerBenefit: "Creator receives store credit",
      offerSummary: "Generated offer summary",
      termsSummary: "Generated terms",
    },
    {
      kind: "referral",
      ownerBenefit: "Catalog owner benefit",
      offerSummary: "Catalog offer summary",
      termsUrl: "https://example.com/catalog-terms",
    },
  );

  assert.deepEqual(merged, {
    kind: "referral",
    visitorBenefit: "Get 20% off",
    ownerBenefit: "Catalog owner benefit",
    offerSummary: "Catalog offer summary",
    termsSummary: "New users only",
    termsUrl: "https://example.com/catalog-terms",
    provenance: {
      kind: "catalog",
      visitorBenefit: "manual",
      ownerBenefit: "catalog",
      offerSummary: "catalog",
      termsSummary: "manual",
      termsUrl: "catalog",
    },
  });
});

test("soft markers stay additive and blank text does not create fake disclosure content", () => {
  const normalized = normalizeReferralConfig({
    kind: "promo",
    visitorBenefit: "   ",
    ownerBenefit: "\n",
  });
  const merged = mergeReferralWithManualOverrides({}, { kind: "invite" });

  assert.deepEqual(normalized, { kind: "promo" });
  assert.equal(hasMeaningfulReferralContent(normalized), false);
  assert.deepEqual(merged, {
    kind: "invite",
    provenance: {
      kind: "generated",
    },
  });
});

test("generated provenance maps are normalized to supported referral fields only", () => {
  const provenance = normalizeReferralProvenance({
    kind: "catalog",
    offerSummary: "generated",
    code: "manual",
    custom: "generated",
    unsupported: "manual",
  });

  assert.deepEqual(provenance, {
    kind: "catalog",
    offerSummary: "generated",
    code: "manual",
  });
});

test("catalog references are optional, trimmed, and preserved in normalized referral config", () => {
  const catalogRef = normalizeReferralCatalogRef({
    familyId: " club-orange ",
    offerId: "club-orange-signup",
    matcherId: " ",
  });
  const normalized = normalizeReferralConfig({
    catalogRef: {
      familyId: " club-orange ",
      offerId: " club-orange-signup ",
    },
    ownerBenefit: " Supports the project ",
  });

  assert.deepEqual(catalogRef, {
    familyId: "club-orange",
    offerId: "club-orange-signup",
  });
  assert.deepEqual(normalized, {
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
    },
    ownerBenefit: "Supports the project",
  });
});

test("generated referral fields normalize completeness and structured provenance urls", () => {
  const normalized = normalizeReferralConfig({
    offerSummary: "Save on your first year",
    termsSummary: "New users only",
    completeness: "full",
    originalUrl: " https://bit.ly/openlinks ",
    resolvedUrl: " https://example.com/signup?ref=alice ",
    strategyId: "public-direct-html",
    termsSourceUrl: " https://example.com/signup?ref=alice#terms ",
  });

  assert.equal(isReferralCompleteness("full"), true);
  assert.equal(isReferralCompleteness("mystery"), false);
  assert.deepEqual(normalized, {
    offerSummary: "Save on your first year",
    termsSummary: "New users only",
    completeness: "full",
    originalUrl: "https://bit.ly/openlinks",
    resolvedUrl: "https://example.com/signup?ref=alice",
    strategyId: "public-direct-html",
    termsSourceUrl: "https://example.com/signup?ref=alice#terms",
  });
  assert.equal(resolveReferralCompleteness(normalized), "full");
  assert.equal(resolveReferralCompleteness({ offerSummary: "Save now" }), "partial");
  assert.equal(resolveReferralCompleteness({ kind: "referral" }), "none");
});

test("manual refs stay on the outward contract while catalog provenance stays explainable", () => {
  const merged = mergeReferralWithManualOverrides(
    {
      catalogRef: {
        familyId: "club-orange",
        offerId: "club-orange-signup",
      },
      ownerBenefit: "Supports the project",
    },
    {
      visitorBenefit: "Generated visitor benefit",
      termsSummary: "Generated terms summary",
    },
    {
      kind: "referral",
      catalogRef: {
        familyId: "club-orange",
        offerId: "club-orange-signup",
        matcherId: "club-orange-signup-query-referral",
      },
      offerSummary: "Catalog offer summary",
      termsSummary: "Catalog terms summary",
      termsUrl: "https://www.cluborange.org/signup",
    },
  );

  assert.deepEqual(merged, {
    kind: "referral",
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
    },
    visitorBenefit: "Generated visitor benefit",
    ownerBenefit: "Supports the project",
    offerSummary: "Catalog offer summary",
    termsSummary: "Catalog terms summary",
    termsUrl: "https://www.cluborange.org/signup",
    provenance: {
      kind: "catalog",
      visitorBenefit: "generated",
      ownerBenefit: "manual",
      offerSummary: "catalog",
      termsSummary: "catalog",
      termsUrl: "catalog",
    },
  });
});
