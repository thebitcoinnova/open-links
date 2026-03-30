import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { LinksData, RichLinkMetadata } from "./load-content";
import {
  type GeneratedLinkReferralConfig,
  mergeReferralWithManualOverrides,
} from "./referral-fields";

interface GeneratedRichMetadataPayload {
  links?: Record<string, { metadata?: RichLinkMetadata; referral?: GeneratedLinkReferralConfig }>;
}

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;

const linksData = readJson<LinksData>("../../../data/links.json");
const generatedMetadata = readJson<GeneratedRichMetadataPayload>(
  "../../../data/generated/rich-metadata.json",
);

test("real cluborange-referral data merges source-authored referral fields with generated blank-fill output", () => {
  // Arrange
  const sourceLink = linksData.links.find((entry) => entry.id === "cluborange-referral");
  const generatedReferral = generatedMetadata.links?.["cluborange-referral"]?.referral;

  // Act
  const mergedReferral = mergeReferralWithManualOverrides(sourceLink?.referral, generatedReferral);

  // Assert
  assert.ok(sourceLink);
  assert.deepEqual(sourceLink.referral, {
    kind: "referral",
    ownerBenefit: "Supports the project",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
  });
  assert.deepEqual(mergedReferral, {
    kind: "referral",
    ownerBenefit: "Supports the project",
    offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
    termsSummary: "Get a Club Orange membership starting at $40/year or pay in sats.",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    completeness: "full",
    originalUrl: "https://signup.cluborange.org/co/pryszkie",
    resolvedUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    strategyId: "cluborange-referral-signup",
    termsSourceUrl: "https://www.cluborange.org/signup?referral=pryszkie",
    provenance: {
      kind: "manual",
      ownerBenefit: "manual",
      offerSummary: "generated",
      termsSummary: "generated",
      termsUrl: "manual",
    },
  });
});
