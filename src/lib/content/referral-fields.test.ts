import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_MEANINGFUL_FIELDS,
  hasMeaningfulReferralContent,
  isReferralKind,
  mergeReferralWithManualOverrides,
  normalizeReferralConfig,
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
  });
});
