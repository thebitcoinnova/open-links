import type { EnrichmentMetadata } from "../enrichment/types";

export type AuthenticatedExtractorStatus = "active" | "experimental" | "disabled";
export type AuthenticatedExtractorMethod = "manual_browser_session";

export interface AuthenticatedExtractorPolicyEntry {
  id: string;
  status: AuthenticatedExtractorStatus;
  method: AuthenticatedExtractorMethod;
  domains: string[];
  matchSubdomains: boolean;
  summary: string;
  loginInstructions?: string;
  docs: string[];
}

export interface AuthenticatedExtractorsPolicyRegistry {
  version: 1;
  updatedAt: string;
  extractors: AuthenticatedExtractorPolicyEntry[];
}

export interface AuthenticatedCacheImageAsset {
  path: string;
  sourceUrl: string;
  contentType: string;
  bytes: number;
  sha256: string;
}

export interface AuthenticatedCacheMetadata {
  title: string;
  description: string;
  image: string;
  sourceLabel?: string;
}

export interface AuthenticatedCacheDiagnostics {
  extractorVersion: string;
  selectorProfile: string;
  placeholderSignals: string[];
  capturedFromUrl: string;
  notes?: string[];
}

export interface AuthenticatedCacheEntry {
  extractorId: string;
  linkId: string;
  sourceUrl: string;
  capturedAt: string;
  metadata: AuthenticatedCacheMetadata;
  assets: {
    image: AuthenticatedCacheImageAsset;
  };
  diagnostics: AuthenticatedCacheDiagnostics;
}

export interface AuthenticatedCacheRegistry {
  version: 1;
  updatedAt: string;
  entries: Record<string, AuthenticatedCacheEntry>;
}

export interface ResolvedAuthenticatedCacheEntry {
  cacheKey: string;
  entry: AuthenticatedCacheEntry;
  stale: boolean;
  ageDays?: number;
}

export interface AuthenticatedExtractorSessionContext {
  extractorId: string;
  targetUrl: string;
}

export interface AuthenticatedExtractorExtractContext {
  extractorId: string;
  cacheKey: string;
  linkId: string;
  sourceUrl: string;
  force: boolean;
  publicAssetDirAbsolute: string;
  publicAssetDirRelative: string;
}

export interface AuthenticatedExtractorExtractResult {
  capturedAt: string;
  metadata: AuthenticatedCacheMetadata;
  assets: {
    image: AuthenticatedCacheImageAsset;
  };
  diagnostics: AuthenticatedCacheDiagnostics;
}

export interface AuthenticatedExtractorEnsureSessionResult {
  verified: boolean;
  details?: string;
}

export interface AuthenticatedExtractorPlugin {
  id: string;
  ensureSession: (
    context: AuthenticatedExtractorSessionContext
  ) => Promise<AuthenticatedExtractorEnsureSessionResult>;
  extract: (context: AuthenticatedExtractorExtractContext) => Promise<AuthenticatedExtractorExtractResult>;
}

export interface AuthenticatedCacheValidationIssue {
  level: "error" | "warning";
  message: string;
  remediation: string;
}

export interface AuthenticatedCacheValidationResult {
  valid: boolean;
  entry?: ResolvedAuthenticatedCacheEntry;
  issues: AuthenticatedCacheValidationIssue[];
  metadata?: EnrichmentMetadata;
}
