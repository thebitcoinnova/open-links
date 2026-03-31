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
    kind: "referral",
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
    completeness: "full",
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    termsSourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    provenance: {
      kind: "manual",
      visitorBenefit: "generated",
      ownerBenefit: "manual",
      offerSummary: "catalog",
      termsSummary: "catalog",
      termsUrl: "manual",
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
