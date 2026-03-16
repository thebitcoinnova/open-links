import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DeployVerificationResult {
  name: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
}

export interface DeploySummary {
  command: string;
  target: string;
  mode: "check" | "apply";
  artifactHash?: string;
  artifactDir?: string;
  discoveredRemoteState: unknown;
  plannedChanges: unknown;
  skippedReasons: string[];
  appliedChanges: string[];
  verificationResults: DeployVerificationResult[];
  resultingUrls: string[];
  breadcrumbs?: DeployBreadcrumb[];
  timing?: DeployRunTiming;
}

export interface DeployBreadcrumb {
  at?: string;
  startedAt?: string;
  durationMs?: number;
  elapsedMs?: number;
  data?: unknown;
  detail: string;
  status: "failed" | "info" | "passed" | "planned" | "skipped";
  step: string;
}

export interface DeployRunTiming {
  completedAt: string;
  durationMs: number;
  startedAt: string;
}

interface PersistedDeployRunMetadata {
  command: string;
  mode: "apply" | "check";
  startedAt: string;
  target: string;
}

export interface DeployRunContext {
  addBreadcrumb: (breadcrumb: DeployBreadcrumb) => Promise<void>;
  breadcrumbsJsonlPath: string;
  breadcrumbsMarkdownPath: string;
  command: string;
  mode: "apply" | "check";
  runDirectory: string;
  startedAt: string;
  target: string;
}

