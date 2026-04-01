import assert from "node:assert/strict";
import test from "node:test";
import {
  type ReferralCatalogPayload,
  mergeReferralCatalogPayloads,
  resolveReferralCatalogForLink,
  resolveReferralCatalogMatcher,
  resolveReferralCatalogRef,
} from "./referral-catalog";

const baseCatalog = mergeReferralCatalogPayloads(
  {
    version: 1,
    updatedAt: "2026-03-31T10:00:00.000Z",
    families: [
      {
        familyId: "club-orange",
        label: "Club Orange",
        kind: "referral",
        canonicalProgramUrl: "https://www.cluborange.org/signup",
        canonicalHosts: ["www.cluborange.org", "signup.cluborange.org"],
      },
      {
        familyId: "shared-family",
        label: "Shared Family",
        kind: "affiliate",
        canonicalProgramUrl: "https://shared.example.com/join",
      },
    ],
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "club-orange",
        label: "Club Orange signup",
        kind: "referral",
        ownerBenefit: "Supports the project",
        offerSummary: "Join Club Orange through the signup flow.",
        termsUrl: "https://www.cluborange.org/signup",
      },
      {
        offerId: "shared-offer",
        familyId: "shared-family",
        label: "Shared offer",
        ownerBenefit: "Shared owner benefit",
      },
    ],
    matchers: [
      {
        matcherId: "club-orange-signup-co-path",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Hosted signup path code",
        explanation: "Matches hosted /co/<code> links.",
        hosts: ["signup.cluborange.org"],
        pathPrefix: "/co/",
      },
      {
        matcherId: "club-orange-signup-query-referral",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Canonical signup referral query",
        explanation: "Matches canonical signup referral query links.",
        hosts: ["www.cluborange.org", "cluborange.org"],
        pathExact: "/signup",
        requiredQueryKeys: ["referral"],
      },
    ],
  },
  undefined,
);

test("local overlay entries replace shared catalog ids while preserving untouched shared entries", () => {
  const localOverlay: ReferralCatalogPayload = {
    version: 1,
    updatedAt: "2026-03-31T11:00:00.000Z",
    offers: [
      {
        offerId: "club-orange-signup",
        familyId: "club-orange",
        label: "Club Orange signup",
        ownerBenefit: "Local owner benefit",
      },
      {
        offerId: "fork-only-offer",
        familyId: "shared-family",
        label: "Fork-only offer",
      },
    ],
    matchers: [
      {
        matcherId: "fork-only-wrapper",
        familyId: "shared-family",
        offerId: "fork-only-offer",
        label: "Fork-only wrapper",
        explanation: "Matches the fork-local wrapper path.",
        hosts: ["fork.example.com"],
        pathPrefix: "/r/",
      },
    ],
  };

  const merged = mergeReferralCatalogPayloads(baseCatalog, localOverlay);

  assert.equal(merged.updatedAt, "2026-03-31T11:00:00.000Z");
  assert.equal(
    merged.offers.find((offer) => offer.offerId === "club-orange-signup")?.ownerBenefit,
    "Local owner benefit",
  );
  assert.ok(merged.offers.find((offer) => offer.offerId === "shared-offer"));
  assert.ok(merged.offers.find((offer) => offer.offerId === "fork-only-offer"));
  assert.ok(merged.matchers.find((matcher) => matcher.matcherId === "fork-only-wrapper"));
});

test("explicit matcher refs resolve the seeded catalog defaults and preserve the resolved catalog ref", () => {
  const resolution = resolveReferralCatalogRef(baseCatalog, {
    matcherId: "club-orange-signup-query-referral",
  });

  assert.deepEqual(resolution, {
    source: "explicit",
    family: baseCatalog.families.find((family) => family.familyId === "club-orange"),
    offer: baseCatalog.offers.find((offer) => offer.offerId === "club-orange-signup"),
    matcher: baseCatalog.matchers.find(
      (matcher) => matcher.matcherId === "club-orange-signup-query-referral",
    ),
    referral: {
      kind: "referral",
      catalogRef: {
        familyId: "club-orange",
        offerId: "club-orange-signup",
        matcherId: "club-orange-signup-query-referral",
      },
      ownerBenefit: "Supports the project",
      offerSummary: "Join Club Orange through the signup flow.",
      termsUrl: "https://www.cluborange.org/signup",
    },
  });
});

test("matcher lookup resolves a unique strongest candidate and returns its seeded referral defaults", () => {
  const resolution = resolveReferralCatalogMatcher(
    baseCatalog,
    "https://www.cluborange.org/signup?referral=pryszkie",
  );

  assert.equal(resolution?.source, "matcher");
  assert.equal(resolution?.matcher?.matcherId, "club-orange-signup-query-referral");
  assert.deepEqual(resolution?.referral.catalogRef, {
    familyId: "club-orange",
    offerId: "club-orange-signup",
    matcherId: "club-orange-signup-query-referral",
  });
});

test("explicit refs win before matcher fallback when both could resolve the same link", () => {
  const resolution = resolveReferralCatalogForLink({
    catalog: baseCatalog,
    sourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    referral: {
      catalogRef: {
        offerId: "shared-offer",
      },
    },
  });

  assert.equal(resolution?.source, "explicit");
  assert.equal(resolution?.offer.offerId, "shared-offer");
  assert.equal(resolution?.matcher, undefined);
});

test("matcher fallback stays deterministic and refuses ties or weak host-only matches", () => {
  const tiedCatalog = mergeReferralCatalogPayloads(baseCatalog, {
    version: 1,
    updatedAt: "2026-03-31T12:00:00.000Z",
    matchers: [
      {
        matcherId: "club-orange-signup-query-referral-duplicate",
        familyId: "club-orange",
        offerId: "club-orange-signup",
        label: "Duplicate canonical signup matcher",
        explanation: "Creates a same-strength tie for canonical referral links.",
        hosts: ["www.cluborange.org"],
        pathExact: "/signup",
        requiredQueryKeys: ["referral"],
      },
      {
        matcherId: "shared-host-only",
        familyId: "shared-family",
        offerId: "shared-offer",
        label: "Host-only matcher",
        explanation: "Too weak because it only matches the host.",
        hosts: ["shared.example.com"],
      },
    ],
  });

  assert.equal(
    resolveReferralCatalogMatcher(
      tiedCatalog,
      "https://www.cluborange.org/signup?referral=pryszkie",
    ),
    undefined,
  );
  assert.equal(
    resolveReferralCatalogMatcher(tiedCatalog, "https://shared.example.com/join"),
    undefined,
  );
});
