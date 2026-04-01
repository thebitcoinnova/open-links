import assert from "node:assert/strict";
import test from "node:test";
import {
  areGeneratedRichMetadataEqual,
  buildStableGeneratedRichMetadata,
  stabilizeGeneratedRichMetadataEntry,
} from "./generated-metadata";
import type { GeneratedRichMetadata } from "./types";

test("preserves link enrichedAt when generated metadata payload is unchanged", () => {
  // Arrange
  const previous = {
    metadata: {
      title: "OpenLinks",
      description: "Example profile",
      image: "https://example.com/avatar.jpg",
      enrichmentStatus: "fetched",
      enrichmentReason: "metadata_complete",
      enrichedAt: "2026-03-16T20:00:00.000Z",
    },
  } satisfies GeneratedRichMetadata["links"][string];

  // Act
  const stabilized = stabilizeGeneratedRichMetadataEntry(previous, {
    metadata: {
      ...previous.metadata,
      enrichedAt: "2026-03-16T21:00:00.000Z",
    },
  });

  // Assert
  assert.equal(stabilized.metadata.enrichedAt, "2026-03-16T20:00:00.000Z");
});

test("updates link enrichedAt when generated metadata payload changes", () => {
  // Arrange
  const previous = {
    metadata: {
      title: "OpenLinks",
      description: "Example profile",
      image: "https://example.com/avatar.jpg",
      enrichmentStatus: "fetched",
      enrichmentReason: "metadata_complete",
      enrichedAt: "2026-03-16T20:00:00.000Z",
    },
  } satisfies GeneratedRichMetadata["links"][string];

  // Act
  const stabilized = stabilizeGeneratedRichMetadataEntry(previous, {
    metadata: {
      ...previous.metadata,
      description: "Updated profile",
      enrichedAt: "2026-03-16T21:00:00.000Z",
    },
  });

  // Assert
  assert.equal(stabilized.metadata.enrichedAt, "2026-03-16T21:00:00.000Z");
});