export async function createDeployRun(options: {
  command: string;
  mode: "apply" | "check";
  target: string;
}): Promise<DeployRunContext> {
  const runDirectory = await ensureRunDirectory(options.command, options.target);
  const breadcrumbsJsonlPath = path.join(runDirectory, "breadcrumbs.jsonl");
  const breadcrumbsMarkdownPath = path.join(runDirectory, "breadcrumbs.md");
  const runMetadataPath = path.join(runDirectory, "run.json");
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.parse(startedAt);
  let lastBreadcrumbAtMs = startedAtMs;

  await writeFile(breadcrumbsJsonlPath, "", "utf8");
  await writeFile(
    breadcrumbsMarkdownPath,
    [
      "# Deployment Breadcrumbs",
      "",
      `- Command: \`${options.command}\``,
      `- Target: \`${options.target}\``,
      `- Mode: \`${options.mode}\``,
      `- Started at: \`${startedAt}\``,
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    runMetadataPath,
    `${JSON.stringify({ ...options, startedAt } satisfies PersistedDeployRunMetadata, null, 2)}\n`,
    "utf8",
  );

  return {
    addBreadcrumb: async (breadcrumb) => {
      const completedAtMs = resolveTimestampMs(breadcrumb.at, Date.now());
      const completedAt = new Date(completedAtMs).toISOString();
      const breadcrumbStartedAtMs =
        breadcrumb.startedAt !== undefined
          ? resolveTimestampMs(breadcrumb.startedAt, lastBreadcrumbAtMs)
          : breadcrumb.durationMs !== undefined
            ? completedAtMs - breadcrumb.durationMs
            : lastBreadcrumbAtMs;
      const normalizedStartedAtMs = Math.min(
        completedAtMs,
        Math.max(startedAtMs, breadcrumbStartedAtMs),
      );
      const entry = {
        ...breadcrumb,
        at: completedAt,
        durationMs: Math.max(0, breadcrumb.durationMs ?? completedAtMs - normalizedStartedAtMs),
        elapsedMs: Math.max(0, completedAtMs - startedAtMs),
        startedAt: new Date(normalizedStartedAtMs).toISOString(),
      };
      lastBreadcrumbAtMs = completedAtMs;

      await appendFile(breadcrumbsJsonlPath, `${JSON.stringify(entry)}\n`, "utf8");
      await appendFile(
        breadcrumbsMarkdownPath,
        [
          `- ${entry.at} [${entry.status}] ${entry.step}: ${entry.detail}`,
          `  - Started at: \`${entry.startedAt}\``,
          `  - Duration: \`${formatDurationVerbose(entry.durationMs)}\``,
          `  - Elapsed: \`${formatDurationVerbose(entry.elapsedMs)}\``,
          entry.data === undefined
            ? null
            : `  \`\`\`json\n  ${JSON.stringify(entry.data, null, 2).replaceAll("\n", "\n  ")}\n  \`\`\``,
          "",
        ]
          .filter((line): line is string => line !== null)
          .join("\n"),
        "utf8",
      );
    },
    breadcrumbsJsonlPath,
    breadcrumbsMarkdownPath,
    command: options.command,
    mode: options.mode,
    runDirectory,
    startedAt,
    target: options.target,
  };
}

export async function writeDeploySummary(
  summary: DeploySummary,
  options: { runDirectory?: string } = {},
) {
  const runDirectory =
    options.runDirectory ?? (await ensureRunDirectory(summary.command, summary.target));
  const runMetadata = await loadPersistedRunMetadata(runDirectory);
  const breadcrumbs = await loadPersistedBreadcrumbs(runDirectory);
  const completedAt = new Date().toISOString();
  const timing = runMetadata ? buildRunTiming(runMetadata.startedAt, completedAt) : summary.timing;
  const enrichedSummary: DeploySummary = {
    ...summary,
    breadcrumbs: summary.breadcrumbs ?? breadcrumbs,
    timing,
  };

  const jsonPath = path.join(runDirectory, "summary.json");
  const markdownPath = path.join(runDirectory, "summary.md");

  await writeFile(jsonPath, `${JSON.stringify(enrichedSummary, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderSummaryMarkdown(enrichedSummary), "utf8");
  await appendGitHubStepSummary(enrichedSummary);

  return {
    jsonPath,
    markdownPath,
    runDirectory,
  };
}

function renderSummaryMarkdown(summary: DeploySummary) {
  const sections = [
    "# Deployment Summary",
    "",
    `- Command: \`${summary.command}\``,
    `- Target: \`${summary.target}\``,
    `- Mode: \`${summary.mode}\``,
    summary.artifactDir ? `- Artifact directory: \`${summary.artifactDir}\`` : null,
    summary.artifactHash ? `- Artifact hash: \`${summary.artifactHash}\`` : null,
    summary.resultingUrls.length > 0
      ? `- Result URLs: ${summary.resultingUrls.map((url) => `\`${url}\``).join(", ")}`
      : null,
    summary.timing
      ? [
          "",
          "## Timing",
          `- Started at: \`${summary.timing.startedAt}\``,
          `- Completed at: \`${summary.timing.completedAt}\``,
          `- Total duration: \`${formatDurationVerbose(summary.timing.durationMs)}\``,
        ].join("\n")
      : null,
    summary.breadcrumbs && summary.breadcrumbs.length > 0
      ? ["", "## Action Timeline", renderBreadcrumbTable(summary.breadcrumbs)].join("\n")
      : null,
    "",
    "## Skips",
    summary.skippedReasons.length > 0
      ? summary.skippedReasons.map((reason) => `- ${reason}`).join("\n")
      : "- None",
    "",
    "## Applied Changes",
    summary.appliedChanges.length > 0
      ? summary.appliedChanges.map((change) => `- ${change}`).join("\n")
      : "- None",
    "",
    "## Verification",
    summary.verificationResults.length > 0
      ? summary.verificationResults
          .map((result) => `- [${result.status}] ${result.name}: ${result.detail}`)
          .join("\n")
      : "- None",
    "",
    "## Planned Changes",
    "```json",
    JSON.stringify(summary.plannedChanges, null, 2),
    "```",
    "",
    "## Discovered Remote State",
    "```json",
    JSON.stringify(summary.discoveredRemoteState, null, 2),
    "```",
    "",
  ];

  return sections.filter((section): section is string => section !== null).join("\n");
}

async function appendGitHubStepSummary(summary: DeploySummary) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `${renderGitHubStepSummary(summary)}\n`,
    "utf8",
  );
}

