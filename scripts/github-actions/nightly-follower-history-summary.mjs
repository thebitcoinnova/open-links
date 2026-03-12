#!/usr/bin/env node

import fs from "node:fs";

const summaryPath = ".ci-diagnostics/nightly-follower-history-summary.json";
const historySummary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : null;
const lines = [];

lines.push("## Nightly Follower History");
lines.push(`- Event: \`${process.env.GITHUB_EVENT_NAME ?? "unknown"}\``);
lines.push(`- Publish result: \`${process.env.PUSH_RESULT || "unknown"}\``);

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

if (process.env.DEPLOYMENT_URL) {
  lines.push(`- Pages deployment: ${process.env.DEPLOYMENT_URL}`);
} else {
  lines.push("- Pages deployment: skipped");
}

lines.push("");
lines.push("### Local Parity");
lines.push("- `bun run public:rich:sync`");
lines.push("- `bun run followers:history:sync`");
lines.push("- `bun run build`");
lines.push(
  "- Direct deploy stays in this workflow because bot-authored pushes should not rely on downstream workflow fan-out.",
);

process.stdout.write(`${lines.join("\n")}\n`);
