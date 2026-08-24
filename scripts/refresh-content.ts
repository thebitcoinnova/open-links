import process from "node:process";
import { parseContentRefreshOptions } from "./content-refresh/plan";
import { runContentRefresh } from "./content-refresh/runner";

if (import.meta.main) {
  try {
    const options = parseContentRefreshOptions(process.argv.slice(2));
    const summary = runContentRefresh(options);
    console.log(
      `Content refresh ${summary.status}: changed=${summary.changedPaths.length}, unexpected=${summary.unexpectedPaths.length}. Summary: ${options.summaryJsonPath}`,
    );
    if (summary.status === "failed") {
      console.error(summary.failure);
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Content refresh failed unexpectedly: ${message}`);
    process.exit(1);
  }
}
