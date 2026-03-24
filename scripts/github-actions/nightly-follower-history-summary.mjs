#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const summaryPath = ".ci-diagnostics/nightly-follower-history-summary.json";
const historySummary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : null;
const publicRichSyncSummaryPath = ".ci-diagnostics/public-rich-sync-summary.json";
const publicRichSyncSummary = fs.existsSync(publicRichSyncSummaryPath)
  ? JSON.parse(fs.readFileSync(publicRichSyncSummaryPath, "utf8"))
  : null;
const cacheRevalidationDir = "output/cache-revalidation";
const lines = [];

const readCacheRevalidationSummaries = () => {
  if (!fs.existsSync(cacheRevalidationDir)) {
    return [];
  }

  return fs
    .readdirSync(cacheRevalidationDir)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => {
      const absolute = path.join(cacheRevalidationDir, entry);
      return JSON.parse(fs.readFileSync(absolute, "utf8"));
    });
};

lines.push("## Nightly Follower History");
lines.push(`- Event: \`${process.env.GITHUB_EVENT_NAME ?? "unknown"}\``);
lines.push(`- Publish result: \`${process.env.PUSH_RESULT || "unknown"}\``);

if (publicRichSyncSummary) {
  lines.push(`- Public audience sync failures: \`${publicRichSyncSummary.failed}\``);

  const failedEntries = publicRichSyncSummary.entries.filter((entry) => entry.status === "failed");
  if (failedEntries.length > 0) {
    lines.push(
      "- Public audience sync ran in best-effort mode; failed links were excluded from this run's history snapshots.",
    );
    lines.push("");
    lines.push("| Public audience link | Reason | Detail |");
    lines.push("| --- | --- | --- |");
    for (const entry of failedEntries) {
      lines.push(`| \`${entry.linkId}\` | \`${entry.reason}\` | ${entry.detail ?? "n/a"} |`);
    }
  }
}

if (historySummary) {
  const changedCount = historySummary.snapshots.filter((snapshot) => snapshot.csvChanged).length;

  lines.push(`- Observed at: \`${historySummary.observedAt}\``);
  lines.push(`- Sync status: \`${historySummary.status}\``);
  lines.push(`- Snapshots captured: \`${historySummary.snapshotCount}\``);
  lines.push(`- CSV files updated: \`${changedCount}\``);
  lines.push(`- Index updated: \`${historySummary.indexChanged ? "yes" : "no"}\``);
  lines.push(`- Indexed platforms: \`${historySummary.indexEntryCount}\``);

  if (historySummary.snapshots.length > 0) {
    lines.push("");
    lines.push("| Platform | Link | Audience | Source | Rows | Updated | Artifact |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");

    for (const snapshot of historySummary.snapshots) {
      lines.push(
        [
          `| \`${snapshot.platform}\``,
          `${snapshot.label}`,
          `${snapshot.audienceCountRaw} (${snapshot.audienceKind})`,
          `\`${snapshot.source}\``,
          `\`${snapshot.rowCount ?? "n/a"}\``,
          `\`${snapshot.csvChanged ? "yes" : "no"}\``,
          `\`${snapshot.csvPath}\` |`,
        ].join(" "),
      );
    }
  } else {
    lines.push("- No follower-history snapshots were eligible for capture.");
  }
} else {
  lines.push("- History sync summary artifact was not produced.");
}

if (process.env.AWS_DEPLOY_ENABLED === "true") {
  lines.push(
    `- AWS canonical deployment: ${process.env.AWS_DEPLOYMENT_URL || "https://openlinks.us/"}`,
  );
} else {
  lines.push("- AWS canonical deployment: skipped");
}

if (process.env.PAGES_DEPLOYMENT_CHANGED === "true" && process.env.PAGES_DEPLOYMENT_URL) {
  lines.push(`- Pages deployment: ${process.env.PAGES_DEPLOYMENT_URL}`);
} else if (process.env.PUSH_RESULT === "pushed") {
  lines.push("- Pages deployment: skipped (mirror already up to date)");
} else {
  lines.push("- Pages deployment: skipped");
}

lines.push("");
lines.push("### Local Parity");
lines.push("- `bun run public:rich:sync`");
lines.push("- `bun run followers:history:sync`");
lines.push("- `bun run deploy:build`");
lines.push(
  "- Direct AWS and Pages deploys stay in this workflow because bot-authored pushes should not rely on downstream workflow fan-out.",
);

const cacheSummaries = readCacheRevalidationSummaries();
if (cacheSummaries.length > 0) {
  const aggregatedScripts = cacheSummaries
    .map(
      (summary) =>
        `- \`${summary.scriptId}\`: checks=\`${summary.totals.totalChecks}\`, bytesFetched=\`${summary.totals.bytesFetched}\`, bytesSkipped=\`${summary.totals.bytesSkipped}\``,
    )
    .join("\n");

  const byPipelineHost = new Map();
  for (const summary of cacheSummaries) {
    for (const entry of summary.entries ?? []) {
      const key = `${entry.pipeline}|${entry.host}`;
      const existing = byPipelineHost.get(key) ?? {
        pipeline: entry.pipeline,
        host: entry.host,
        bytesFetched: 0,
        bytesSkipped: 0,
        checks: 0,
      };
      existing.bytesFetched += entry.bytesFetched ?? 0;
      existing.bytesSkipped += entry.bytesSkipped ?? 0;
      existing.checks += entry.totalChecks ?? 0;
      byPipelineHost.set(key, existing);
    }
  }

  const rows = [...byPipelineHost.values()]
    .sort((left, right) => {
      if (left.pipeline !== right.pipeline) {
        return left.pipeline.localeCompare(right.pipeline);
      }
      return left.host.localeCompare(right.host);
    })
    .map(
      (entry) =>
        `| \`${entry.pipeline}\` | \`${entry.host}\` | \`${entry.checks}\` | \`${entry.bytesFetched}\` | \`${entry.bytesSkipped}\` |`,
    );

  lines.push("");
  lines.push("## Remote Cache Revalidation");
  lines.push(`- Summary files: \`${cacheSummaries.length}\``);
  lines.push(aggregatedScripts);
  lines.push("");
  lines.push("| Pipeline | Host | Checks | Bytes fetched | Bytes skipped |");
  lines.push("| --- | --- | --- | --- | --- |");
  lines.push(...rows);
}

process.stdout.write(`${lines.join("\n")}\n`);
