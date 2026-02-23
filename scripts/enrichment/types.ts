export type EnrichmentStatus = "fetched" | "partial" | "failed" | "skipped";

export type EnrichmentReason =
  | "metadata_complete"
  | "metadata_partial"
  | "metadata_missing"
  | "fetch_failed"
  | "enrichment_disabled";

export interface EnrichmentMetadata {
  title?: string;
  description?: string;
  image?: string;
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
}
