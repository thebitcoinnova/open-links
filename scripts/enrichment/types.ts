import type {
  ExpectedSocialProfileField,
  SocialProfileMetadataFields,
  SupportedSocialProfilePlatform,
} from "../../src/lib/content/social-profile-fields";

export type {
  ExpectedSocialProfileField,
  SocialProfileMetadataFields,
  SupportedSocialProfilePlatform,
} from "../../src/lib/content/social-profile-fields";

export type EnrichmentStatus = "fetched" | "partial" | "failed" | "skipped";

export type EnrichmentReason =
  | "metadata_complete"
  | "metadata_partial"
  | "metadata_missing"
  | "fetch_failed"
  | "public_cache"
  | "authenticated_cache"
  | "authenticated_cache_missing"
  | "known_blocker"
  | "enrichment_disabled";

export type EnrichmentFailureReason = "fetch_failed" | "metadata_missing";
export type EnrichmentFailureMode = "immediate" | "aggregate";
export type EnrichmentMissingField = "title" | "description" | "image";

export interface EnrichmentMetadata extends SocialProfileMetadataFields {
  title?: string;
  description?: string;
  image?: string;
  ogImage?: string;
  twitterImage?: string;
  handle?: string;
  sourceLabel?: string;
  sourceLabelVisible?: boolean;
  enrichmentStatus?: EnrichmentStatus;
  enrichmentReason?: EnrichmentReason;
  enrichedAt?: string;
}

export interface GeneratedRichMetadata {
  generatedAt: string;
  links: Record<string, { metadata: EnrichmentMetadata }>;
}

export interface EnrichmentRunEntry {
  linkId: string;
  url: string;
  status: EnrichmentStatus;
  reason: EnrichmentReason;
  attempts: number;
  durationMs: number;
  message: string;
  remediation: string;
  statusCode?: number;
  metadata?: EnrichmentMetadata;
  blocking?: boolean;
  missingFields?: EnrichmentMissingField[];
  manualFallbackUsed?: boolean;
  extractorId?: string;
  cacheKey?: string;
  cacheCapturedAt?: string;
  staleCache?: boolean;
  supportedProfilePlatform?: SupportedSocialProfilePlatform;
  missingProfileFields?: ExpectedSocialProfileField[];
}

export interface EnrichmentRunSummary {
  total: number;
  fetched: number;
  partial: number;
  failed: number;
  skipped: number;
}

export interface EnrichmentRunReport {
  generatedAt: string;
  strict: boolean;
  summary: EnrichmentRunSummary;
  entries: EnrichmentRunEntry[];
  failureMode?: EnrichmentFailureMode;
  failOn?: EnrichmentFailureReason[];
  bypassActive?: boolean;
  abortedEarly?: boolean;
}
