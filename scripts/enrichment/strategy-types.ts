import type { AuthenticatedExtractorPlugin } from "../authenticated-extractors/types";
import type { EnrichmentMetadata, EnrichmentMissingField } from "./types";

export type EnrichmentStrategyBranch =
  | "public_direct"
  | "public_augmented"
  | "authenticated_required";

export type EnrichmentSourceKind = "html" | "json" | "xml" | "oembed" | "authenticated_browser";

export interface EnrichmentSourceRequest {
  sourceUrl: string;
  acceptHeader?: string;
  headers?: Record<string, string>;
}

export interface NormalizedEnrichmentResult {
  metadata: EnrichmentMetadata;
  completeness: "full" | "partial" | "none";
  missing: EnrichmentMissingField[];
}

export interface DocumentExtractionResult extends NormalizedEnrichmentResult {}

export interface ResolveEnrichmentStrategyInput {
  url: string;
  icon?: string;
  metadataHandle?: unknown;
  authenticatedExtractorId?: string;
}

interface EnrichmentStrategyBase {
  id: string;
  branch: EnrichmentStrategyBranch;
  sourceKind: EnrichmentSourceKind;
}

export interface ResolvedPublicEnrichmentStrategy extends EnrichmentStrategyBase {
  branch: "public_direct" | "public_augmented";
  source: EnrichmentSourceRequest;
  normalize: (body: string) => NormalizedEnrichmentResult;
}

export interface ResolvedAuthenticatedEnrichmentStrategy extends EnrichmentStrategyBase {
  branch: "authenticated_required";
  plugin: AuthenticatedExtractorPlugin;
}

export type ResolvedEnrichmentStrategy =
  | ResolvedPublicEnrichmentStrategy
  | ResolvedAuthenticatedEnrichmentStrategy;

export interface EnrichmentStrategy<TResolved extends ResolvedEnrichmentStrategy> {
  id: string;
  branch: TResolved["branch"];
  sourceKind: TResolved["sourceKind"];
  matches: (input: ResolveEnrichmentStrategyInput) => boolean;
  resolve: (input: ResolveEnrichmentStrategyInput) => TResolved | null;
}
