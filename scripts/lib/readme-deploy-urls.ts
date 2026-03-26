import { normalizeOrigin } from "../../src/lib/deployment-config";

export const README_DEPLOY_URLS_START_MARKER = "OPENCLAW_DEPLOY_URLS_START";
export const README_DEPLOY_URLS_END_MARKER = "OPENCLAW_DEPLOY_URLS_END";

export interface DeployUrlRow {
  additionalUrls: string;
  evidence: string;
  primaryUrl: string;
  status: string;
  target: string;
}

interface ReplaceDeployUrlBlockResult {
  changed: boolean;
  content: string;
}

const DEPLOY_TARGET_ORDER = ["aws", "github-pages", "render", "railway"] as const;

export function normalizeDeployUrlRow(row: DeployUrlRow): DeployUrlRow {
  return {
    additionalUrls: row.additionalUrls.trim() || "none",
    evidence: row.evidence.trim(),
    primaryUrl: normalizeOrigin(row.primaryUrl.trim()),
    status: row.status.trim(),
    target: row.target.trim(),
  };
}

export function parseReadmeDeployUrlRows(content: string): DeployUrlRow[] {
  const block = readDeployUrlBlock(content);
  return block.lines
    .slice(2)
    .map((line) => parseDeployUrlRow(line))
    .filter((row): row is DeployUrlRow => row !== null);
}

export function renderReadmeDeployUrlBlock(rows: DeployUrlRow[]) {
  const renderedRows = rows
    .map((row) => normalizeDeployUrlRow(row))
    .sort(compareDeployRows)
    .map(
      (row) =>
        `| ${row.target} | ${row.status} | ${row.primaryUrl} | ${row.additionalUrls} | ${row.evidence} |`,
    );

  return [
    README_DEPLOY_URLS_START_MARKER,
    "| target | status | primary_url | additional_urls | evidence |",
    "|--------|--------|-------------|-----------------|----------|",
    ...renderedRows,
    README_DEPLOY_URLS_END_MARKER,
  ].join("\n");
}

export function replaceReadmeDeployUrlBlock(
  content: string,
  rows: DeployUrlRow[],
): ReplaceDeployUrlBlockResult {
  const block = readDeployUrlBlock(content);
  const replacement = renderReadmeDeployUrlBlock(rows);
  const nextContent =
    content.slice(0, block.startIndex) + replacement + content.slice(block.endIndex);

  return {
    changed: nextContent !== content,
    content: nextContent,
  };
}

export function upsertReadmeDeployUrlRow(
  content: string,
  row: DeployUrlRow,
): ReplaceDeployUrlBlockResult {
  const rows = parseReadmeDeployUrlRows(content);
  const normalizedRow = normalizeDeployUrlRow(row);
  const nextRows = rows.filter((entry) => entry.target !== normalizedRow.target);
  nextRows.push(normalizedRow);

  return replaceReadmeDeployUrlBlock(content, nextRows);
}

function readDeployUrlBlock(content: string) {
  const startIndex = content.indexOf(README_DEPLOY_URLS_START_MARKER);
  const endMarkerIndex = content.indexOf(README_DEPLOY_URLS_END_MARKER);

  if (startIndex < 0 || endMarkerIndex < 0 || endMarkerIndex <= startIndex) {
    throw new Error(
      `Unable to find README deploy URL marker block '${README_DEPLOY_URLS_START_MARKER}' -> '${README_DEPLOY_URLS_END_MARKER}'.`,
    );
  }

  const endIndex = endMarkerIndex + README_DEPLOY_URLS_END_MARKER.length;

  return {
    endIndex,
    lines: content.slice(startIndex, endIndex).split("\n"),
    startIndex,
  };
}

function parseDeployUrlRow(line: string): DeployUrlRow | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || trimmed.includes("---")) {
    return null;
  }

  const columns = trimmed
    .split("|")
    .slice(1, -1)
    .map((entry) => entry.trim());

  if (columns.length !== 5 || columns[0] === "target") {
    return null;
  }

  return normalizeDeployUrlRow({
    additionalUrls: columns[3],
    evidence: columns[4],
    primaryUrl: columns[2],
    status: columns[1],
    target: columns[0],
  });
}

function compareDeployRows(left: DeployUrlRow, right: DeployUrlRow) {
  const leftIndex = DEPLOY_TARGET_ORDER.indexOf(
    left.target as (typeof DEPLOY_TARGET_ORDER)[number],
  );
  const rightIndex = DEPLOY_TARGET_ORDER.indexOf(
    right.target as (typeof DEPLOY_TARGET_ORDER)[number],
  );

  if (leftIndex >= 0 || rightIndex >= 0) {
    if (leftIndex < 0) {
      return 1;
    }

    if (rightIndex < 0) {
      return -1;
    }

    return leftIndex - rightIndex;
  }

  return left.target.localeCompare(right.target);
}
