import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubOrangeReferralSignupUrl,
  extractClubOrangeReferralCode,
  resolveReferralTarget,
} from "./referral-targets";

test("normalizes Club Orange referral wrappers to the canonical signup target", () => {
  const resolved = resolveReferralTarget({
    url: "https://signup.cluborange.org/co/PrySzkie-42",
  });

  assert.deepEqual(resolved, {
    originalUrl: "https://signup.cluborange.org/co/PrySzkie-42",
    sourceUrl: "https://www.cluborange.org/signup?referral=PrySzkie-42",
    pattern: "known_family",
    preservedParams: ["referral"],
    strippedParams: [],
    referralParams: {
      referral: "PrySzkie-42",
    },
    knownFamilyId: "cluborange-referral-signup",
  });
});

test("preserves offer-affecting params and strips analytics params", () => {
  const resolved = resolveReferralTarget({
    url: "https://example.com/signup?ref=alice&utm_source=newsletter&fbclid=123",
  });

  assert.deepEqual(resolved, {
    originalUrl: "https://example.com/signup?ref=alice&utm_source=newsletter&fbclid=123",
    sourceUrl: "https://example.com/signup?ref=alice",
    pattern: "query_param",
    preservedParams: ["ref"],
    strippedParams: ["fbclid", "utm_source"],
    referralParams: {
      ref: "alice",
    },
    knownFamilyId: undefined,
  });
});

test("recognizes path-based referral urls", () => {
  const resolved = resolveReferralTarget({
    url: "https://example.com/invite/friend?utm_campaign=spring",
  });

  assert.deepEqual(resolved, {
    originalUrl: "https://example.com/invite/friend?utm_campaign=spring",
    sourceUrl: "https://example.com/invite/friend",
    pattern: "path_segment",
    preservedParams: [],
    strippedParams: ["utm_campaign"],
    referralParams: {},
    knownFamilyId: undefined,
  });
});

test("uses the final redirect target for shorteners while keeping the original url", () => {
  const resolved = resolveReferralTarget({
    url: "https://bit.ly/openlinks-referral",
    finalUrl: "https://example.com/signup?code=OPENLINKS&utm_medium=social",
  });

  assert.deepEqual(resolved, {
    originalUrl: "https://bit.ly/openlinks-referral",
    sourceUrl: "https://example.com/signup?code=OPENLINKS",
    pattern: "shortener",
    preservedParams: ["code"],
    strippedParams: ["utm_medium"],
    referralParams: {
      code: "OPENLINKS",
    },
    knownFamilyId: undefined,
  });
});

test("returns a direct target when no referral signal is present", () => {
  const resolved = resolveReferralTarget({
    url: "https://example.com/products",
  });

  assert.deepEqual(resolved, {
    originalUrl: "https://example.com/products",
    sourceUrl: "https://example.com/products",
    pattern: "direct",
    preservedParams: [],
    strippedParams: [],
    referralParams: {},
    knownFamilyId: undefined,
  });
});

test("extracts and rebuilds Club Orange referral codes consistently", () => {
  assert.equal(
    extractClubOrangeReferralCode("https://www.cluborange.org/signup?referral=pryszkie"),
    "pryszkie",
  );
  assert.equal(
    buildClubOrangeReferralSignupUrl("https://signup.cluborange.org/co/pryszkie"),
    "https://www.cluborange.org/signup?referral=pryszkie",
  );
});
