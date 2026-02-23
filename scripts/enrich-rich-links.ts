import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fetchMetadata } from "./enrichment/fetch-metadata";
import { parseMetadata } from "./enrichment/parse-metadata";
import type {
  EnrichmentMetadata,
  EnrichmentReason,
  EnrichmentRunEntry,
  EnrichmentRunSummary,
  GeneratedRichMetadata
} from "./enrichment/types";

interface CliArgs {
  strict: boolean;
  linksPath: string;
  sitePath: string;
  outputPath: string;
  timeoutMs?: number;
  retries?: number;
}

interface LinkInput {
  id: string;
  label: string;
  url: string;
  type: "simple" | "rich";
  metadata?: EnrichmentMetadata;
  enrichment?: {
    enabled?: boolean;
    sourceLabel?: string;
    sourceLabelVisible?: boolean;
  };
}

interface LinksPayload {
  links: LinkInput[];
}

interface SitePayload {
  ui?: {
    richCards?: {
      enrichment?: {
        enabledByDefault?: boolean;
        timeoutMs?: number;
        retries?: number;
      };
    };
  };
}

interface ResolvedConfig {
  enabledByDefault: boolean;
  timeoutMs: number;
  retries: number;
}

const ROOT = process.cwd();

const parseNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);

  const valueOf = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    strict: args.includes("--strict"),
    linksPath: valueOf("--links") ?? "data/links.json",
    sitePath: valueOf("--site") ?? "data/site.json",
    outputPath: valueOf("--out") ?? "data/generated/rich-metadata.json",
    timeoutMs: parseNumber(valueOf("--timeout")),
    retries: parseNumber(valueOf("--retries"))
  };
};

