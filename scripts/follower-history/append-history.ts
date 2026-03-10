import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  FOLLOWER_HISTORY_INDEX_VERSION,
  type FollowerHistoryIndex,
  type FollowerHistoryIndexEntry,
  type FollowerHistoryRow,
  buildFollowerHistoryCsvPublicPath,
  normalizeFollowerHistoryRows,
  parseFollowerHistoryCsv,
  serializeFollowerHistoryCsv,
} from "../../src/lib/analytics/follower-history";

const ROOT = process.cwd();
const PUBLIC_ROOT = "public";
export const DEFAULT_FOLLOWER_HISTORY_REPO_ROOT = path.join("public", "history", "followers");
export const DEFAULT_FOLLOWER_HISTORY_INDEX_REPO_PATH = path.join(
  "public",
  "history",
  "followers",
  "index.json",
);

export interface AppendFollowerHistoryResult {
  changed: boolean;
  csvPath: string;
  rows: FollowerHistoryRow[];
}

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const ensureDirectory = (relativePath: string) => {
  fs.mkdirSync(path.dirname(absolutePath(relativePath)), { recursive: true });
};

const readTextIfPresent = (relativePath: string): string | null => {
  const absolute = absolutePath(relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }

  return fs.readFileSync(absolute, "utf8");
};

const toRepoPathFromPublicPath = (publicPath: string): string =>
  path.join(PUBLIC_ROOT, publicPath).replaceAll("\\", "/");

export const buildFollowerHistoryCsvRepoPath = (
  platform: string,
  options?: {
    historyRepoRoot?: string;
  },
): string => {
  const historyRepoRoot =
    options?.historyRepoRoot?.replaceAll("\\", "/") ?? DEFAULT_FOLLOWER_HISTORY_REPO_ROOT;

  if (historyRepoRoot !== DEFAULT_FOLLOWER_HISTORY_REPO_ROOT) {
    return `${historyRepoRoot.replace(/\/+$/u, "")}/${platform}.csv`;
  }

  return toRepoPathFromPublicPath(buildFollowerHistoryCsvPublicPath(platform));
};

export const readFollowerHistoryCsvFile = (relativePath: string): FollowerHistoryRow[] => {
  const existing = readTextIfPresent(relativePath);
  if (!existing) {
    return [];
  }

  return parseFollowerHistoryCsv(existing);
};

export const appendFollowerHistoryRows = (input: {
  historyRepoRoot?: string;
  platform: string;
  rows: readonly FollowerHistoryRow[];
}): AppendFollowerHistoryResult => {
  const csvPath = buildFollowerHistoryCsvRepoPath(input.platform, {
    historyRepoRoot: input.historyRepoRoot,
  });
  const existingRows = readFollowerHistoryCsvFile(csvPath);
  const nextRows = normalizeFollowerHistoryRows([...existingRows, ...input.rows]);
  const nextContents = serializeFollowerHistoryCsv(nextRows);
  const previousContents = readTextIfPresent(csvPath);
  const changed = previousContents !== nextContents;

  if (changed) {
    ensureDirectory(csvPath);
    fs.writeFileSync(absolutePath(csvPath), nextContents, "utf8");
  }

  return {
    changed,
    csvPath,
    rows: nextRows,
  };
};

export const writeFollowerHistoryIndex = (
  entries: readonly FollowerHistoryIndexEntry[],
  updatedAt: string,
  options?: {
    indexRepoPath?: string;
  },
): boolean => {
  const indexRepoPath = options?.indexRepoPath ?? DEFAULT_FOLLOWER_HISTORY_INDEX_REPO_PATH;
  const indexPayload: FollowerHistoryIndex = {
    version: FOLLOWER_HISTORY_INDEX_VERSION,
    updatedAt,
    entries: [...entries].sort((left, right) => left.platform.localeCompare(right.platform)),
  };
  const nextContents = `${JSON.stringify(indexPayload, null, 2)}\n`;
  const previousContents = readTextIfPresent(indexRepoPath);
  const changed = previousContents !== nextContents;

  if (changed) {
    ensureDirectory(indexRepoPath);
    fs.writeFileSync(absolutePath(indexRepoPath), nextContents, "utf8");
  }

  return changed;
};
