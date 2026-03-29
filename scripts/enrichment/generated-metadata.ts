import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  type GeneratedLinkReferralConfig,
  normalizeReferralConfig,
  normalizeReferralProvenance,
} from "../../src/lib/content/referral-fields";
import { SOCIAL_PROFILE_METADATA_FIELDS } from "../../src/lib/content/social-profile-fields";
import type { EnrichmentMetadata, GeneratedRichMetadata } from "./types";

interface GeneratedRichMetadataEntry {
  metadata: EnrichmentMetadata;
  referral?: GeneratedLinkReferralConfig;
}

const ROOT = process.cwd();

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeMetadata = (
  metadata: EnrichmentMetadata,
  options?: { includeEnrichedAt?: boolean },
): EnrichmentMetadata => {
  const normalized: EnrichmentMetadata = {};
  const normalizedRecord = normalized as Record<string, boolean | number | string | undefined>;

  if (trimToUndefined(metadata.title)) {
    normalized.title = trimToUndefined(metadata.title);
  }
  if (trimToUndefined(metadata.description)) {
    normalized.description = trimToUndefined(metadata.description);
  }
  if (trimToUndefined(metadata.image)) {
    normalized.image = trimToUndefined(metadata.image);
  }
  if (trimToUndefined(metadata.ogImage)) {
    normalized.ogImage = trimToUndefined(metadata.ogImage);
  }
  if (trimToUndefined(metadata.twitterImage)) {
    normalized.twitterImage = trimToUndefined(metadata.twitterImage);
  }
  if (trimToUndefined(metadata.handle)) {
    normalized.handle = trimToUndefined(metadata.handle);
  }
  if (trimToUndefined(metadata.sourceLabel)) {
    normalized.sourceLabel = trimToUndefined(metadata.sourceLabel);
  }
  if (typeof metadata.sourceLabelVisible === "boolean") {
    normalized.sourceLabelVisible = metadata.sourceLabelVisible;
  }
  if (trimToUndefined(metadata.enrichmentStatus)) {
    normalized.enrichmentStatus = trimToUndefined(
      metadata.enrichmentStatus,
    ) as EnrichmentMetadata["enrichmentStatus"];
  }
  if (trimToUndefined(metadata.enrichmentReason)) {
    normalized.enrichmentReason = trimToUndefined(
      metadata.enrichmentReason,
    ) as EnrichmentMetadata["enrichmentReason"];
  }
  if (options?.includeEnrichedAt !== false && trimToUndefined(metadata.enrichedAt)) {
    normalized.enrichedAt = trimToUndefined(metadata.enrichedAt);
  }

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = metadata[field];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalizedRecord[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      normalizedRecord[field] = value.trim();
    }
  }

  return normalized;
};

const normalizeEntry = (
  entry: GeneratedRichMetadataEntry,
  options?: { includeEnrichedAt?: boolean },
): GeneratedRichMetadataEntry => {
  const normalized: GeneratedRichMetadataEntry = {
    metadata: normalizeMetadata(entry.metadata, options),
  };
  const referral = normalizeReferralConfig(entry.referral);
  const provenance = normalizeReferralProvenance(referral?.provenance);

  if (referral) {
    normalized.referral = provenance ? { ...referral, provenance } : referral;
  }

  return normalized;
};

const areEntriesEqual = (
  left: GeneratedRichMetadataEntry | undefined,
  right: GeneratedRichMetadataEntry | undefined,
  options?: { includeEnrichedAt?: boolean },
): boolean => {
  if (!left || !right) {
    return left === right;
  }

  return (
    JSON.stringify(normalizeEntry(left, options)) === JSON.stringify(normalizeEntry(right, options))
  );
};

const areEntryMapsEqual = (
  left: Record<string, GeneratedRichMetadataEntry>,
  right: Record<string, GeneratedRichMetadataEntry>,
  options?: { includeEnrichedAt?: boolean },
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();

  if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) {
    return false;
  }

  return leftKeys.every((key) => areEntriesEqual(left[key], right[key], options));
};

export const stabilizeGeneratedRichMetadataEntry = (
  previousEntry: GeneratedRichMetadataEntry | undefined,
  nextEntry: GeneratedRichMetadataEntry,
): GeneratedRichMetadataEntry => {
  const normalizedNext = normalizeEntry(nextEntry);
  if (
    !previousEntry ||
    !areEntriesEqual(previousEntry, normalizedNext, { includeEnrichedAt: false })
  ) {
    return normalizedNext;
  }

  return normalizeEntry({
    metadata: {
      ...normalizedNext.metadata,
      enrichedAt:
        trimToUndefined(previousEntry.metadata.enrichedAt) ?? normalizedNext.metadata.enrichedAt,
    },
    referral: normalizedNext.referral ?? previousEntry.referral,
  });
};

export const buildStableGeneratedRichMetadata = (input: {
  previousManifest: GeneratedRichMetadata | null;
  links: GeneratedRichMetadata["links"];
  generatedAt: string;
}): GeneratedRichMetadata => {
  const stabilizedLinks = Object.fromEntries(
    Object.entries(input.links).map(([linkId, entry]) => [
      linkId,
      stabilizeGeneratedRichMetadataEntry(input.previousManifest?.links[linkId], entry),
    ]),
  ) as GeneratedRichMetadata["links"];

  return {
    generatedAt:
      input.previousManifest && areEntryMapsEqual(input.previousManifest.links, stabilizedLinks)
        ? input.previousManifest.generatedAt
        : input.generatedAt,
    links: stabilizedLinks,
  };
};

export const areGeneratedRichMetadataEqual = (
  left: GeneratedRichMetadata | null,
  right: GeneratedRichMetadata,
): boolean => {
  if (!left) {
    return false;
  }

  return left.generatedAt === right.generatedAt && areEntryMapsEqual(left.links, right.links);
};

export const readGeneratedRichMetadata = (manifestPath: string): GeneratedRichMetadata | null => {
  const absolute = absolutePath(manifestPath);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(absolute, "utf8")) as unknown;
    if (!isRecord(parsed) || !isRecord(parsed.links)) {
      return null;
    }

    const generatedAt = trimToUndefined(
      typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
    );
    if (!generatedAt) {
      return null;
    }

    const links: GeneratedRichMetadata["links"] = {};
    for (const [linkId, value] of Object.entries(parsed.links)) {
      if (!isRecord(value) || !isRecord(value.metadata)) {
        continue;
      }

      links[linkId] = normalizeEntry({
        metadata: value.metadata as EnrichmentMetadata,
        referral: isRecord(value.referral)
          ? (value.referral as GeneratedLinkReferralConfig)
          : undefined,
      });
    }

    return {
      generatedAt,
      links,
    };
  } catch {
    return null;
  }
};