const readJson = <T>(relativePath: string): T => {
  const absolute = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const resolveConfig = (site: SitePayload, args: CliArgs): ResolvedConfig => {
  const defaults = site.ui?.richCards?.enrichment;

  return {
    enabledByDefault: defaults?.enabledByDefault ?? true,
    timeoutMs: Math.max(500, args.timeoutMs ?? defaults?.timeoutMs ?? 4000),
    retries: Math.max(0, args.retries ?? defaults?.retries ?? 1)
  };
};

const ensureDirectory = (relativePath: string) => {
  const absoluteDir = path.dirname(path.join(ROOT, relativePath));
  fs.mkdirSync(absoluteDir, { recursive: true });
};

const pickDefined = (metadata: EnrichmentMetadata): EnrichmentMetadata => {
  const result: EnrichmentMetadata = {};

  if (metadata.title) result.title = metadata.title;
  if (metadata.description) result.description = metadata.description;
  if (metadata.image) result.image = metadata.image;
  if (metadata.sourceLabel) result.sourceLabel = metadata.sourceLabel;
  if (typeof metadata.sourceLabelVisible === "boolean") {
    result.sourceLabelVisible = metadata.sourceLabelVisible;
  }
  if (metadata.enrichmentStatus) result.enrichmentStatus = metadata.enrichmentStatus;
  if (metadata.enrichmentReason) result.enrichmentReason = metadata.enrichmentReason;
  if (metadata.enrichedAt) result.enrichedAt = metadata.enrichedAt;

  return result;
};

const mergeMetadata = (
  original: EnrichmentMetadata | undefined,
  enriched: EnrichmentMetadata
): EnrichmentMetadata => pickDefined({ ...(original ?? {}), ...enriched });

const makeEntryMessage = (status: EnrichmentRunEntry["status"], reason: EnrichmentReason): string => {
  if (status === "skipped") {
    return "Enrichment skipped by configuration.";
  }

  if (status === "failed") {
    return "Metadata fetch failed for this link.";
  }

  if (reason === "metadata_missing") {
    return "No preview metadata found; rich card fallback shell will be used.";
  }

  if (reason === "metadata_partial") {
    return "Partial preview metadata found; missing fields will use fallback values.";
  }

  return "Preview metadata fetched successfully.";
};

const remediationFor = (status: EnrichmentRunEntry["status"], reason: EnrichmentReason): string => {
  if (status === "skipped") {
    return "Set enrichment.enabled=true on this rich link or adjust site.ui.richCards.enrichment.enabledByDefault.";
  }

  if (status === "failed") {
    return "Check URL/network availability, provide metadata manually under link.metadata, or disable enrichment for this link.";
  }

  if (reason === "metadata_missing") {
    return "Add Open Graph/Twitter metadata on the target site or set link.metadata fields manually in data/links.json.";
  }

  if (reason === "metadata_partial") {
    return "Fill missing preview fields via link.metadata or improve target-site SEO metadata completeness.";
  }

  return "No action required.";
};

const summarize = (entries: EnrichmentRunEntry[]): EnrichmentRunSummary => {
  const summary: EnrichmentRunSummary = {
    total: entries.length,
    fetched: 0,
    partial: 0,
    failed: 0,
    skipped: 0
  };

  for (const entry of entries) {
    summary[entry.status] += 1;
  }

  return summary;
};

const run = async () => {
  const args = parseArgs();
  const linksPayload = readJson<LinksPayload>(args.linksPath);
  const sitePayload = readJson<SitePayload>(args.sitePath);
  const config = resolveConfig(sitePayload, args);
  const generatedAt = new Date().toISOString();

  const richLinks = (linksPayload.links ?? []).filter((link) => link.type === "rich");
  const entries: EnrichmentRunEntry[] = [];
  const generatedLinks: GeneratedRichMetadata["links"] = {};

  for (const link of richLinks) {
    const linkEnabled = link.enrichment?.enabled ?? config.enabledByDefault;

    if (!linkEnabled) {
      const reason: EnrichmentReason = "enrichment_disabled";
      const metadata = mergeMetadata(link.metadata, {
        sourceLabel: link.enrichment?.sourceLabel,
        sourceLabelVisible: link.enrichment?.sourceLabelVisible,
        enrichmentStatus: "skipped",
        enrichmentReason: reason,
        enrichedAt: generatedAt
      });

      entries.push({
        linkId: link.id,
        url: link.url,
        status: "skipped",
        reason,
        attempts: 0,
        durationMs: 0,
        message: makeEntryMessage("skipped", reason),
        remediation: remediationFor("skipped", reason),
        metadata
      });

      generatedLinks[link.id] = { metadata };
      continue;
    }

    const fetched = await fetchMetadata(link.url, {
      timeoutMs: config.timeoutMs,
      retries: config.retries
    });

    if (!fetched.ok || !fetched.html) {
      const reason: EnrichmentReason = "fetch_failed";
      const metadata = mergeMetadata(link.metadata, {
        sourceLabel: link.enrichment?.sourceLabel,
        sourceLabelVisible: link.enrichment?.sourceLabelVisible,
        enrichmentStatus: "failed",
        enrichmentReason: reason,
        enrichedAt: generatedAt
      });

      entries.push({
        linkId: link.id,
        url: link.url,
        status: "failed",
        reason,
        attempts: fetched.attempts,
        durationMs: fetched.durationMs,
        statusCode: fetched.statusCode,
        message: fetched.error ?? makeEntryMessage("failed", reason),
        remediation: remediationFor("failed", reason),
        metadata
      });

      generatedLinks[link.id] = { metadata };
      continue;
    }

    const parsed = parseMetadata(fetched.html, link.url);

    const reason: EnrichmentReason =
      parsed.completeness === "full"
        ? "metadata_complete"
        : parsed.completeness === "partial"
          ? "metadata_partial"
          : "metadata_missing";

    const status: EnrichmentRunEntry["status"] = parsed.completeness === "full" ? "fetched" : "partial";

    const metadata = mergeMetadata(link.metadata, {
      ...parsed.metadata,
      sourceLabel: link.enrichment?.sourceLabel ?? parsed.metadata.sourceLabel,
      sourceLabelVisible: link.enrichment?.sourceLabelVisible,
      enrichmentStatus: status,
      enrichmentReason: reason,
      enrichedAt: generatedAt
    });

    entries.push({
      linkId: link.id,
      url: link.url,
      status,
      reason,
      attempts: fetched.attempts,
      durationMs: fetched.durationMs,
      statusCode: fetched.statusCode,
      message: makeEntryMessage(status, reason),
      remediation: remediationFor(status, reason),
      metadata
    });

    generatedLinks[link.id] = { metadata };
  }

  const generated: GeneratedRichMetadata = {
    generatedAt,
    links: generatedLinks
  };

  ensureDirectory(args.outputPath);
  fs.writeFileSync(path.join(ROOT, args.outputPath), `${JSON.stringify(generated, null, 2)}\n`, "utf8");

  const summary = summarize(entries);

  console.log("OpenLinks rich enrichment run");
  console.log(`Links processed: ${summary.total}`);
  console.log(
    `Results: fetched=${summary.fetched}, partial=${summary.partial}, failed=${summary.failed}, skipped=${summary.skipped}`
  );
  console.log(`Generated metadata: ${args.outputPath}`);

  for (const entry of entries) {
    console.log(
      `- ${entry.linkId}: ${entry.status} (${entry.reason})${
        entry.statusCode ? ` [HTTP ${entry.statusCode}]` : ""
      }`
    );
  }

  const shouldFail = args.strict && summary.failed > 0;
  if (shouldFail) {
    console.error("Strict mode enabled: failing because one or more metadata fetches failed.");
  }

  process.exit(shouldFail ? 1 : 0);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Rich enrichment failed unexpectedly: ${message}`);
  process.exit(1);
});
