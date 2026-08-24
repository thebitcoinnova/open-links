import process from "node:process";
import { runRichLinkEnrichment } from "./enrich-rich-links-runner";

if (import.meta.main) {
  runRichLinkEnrichment().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Rich enrichment failed unexpectedly: ${message}`);
    process.exit(1);
  });
}
