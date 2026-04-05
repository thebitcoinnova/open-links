import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  type LinksData,
  type OpenLink,
  type RichLinkMetadata,
  mergeGeneratedMetadata,
} from "./load-content";
import { mergeReferralCatalogPayloads } from "./referral-catalog";
import type { ReferralCatalogPayload } from "./referral-catalog";
import type { GeneratedLinkReferralConfig } from "./referral-fields";

interface GeneratedRichMetadataPayload {
  links?: Record<string, { metadata?: RichLinkMetadata; referral?: GeneratedLinkReferralConfig }>;
}

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;

const linksData = readJson<LinksData>("../../../data/links.json");
const generatedMetadata = readJson<GeneratedRichMetadataPayload>(
  "../../../data/generated/rich-metadata.json",
);
const sharedReferralCatalog = readJson<ReferralCatalogPayload>(
  "../../../data/policy/referral-catalog.json",
);
const localReferralCatalog = readJson<ReferralCatalogPayload>(
  "../../../data/policy/referral-catalog.local.json",
);
const referralCatalog = mergeReferralCatalogPayloads(sharedReferralCatalog, localReferralCatalog);

test("real cluborange-referral data keeps manual owner terms while generated visitor and summary fields fill blanks", () => {
  // Arrange
  const sourceLink = linksData.links.find((entry) => entry.id === "cluborange-referral");
  const generatedReferral = generatedMetadata.links?.["cluborange-referral"]?.referral;
  const [resolvedLink] = mergeGeneratedMetadata(
    [sourceLink as OpenLink],
    {
      "cluborange-referral": generatedMetadata.links?.["cluborange-referral"] ?? {},
    },
    referralCatalog,
  );

  // Assert
  assert.ok(sourceLink);
  assert.ok(resolvedLink);
  assert.deepEqual(sourceLink.referral, {
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
      matcherId: "club-orange-signup-co-path",
    },
    ownerBenefit: "Supports the project",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
  });
  assert.equal(
    generatedReferral?.visitorBenefit,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
  assert.deepEqual(resolvedLink.referral, {
    kind: "referral",
    catalogRef: {
      familyId: "club-orange",
      offerId: "club-orange-signup",
      matcherId: "club-orange-signup-co-path",
    },
    visitorBenefit: "Get a Club Orange membership starting at $40/year or pay in sats.",
    ownerBenefit: "Supports the project",
    offerSummary: "Join Club Orange through a referral-aware signup link.",
    termsSummary:
      "See the current Club Orange signup page for the latest referral terms and eligibility details.",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    catalog: {
      source: "explicit",
      familyId: "club-orange",
      familyLabel: "Club Orange",
      offerId: "club-orange-signup",
      offerLabel: "Club Orange signup referral",
      matcherId: "club-orange-signup-co-path",
      matcherLabel: "Hosted signup path code",
      matcherExplanation:
        "Club Orange hosted signup links encode the referral token in the /co/<code> path.",
      canonicalProgramUrl: "https://www.cluborange.org/signup",
    },
    completeness: "full",
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    termsSourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    provenance: {
      kind: "catalog",
      visitorBenefit: "generated",
      ownerBenefit: "manual",
      offerSummary: "catalog",
      termsSummary: "catalog",
      termsUrl: "manual",
    },
  });
});

test("real lemonade-referral data keeps manual title and owner benefit while generated media fills blanks", () => {
  // Arrange
  const sourceLink = linksData.links.find((entry) => entry.id === "lemonade-referral");
  const generatedReferral = generatedMetadata.links?.["lemonade-referral"]?.referral;
  const [resolvedLink] = mergeGeneratedMetadata(
    [sourceLink as OpenLink],
    {
      "lemonade-referral": generatedMetadata.links?.["lemonade-referral"] ?? {},
    },
    referralCatalog,
  );

  // Assert
  assert.ok(sourceLink);
  assert.ok(resolvedLink);
  assert.deepEqual(sourceLink.referral, {
    catalogRef: {
      familyId: "lemonade",
      offerId: "lemonade-referral",
      matcherId: "lemonade-referral-short-path",
    },
    ownerBenefit: "Referrer may receive a $10 gift card for each qualified signup.",
  });
  assert.equal(sourceLink.metadata?.title, "Lemonade Referral");
  assert.equal(sourceLink.metadata?.descriptionSource, "manual");
  assert.equal(
    generatedReferral?.visitorBenefit,
    "Get a Lemonade insurance policy in 90 seconds, starting at $5/month.",
  );
  assert.equal(resolvedLink.metadata?.title, "Lemonade Referral");
  assert.equal(resolvedLink.metadata?.descriptionSource, "manual");
  assert.equal(
    resolvedLink.metadata?.image,
    "https://monolith-assets.lemonade.com/lemonade-share-image.e5edb258d8ac2711c113.png",
  );
  assert.deepEqual(resolvedLink.referral, {
    kind: "referral",
    catalogRef: {
      familyId: "lemonade",
      offerId: "lemonade-referral",
      matcherId: "lemonade-referral-short-path",
    },
    visitorBenefit: "Get a Lemonade insurance policy in 90 seconds, starting at $5/month.",
    ownerBenefit: "Referrer may receive a $10 gift card for each qualified signup.",
    offerSummary: "Use this Lemonade referral link to start a Lemonade signup.",
    termsSummary:
      "Available to eligible individuals outside LA, MI, MS, WA, and WV. Rewards are limited to 10 qualified referrals over 12 months. See Lemonade for current terms and eligibility details.",
    termsUrl: "https://www.lemonade.com/terms-and-conditions-referral-program",
    catalog: {
      source: "explicit",
      familyId: "lemonade",
      familyLabel: "Lemonade",
      offerId: "lemonade-referral",
      offerLabel: "Lemonade referral link",
      matcherId: "lemonade-referral-short-path",
      matcherLabel: "Referral short-link path",
      matcherExplanation:
        "Lemonade share links encode the referral handle in the /r/<handle> path.",
      canonicalProgramUrl: "https://www.lemonade.com/terms-and-conditions-referral-program",
    },
    completeness: "full",
    originalUrl: "https://lemonade.com/r/peterryszkiewicz",
    resolvedUrl: "https://www.lemonade.com/onboarding?has_account=false",
    strategyId: "public-direct-html",
    termsSourceUrl: "https://www.lemonade.com/onboarding?has_account=false",
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

test("links without catalog refs or matcher hits keep their prior no-referral runtime behavior", () => {
  // Arrange
  const sourceLink = linksData.links.find((entry) => entry.id === "github");
  const [resolvedLink] = mergeGeneratedMetadata(
    [sourceLink as OpenLink],
    {
      github: generatedMetadata.links?.github ?? {},
    },
    referralCatalog,
  );

  // Assert
  assert.ok(sourceLink);
  assert.ok(resolvedLink);
  assert.equal(resolvedLink.referral, undefined);
});
