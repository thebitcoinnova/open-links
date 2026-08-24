import process from "node:process";
import {
  buildPublicRichSyncRunSummary,
  defaultDependencies,
  shouldPublicRichSyncExitWithFailure,
  writePublicRichSyncRunSummary,
} from "./public-rich-sync-candidates";
import { runPublicRichSyncWithDependencies } from "./public-rich-sync-orchestration";
import { parseArgs } from "./public-rich-sync-support";

export type {
  FacebookPageMetricsResult,
  FacebookPageMetricsTarget,
  FetchFacebookPageMetricsInput,
  PublicAudienceFallbackResult,
  PublicBrowserAudienceCaptureResult,
  PublicBrowserAudienceMetrics,
  PublicRichSyncDependencies,
  PublicRichSyncResult,
  PublicRichSyncRunEntry,
  PublicRichSyncSummary,
} from "./public-rich-sync-contracts";
export {
  fetchFacebookPageMetrics,
  normalizeFacebookPageMetricsResponse,
  resolveFacebookPageMetricsTarget,
} from "./public-rich-sync-support";
export {
  resolveInstagramPublicHtmlFallbackUrls,
  resolveSubstackPublicHtmlFallbackUrls,
} from "./public-rich-sync-providers";
export {
  bootstrapPublicBaseEntry,
  capturePublicAudienceMetricsFromBrowser,
  fetchPublicAudienceMetricsFallback,
  toPublicHtmlFallbackAudienceMetrics,
} from "./public-rich-sync-capture";
export {
  buildPublicRichSyncRunSummary,
  shouldPublicRichSyncExitWithFailure,
  writePublicRichSyncRunSummary,
} from "./public-rich-sync-candidates";
export { runPublicRichSyncWithDependencies } from "./public-rich-sync-orchestration";

const runCli = async () => {
  const args = parseArgs();
  const result = await runPublicRichSyncWithDependencies(args, defaultDependencies);
  if (args.summaryJsonPath) {
    writePublicRichSyncRunSummary(args.summaryJsonPath, buildPublicRichSyncRunSummary(result));
  }

  console.log("");
  console.log("Public rich sync summary");
  console.log(`Processed: ${result.processed}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Fatal failures: ${result.fatalFailed}`);
  console.log(`Cache updated: ${result.dirty ? "yes" : "no"}`);

  if (
    shouldPublicRichSyncExitWithFailure(
      result,
      args.allowFailures ?? false,
      args.deferFailures ?? false,
    )
  ) {
    process.exit(1);
  }
};

if (import.meta.main) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Public rich sync failed: ${message}`);
    process.exit(1);
  });
}
