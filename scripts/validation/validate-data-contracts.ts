import process from "node:process";
import { FOLLOWER_HISTORY_INDEX_PUBLIC_PATH } from "../../src/lib/analytics/follower-history";
import type { GeneratedLinkReferralConfig } from "../../src/lib/content/referral-fields";
import { DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH } from "../shared/remote-cache-policy";

export type OutputFormat = "human" | "json";
export type ValidationMode = "full" | "hook";

export type ArgMap = {
  strict: boolean;
  format: OutputFormat;
  mode: ValidationMode;
  profilePath: string;
  linksPath: string;
  sitePath: string;
  enrichmentReportPath?: string;
  changedPathsFile?: string;
};

export const ROOT = process.cwd();
export const ENRICHMENT_BYPASS_ENV = "OPENLINKS_RICH_ENRICHMENT_BYPASS";
export const DEFAULT_AUTH_CACHE_WARN_AGE_DAYS = 30;
export const DEFAULT_ENRICHMENT_METADATA_PATH = "data/generated/rich-metadata.json";
export const DEFAULT_CONTENT_IMAGES_MANIFEST_PATH = "data/cache/content-images.json";
export const DEFAULT_FOLLOWER_HISTORY_REPO_ROOT = "public/history/followers";
export const DEFAULT_FOLLOWER_HISTORY_INDEX_PATH = `public/${FOLLOWER_HISTORY_INDEX_PUBLIC_PATH}`;
export const DEFAULT_REFERRAL_CATALOG_PATH = "data/policy/referral-catalog.json";
export const DEFAULT_REFERRAL_CATALOG_LOCAL_PATH = "data/policy/referral-catalog.local.json";
export const DEFAULT_REFERRAL_CATALOG_SCHEMA_PATH = "schema/referral-catalog.schema.json";
export const DEFAULT_HOOK_CHANGED_PATHS_PATH = ".cache/openlinks-precommit/staged-files.txt";
export const HOOK_SKIP_RICH_ARTIFACT_CHECKS_MESSAGE =
  "Hook mode skipped generated rich-artifact checks because staged paths did not touch rich metadata/image inputs.";

export const HOOK_RICH_ARTIFACT_TRIGGER_EXACT_PATHS = new Set([
  "data/links.json",
  "data/site.json",
  "data/generated/rich-metadata.json",
  "data/cache/content-images.json",
  "data/cache/content-images.runtime.json",
  "data/cache/profile-avatar.json",
  "data/cache/profile-avatar.runtime.json",
  DEFAULT_REMOTE_CACHE_POLICY_LOCAL_PATH,
  "data/policy/remote-cache-policy.json",
  "data/generated/rich-enrichment-report.json",
  "schema/links.schema.json",
  "schema/remote-cache-policy.schema.json",
  "schema/site.schema.json",
  "scripts/enrich-rich-links.ts",
  "scripts/generate-openlinks-brand-assets.ts",
  "scripts/generate-site-social-preview.ts",
  "scripts/lib/openlinks-logo.ts",
  "scripts/lib/social-preview.ts",
  "scripts/sync-profile-avatar.ts",
  "scripts/sync-content-images.ts",
  "scripts/validate-data.ts",
  "public/openlinks-social-fallback.png",
  "public/openlinks-social-fallback.svg",
]);

export const HOOK_RICH_ARTIFACT_TRIGGER_PREFIXES = [
  "data/cache/",
  "public/cache/content-images/",
  "public/generated/seo/",
  "public/cache/rich-authenticated/",
  "scripts/enrichment/",
  "scripts/validation/",
  "src/lib/content/",
] as const;

export interface HookRichArtifactCheckDecision {
  shouldRun: boolean;
  humanNote?: string;
}

export interface GeneratedRichMetadataPayload {
  links?: Record<
    string,
    {
      metadata?: Record<string, unknown>;
      referral?: GeneratedLinkReferralConfig;
    }
  >;
}

export interface GeneratedContentImagesPayload {
  bySlot?: Record<string, { resolvedPath?: string }>;
}

export interface FollowerHistoryIndexSummaryPayload {
  entries?: Array<{
    linkId?: string;
  }>;
}

export interface ReferralCatalogFamilyRecord extends Record<string, unknown> {
  familyId?: string;
  label?: string;
  kind?: string;
  canonicalProgramUrl?: string;
  canonicalHosts?: string[];
}

export interface ReferralCatalogOfferRecord extends Record<string, unknown> {
  offerId?: string;
  familyId?: string;
  label?: string;
}

export interface ReferralCatalogMatcherRecord extends Record<string, unknown> {
  matcherId?: string;
  familyId?: string;
  offerId?: string;
  label?: string;
}

export interface ReferralCatalogPayload {
  families?: ReferralCatalogFamilyRecord[];
  offers?: ReferralCatalogOfferRecord[];
  matchers?: ReferralCatalogMatcherRecord[];
}

export interface ReferralCatalogIndex {
  families: Map<string, ReferralCatalogFamilyRecord>;
  offers: Map<string, ReferralCatalogOfferRecord>;
  matchers: Map<string, ReferralCatalogMatcherRecord>;
}

export interface ReferralCatalogIntegrityInput {
  catalogData: ReferralCatalogPayload;
  catalogSource: string;
  linksData: Record<string, unknown>;
  linksSource: string;
  localCatalogData?: ReferralCatalogPayload;
  localCatalogSource?: string;
}
