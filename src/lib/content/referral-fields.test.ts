import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_MEANINGFUL_FIELDS,
  hasMeaningfulReferralContent,
  isReferralKind,
  mergeReferralWithManualOverrides,
  normalizeReferralConfig,
  normalizeReferralProvenance,
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
      kind: "referral",
      visitorBenefit: "Generated visitor benefit",
      ownerBenefit: "Creator receives store credit",
      offerSummary: "Save on your first order",
      termsSummary: "Generated terms",
    },
  );

  assert.deepEqual(merged, {
    kind: "referral",
    visitorBenefit: "Get 20% off",
    ownerBenefit: "Creator receives store credit",
    offerSummary: "Save on your first order",
    termsSummary: "New users only",
    provenance: {
      kind: "generated",
      visitorBenefit: "manual",
      ownerBenefit: "generated",
      offerSummary: "generated",
      termsSummary: "manual",
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
    offerSummary: "generated",
    code: "manual",
    custom: "generated",
    unsupported: "manual",
  });

  assert.deepEqual(provenance, {
    offerSummary: "generated",
    code: "manual",
  });
});