test("preserves manifest generatedAt when stabilized generated metadata is unchanged", () => {
  // Arrange
  const previous: GeneratedRichMetadata = {
    generatedAt: "2026-03-16T20:00:00.000Z",
    links: {
      github: {
        metadata: {
          title: "GitHub",
          description: "Code hosting",
          image: "https://example.com/github.jpg",
          enrichmentStatus: "fetched",
          enrichmentReason: "metadata_complete",
          enrichedAt: "2026-03-16T20:00:00.000Z",
        },
      },
    },
  };

  // Act
  const manifest = buildStableGeneratedRichMetadata({
    previousManifest: previous,
    links: {
      github: {
        metadata: {
          ...previous.links.github.metadata,
          enrichedAt: "2026-03-16T21:00:00.000Z",
        },
      },
    },
    generatedAt: "2026-03-16T21:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-16T20:00:00.000Z");
  assert.equal(areGeneratedRichMetadataEqual(previous, manifest), true);
});

test("stabilizes optional generated referral entries alongside metadata", () => {
  // Arrange
  const previous = {
    metadata: {
      title: "Club Orange",
      description: "Join Club Orange",
      image: "https://example.com/cluborange.jpg",
      enrichmentStatus: "fetched",
      enrichmentReason: "metadata_complete",
      enrichedAt: "2026-03-16T20:00:00.000Z",
    },
    referral: {
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
      visitorBenefit: "Get $20 off your first year",
      offerSummary: "Save on your first year",
      completeness: "partial",
      provenance: {
        kind: "generated",
        visitorBenefit: "generated",
        offerSummary: "generated",
      },
    },
  } satisfies GeneratedRichMetadata["links"][string];

  // Act
  const stabilized = stabilizeGeneratedRichMetadataEntry(previous, {
    metadata: {
      ...previous.metadata,
      enrichedAt: "2026-03-16T21:00:00.000Z",
    },
    referral: {
      ...previous.referral,
      visitorBenefit: "Get $20 off your first year",
      offerSummary: "Save on your first year",
    },
  });

  // Assert
  assert.equal(stabilized.metadata.enrichedAt, "2026-03-16T20:00:00.000Z");
  assert.deepEqual(stabilized.referral, previous.referral);
});

test("preserves manifest generatedAt when referral benefit payload is unchanged", () => {
  // Arrange
  const previous: GeneratedRichMetadata = {
    generatedAt: "2026-03-16T20:00:00.000Z",
    links: {
      "cluborange-referral": {
        metadata: {
          title: "Club Orange",
          description: "Join Club Orange",
          image: "https://example.com/cluborange.jpg",
          enrichmentStatus: "fetched",
          enrichmentReason: "metadata_complete",
          enrichedAt: "2026-03-16T20:00:00.000Z",
        },
        referral: {
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
          catalogRef: {
            familyId: "club-orange",
            offerId: "club-orange-signup",
            matcherId: "club-orange-signup-co-path",
          },
          kind: "referral",
          ownerBenefit: "Supports the project",
          visitorBenefit: "Get a Club Orange membership starting at $40/year or pay in sats.",
          offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
          termsSummary: "Get a Club Orange membership starting at $40/year or pay in sats.",
          termsUrl: "https://www.cluborange.org/signup",
          completeness: "full",
          provenance: {
            kind: "catalog",
            ownerBenefit: "catalog",
            termsUrl: "catalog",
            visitorBenefit: "generated",
            offerSummary: "generated",
            termsSummary: "generated",
          },
        },
      },
    },
  };

  // Act
  const manifest = buildStableGeneratedRichMetadata({
    previousManifest: previous,
    links: {
      "cluborange-referral": {
        metadata: {
          ...previous.links["cluborange-referral"].metadata,
          enrichedAt: "2026-03-16T21:00:00.000Z",
        },
        referral: {
          ...previous.links["cluborange-referral"].referral,
        },
      },
    },
    generatedAt: "2026-03-16T21:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-16T20:00:00.000Z");
  assert.equal(areGeneratedRichMetadataEqual(previous, manifest), true);
});

test("updates manifest generatedAt when referral benefit payload changes", () => {
  // Arrange
  const previous: GeneratedRichMetadata = {
    generatedAt: "2026-03-16T20:00:00.000Z",
    links: {
      "cluborange-referral": {
        metadata: {
          title: "Club Orange",
          description: "Join Club Orange",
          image: "https://example.com/cluborange.jpg",
          enrichmentStatus: "fetched",
          enrichmentReason: "metadata_complete",
          enrichedAt: "2026-03-16T20:00:00.000Z",
        },
        referral: {
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
          catalogRef: {
            familyId: "club-orange",
            offerId: "club-orange-signup",
            matcherId: "club-orange-signup-co-path",
          },
          kind: "referral",
          ownerBenefit: "Supports the project",
          offerSummary: "Join Club Orange — Connect with 19K+ Bitcoiners",
          termsSummary: "Get a Club Orange membership starting at $40/year or pay in sats.",
          termsUrl: "https://www.cluborange.org/signup",
          completeness: "full",
          provenance: {
            kind: "catalog",
            ownerBenefit: "catalog",
            termsUrl: "catalog",
            offerSummary: "generated",
            termsSummary: "generated",
          },
        },
      },
    },
  };

  // Act
  const manifest = buildStableGeneratedRichMetadata({
    previousManifest: previous,
    links: {
      "cluborange-referral": {
        metadata: {
          ...previous.links["cluborange-referral"].metadata,
          enrichedAt: "2026-03-16T21:00:00.000Z",
        },
        referral: {
          ...previous.links["cluborange-referral"].referral,
          visitorBenefit: "Get a Club Orange membership starting at $40/year or pay in sats.",
          provenance: {
            ...previous.links["cluborange-referral"].referral?.provenance,
            visitorBenefit: "generated",
          },
        },
      },
    },
    generatedAt: "2026-03-16T21:00:00.000Z",
  });

  // Assert
  assert.equal(manifest.generatedAt, "2026-03-16T21:00:00.000Z");
  assert.equal(areGeneratedRichMetadataEqual(previous, manifest), false);
  assert.equal(
    manifest.links["cluborange-referral"].referral?.visitorBenefit,
    "Get a Club Orange membership starting at $40/year or pay in sats.",
  );
});

test("treats metadata-only manifests as equal even when referral is absent", () => {
  // Arrange
  const previous: GeneratedRichMetadata = {
    generatedAt: "2026-03-16T20:00:00.000Z",
    links: {
      github: {
        metadata: {
          title: "GitHub",
          description: "Code hosting",
          image: "https://example.com/github.jpg",
          enrichmentStatus: "fetched",
          enrichmentReason: "metadata_complete",
          enrichedAt: "2026-03-16T20:00:00.000Z",
        },
      },
    },
  };

  // Act
  const manifest = buildStableGeneratedRichMetadata({
    previousManifest: previous,
    links: {
      github: {
        metadata: {
          ...previous.links.github.metadata,
          enrichedAt: "2026-03-16T21:00:00.000Z",
        },
      },
    },
    generatedAt: "2026-03-16T21:00:00.000Z",
  });

  // Assert
  assert.equal(areGeneratedRichMetadataEqual(previous, manifest), true);
});