function renderGitHubStepSummary(summary: DeploySummary) {
  const sections = [
    `## \`${summary.command}\``,
    "",
    `- Target: \`${summary.target}\``,
    `- Mode: \`${summary.mode}\``,
    summary.artifactHash ? `- Artifact hash: \`${summary.artifactHash}\`` : null,
    summary.artifactDir ? `- Artifact directory: \`${summary.artifactDir}\`` : null,
    summary.resultingUrls.length > 0
      ? `- Result URLs: ${summary.resultingUrls.map((url) => `[${url}](${url})`).join(", ")}`
      : null,
    summary.timing
      ? `- Timing: started \`${summary.timing.startedAt}\`, completed \`${summary.timing.completedAt}\`, duration \`${formatDurationVerbose(summary.timing.durationMs)}\``
      : null,
    "",
    "### Outcome",
    summary.appliedChanges.length > 0
      ? summary.appliedChanges.map((change) => `- ${change}`).join("\n")
      : "- No applied changes",
    "",
    "### Skips",
    summary.skippedReasons.length > 0
      ? summary.skippedReasons.map((reason) => `- ${reason}`).join("\n")
      : "- None",
    "",
    "### Verification",
    summary.verificationResults.length > 0
      ? summary.verificationResults
          .map((result) => `- [${result.status}] ${result.name}: ${result.detail}`)
          .join("\n")
      : "- None",
    summary.breadcrumbs && summary.breadcrumbs.length > 0
      ? [
          "",
          `<details><summary>Action timeline (${summary.breadcrumbs.length} entries)</summary>`,
          "",
          renderBreadcrumbTable(summary.breadcrumbs),
          "",
          "</details>",
        ].join("\n")
      : null,
    "",
  ];

  return sections.filter((section): section is string => section !== null).join("\n");
}

function renderBreadcrumbTable(breadcrumbs: DeployBreadcrumb[]) {
  return [
    "| Started (UTC) | Completed (UTC) | Duration | Elapsed | Status | Step | Detail |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...breadcrumbs.map(
      (breadcrumb) =>
        `| ${escapeTableCell(breadcrumb.startedAt ?? "")} | ${escapeTableCell(breadcrumb.at ?? "")} | ${escapeTableCell(formatDurationCompact(breadcrumb.durationMs))} | ${escapeTableCell(formatDurationCompact(breadcrumb.elapsedMs))} | ${escapeTableCell(breadcrumb.status)} | ${escapeTableCell(breadcrumb.step)} | ${escapeTableCell(breadcrumb.detail)} |`,
    ),
  ].join("\n");
}

function escapeTableCell(value: string) {
  return value.replaceAll("\n", "<br>").replaceAll("|", "\\|");
}

function formatDurationCompact(durationMs: number | undefined) {
  if (durationMs === undefined) {
    return "";
  }

  const milliseconds = Math.max(0, Math.round(durationMs));
  if (milliseconds < 1_000) {
    return `${milliseconds} ms`;
  }

  if (milliseconds < 60_000) {
    const seconds = milliseconds / 1_000;
    return `${trimTrailingZeros(seconds.toFixed(seconds >= 10 ? 1 : 2))} s`;
  }

  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatDurationVerbose(durationMs: number | undefined) {
  if (durationMs === undefined) {
    return "unknown";
  }

  return `${formatDurationCompact(durationMs)} (${Math.max(0, Math.round(durationMs))} ms)`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function buildRunTiming(startedAt: string, completedAt: string): DeployRunTiming {
  const startedAtMs = resolveTimestampMs(startedAt, Date.now());
  const completedAtMs = resolveTimestampMs(completedAt, startedAtMs);

  return {
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: Math.max(0, completedAtMs - startedAtMs),
    startedAt: new Date(startedAtMs).toISOString(),
  };
}

async function loadPersistedRunMetadata(runDirectory: string) {
  const metadataPath = path.join(runDirectory, "run.json");

  try {
    const rawMetadata = await readFile(metadataPath, "utf8");
    return JSON.parse(rawMetadata) as PersistedDeployRunMetadata;
  } catch {
    return null;
  }
}

async function loadPersistedBreadcrumbs(runDirectory: string) {
  const breadcrumbsPath = path.join(runDirectory, "breadcrumbs.jsonl");

  try {
    const rawBreadcrumbs = await readFile(breadcrumbsPath, "utf8");
    return rawBreadcrumbs
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DeployBreadcrumb);
  } catch {
    return [];
  }
}

function resolveTimestampMs(value: string | undefined, fallbackMs: number) {
  if (!value) {
    return fallbackMs;
  }

  const parsedMs = Date.parse(value);
  return Number.isFinite(parsedMs) ? parsedMs : fallbackMs;
}

function sanitizePathSegment(input: string) {
  return input.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "run";
}

async function ensureRunDirectory(command: string, target: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDirectory = path.join(
    process.cwd(),
    ".codex",
    "logs",
    "deploy",
    `${timestamp}-${sanitizePathSegment(command)}-${sanitizePathSegment(target)}`,
  );

  await mkdir(runDirectory, { recursive: true });
  return runDirectory;
}
