export type ContentRefreshValidationMode = "standard" | "strict";
export type ContentRefreshPublicCacheMode = "runtime" | "stable";

export interface ContentRefreshOptions {
  publicCacheMode: ContentRefreshPublicCacheMode;
  summaryJsonPath: string;
  validationMode: ContentRefreshValidationMode;
}

export type ContentRefreshPhaseId =
  | "public-cleanup"
  | "avatar-sync"
  | "rich-enrichment"
  | "content-image-sync"
  | "social-preview"
  | "site-badge"
  | "data-validation";

export interface ContentRefreshPhase {
  args: string[];
  command: string;
  id: ContentRefreshPhaseId;
  label: string;
}

export interface ContentRefreshPhaseResult {
  completedAt: string;
  durationMs: number;
  id: ContentRefreshPhaseId;
  label: string;
  startedAt: string;
  status: "passed" | "failed";
}

interface ContentRefreshSummaryBase {
  changedPaths: string[];
  completedAt: string;
  options: ContentRefreshOptions;
  phases: ContentRefreshPhaseResult[];
  startedAt: string;
  unexpectedPaths: string[];
}

export interface ContentRefreshPassedSummary extends ContentRefreshSummaryBase {
  status: "passed";
}

export interface ContentRefreshFailedSummary extends ContentRefreshSummaryBase {
  failedPhase?: ContentRefreshPhaseId;
  failure: string;
  status: "failed";
}

export type ContentRefreshSummary = ContentRefreshPassedSummary | ContentRefreshFailedSummary;

export interface ContentRefreshPathConfig {
  directoryPrefixes: string[];
  exactPaths: string[];
}
