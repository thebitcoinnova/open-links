export const FOLLOWER_HISTORY_PUBLIC_ROOT = "history/followers";
export const FOLLOWER_HISTORY_INDEX_PUBLIC_PATH = `${FOLLOWER_HISTORY_PUBLIC_ROOT}/index.json`;
export const FOLLOWER_HISTORY_INDEX_VERSION = 1;
export const FOLLOWER_HISTORY_COLUMNS = [
  "observedAt",
  "linkId",
  "platform",
  "handle",
  "canonicalUrl",
  "audienceKind",
  "audienceCount",
  "audienceCountRaw",
  "source",
] as const;

export type FollowerHistoryColumn = (typeof FOLLOWER_HISTORY_COLUMNS)[number];
export type FollowerHistoryAudienceKind = "followers" | "subscribers" | "members";
export type FollowerHistorySource = "authenticated-cache" | "manual" | "public-cache";
export type FollowerHistoryRange = "30d" | "90d" | "180d" | "all";
export type FollowerHistoryMode = "growth" | "raw";

export interface FollowerHistoryRow {
  observedAt: string;
  linkId: string;
  platform: string;
  handle: string;
  canonicalUrl: string;
  audienceKind: FollowerHistoryAudienceKind;
  audienceCount: number;
  audienceCountRaw: string;
  source: FollowerHistorySource;
}

export interface FollowerHistoryPrimaryAudience {
  audienceKind: FollowerHistoryAudienceKind;
  audienceCount: number;
  audienceCountRaw: string;
}

export interface FollowerHistoryIndexEntry {
  linkId: string;
  label: string;
  platform: string;
  handle: string;
  canonicalUrl: string;
  audienceKind: FollowerHistoryAudienceKind;
  csvPath: string;
  latestAudienceCount: number;
  latestAudienceCountRaw: string;
  latestObservedAt: string;
}

export interface FollowerHistoryIndex {
  version: typeof FOLLOWER_HISTORY_INDEX_VERSION;
  updatedAt: string;
  entries: FollowerHistoryIndexEntry[];
}

export interface FollowerHistoryPoint {
  observedAt: string;
  timestamp: number;
  audienceCount: number;
  audienceCountRaw: string;
  value: number;
  delta: number;
}

export interface FollowerHistoryAccessibleSummaryOptions {
  audienceKind: FollowerHistoryAudienceKind;
  label: string;
  rangeDescription: string;
  rows: readonly FollowerHistoryRow[];
}

export interface FollowerHistoryLikeMetadata {
  followersCount?: number;
  followersCountRaw?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
  membersCount?: number;
  membersCountRaw?: string;
}

export const FOLLOWER_HISTORY_RANGE_DAYS = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
} as const satisfies Record<Exclude<FollowerHistoryRange, "all">, number>;

const COMPACT_COUNT_MULTIPLIERS: Record<string, number> = {
  b: 1_000_000_000,
  k: 1_000,
  m: 1_000_000,
};

const csvEscape = (value: string): string => {
  if (!/[",\n]/u.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
};

const trimToUndefined = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isAudienceKind = (value: string): value is FollowerHistoryAudienceKind =>
  value === "followers" || value === "subscribers" || value === "members";

const isSource = (value: string): value is FollowerHistorySource =>
  value === "authenticated-cache" || value === "manual" || value === "public-cache";

const parseCsvRows = (csv: string): string[][] => {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let index = 0;
  let inQuotes = false;

  while (index < csv.length) {
    const character = csv[index];

    if (character === '"') {
      const nextCharacter = csv[index + 1];
      if (inQuotes && nextCharacter === '"') {
        currentField += '"';
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (!inQuotes && character === ",") {
      currentRow.push(currentField);
      currentField = "";
      index += 1;
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      index += 1;
      continue;
    }

    currentField += character;
    index += 1;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((field) => field.length > 0));
};

const parseNonNegativeInteger = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid audienceCount '${value}'.`);
  }
  return parsed;
};

export const buildFollowerHistoryCsvPublicPath = (platform: string): string =>
  `${FOLLOWER_HISTORY_PUBLIC_ROOT}/${platform}.csv`;

export const normalizeFollowerHistoryRows = (
  rows: readonly FollowerHistoryRow[],
): FollowerHistoryRow[] =>
  [...rows].sort((left, right) => {
    const leftTimestamp = Date.parse(left.observedAt);
    const rightTimestamp = Date.parse(right.observedAt);
    if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp)) {
      return leftTimestamp - rightTimestamp;
    }
    return left.observedAt.localeCompare(right.observedAt);
  });

export const parseCompactAudienceCount = (value: string | undefined): number | undefined => {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed
    .toLowerCase()
    .replaceAll(",", "")
    .replace(/followers?|subscribers?|members?/gu, "")
    .trim();

  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?$/u);
  if (!match) {
    return undefined;
  }

  const numericPortion = Number.parseFloat(match[1]);
  if (!Number.isFinite(numericPortion)) {
    return undefined;
  }

  const suffix = match[2];
  const multiplier = suffix ? COMPACT_COUNT_MULTIPLIERS[suffix] : 1;
  return Math.round(numericPortion * multiplier);
};

export const resolveFollowerHistoryPrimaryAudience = (
  metadata: FollowerHistoryLikeMetadata | undefined,
): FollowerHistoryPrimaryAudience | null => {
  if (!metadata) {
    return null;
  }

  const membersRaw = trimToUndefined(metadata.membersCountRaw);
  const membersCount =
    typeof metadata.membersCount === "number" && Number.isFinite(metadata.membersCount)
      ? metadata.membersCount
      : parseCompactAudienceCount(membersRaw);

  if (membersCount !== undefined && membersRaw) {
    return {
      audienceKind: "members",
      audienceCount: membersCount,
      audienceCountRaw: membersRaw,
    };
  }

  if (membersCount !== undefined) {
    return {
      audienceKind: "members",
      audienceCount: membersCount,
      audienceCountRaw: `${membersCount.toLocaleString("en-US")} members`,
    };
  }

  const subscriberRaw = trimToUndefined(metadata.subscribersCountRaw);
  const subscriberCount =
    typeof metadata.subscribersCount === "number" && Number.isFinite(metadata.subscribersCount)
      ? metadata.subscribersCount
      : parseCompactAudienceCount(subscriberRaw);

  if (subscriberCount !== undefined && subscriberRaw) {
    return {
      audienceKind: "subscribers",
      audienceCount: subscriberCount,
      audienceCountRaw: subscriberRaw,
    };
  }

  if (subscriberCount !== undefined) {
    return {
      audienceKind: "subscribers",
      audienceCount: subscriberCount,
      audienceCountRaw: `${subscriberCount.toLocaleString("en-US")} subscribers`,
    };
  }

  const followerRaw = trimToUndefined(metadata.followersCountRaw);
  const followerCount =
    typeof metadata.followersCount === "number" && Number.isFinite(metadata.followersCount)
      ? metadata.followersCount
      : parseCompactAudienceCount(followerRaw);

  if (followerCount !== undefined && followerRaw) {
    return {
      audienceKind: "followers",
      audienceCount: followerCount,
      audienceCountRaw: followerRaw,
    };
  }

  if (followerCount !== undefined) {
    return {
      audienceKind: "followers",
      audienceCount: followerCount,
      audienceCountRaw: `${followerCount.toLocaleString("en-US")} followers`,
    };
  }

  return null;
};

export const serializeFollowerHistoryCsv = (rows: readonly FollowerHistoryRow[]): string => {
  const header = FOLLOWER_HISTORY_COLUMNS.join(",");
  const body = rows.map((row) =>
    FOLLOWER_HISTORY_COLUMNS.map((column) => csvEscape(String(row[column]))).join(","),
  );

  return `${[header, ...body].join("\n")}\n`;
};

export const parseFollowerHistoryCsv = (csv: string): FollowerHistoryRow[] => {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;
  if (
    header.length !== FOLLOWER_HISTORY_COLUMNS.length ||
    header.some((value, index) => value !== FOLLOWER_HISTORY_COLUMNS[index])
  ) {
    throw new Error(
      `Invalid follower-history CSV header. Expected '${FOLLOWER_HISTORY_COLUMNS.join(",")}'.`,
    );
  }

  return body.map((row, rowIndex) => {
    if (row.length !== FOLLOWER_HISTORY_COLUMNS.length) {
      throw new Error(
        `Follower-history CSV row ${rowIndex + 2} has ${row.length} columns; expected ${FOLLOWER_HISTORY_COLUMNS.length}.`,
      );
    }

    const [
      observedAt,
      linkId,
      platform,
      handle,
      canonicalUrl,
      audienceKind,
      audienceCount,
      audienceCountRaw,
      source,
    ] = row;

    if (!Number.isFinite(Date.parse(observedAt))) {
      throw new Error(
        `Follower-history row ${rowIndex + 2} has invalid observedAt '${observedAt}'.`,
      );
    }

    if (!isAudienceKind(audienceKind)) {
      throw new Error(
        `Follower-history row ${rowIndex + 2} has invalid audienceKind '${audienceKind}'.`,
      );
    }

    if (!isSource(source)) {
      throw new Error(`Follower-history row ${rowIndex + 2} has invalid source '${source}'.`);
    }

    try {
      new URL(canonicalUrl);
    } catch {
      throw new Error(
        `Follower-history row ${rowIndex + 2} has invalid canonicalUrl '${canonicalUrl}'.`,
      );
    }

    return {
      observedAt,
      linkId,
      platform,
      handle,
      canonicalUrl,
      audienceKind,
      audienceCount: parseNonNegativeInteger(audienceCount),
      audienceCountRaw,
      source,
    };
  });
};

export const parseFollowerHistoryIndex = (payload: unknown): FollowerHistoryIndex => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Follower-history index payload must be an object.");
  }

  const record = payload as Record<string, unknown>;
  if (record.version !== FOLLOWER_HISTORY_INDEX_VERSION) {
    throw new Error(`Follower-history index version must be ${FOLLOWER_HISTORY_INDEX_VERSION}.`);
  }

  const updatedAt = trimToUndefined(record.updatedAt);
  if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) {
    throw new Error("Follower-history index updatedAt must be a valid ISO timestamp.");
  }

  if (!Array.isArray(record.entries)) {
    throw new Error("Follower-history index entries must be an array.");
  }

  const entries = record.entries.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`Follower-history index entry ${index + 1} must be an object.`);
    }

    const entryRecord = entry as Record<string, unknown>;
    const linkId = trimToUndefined(entryRecord.linkId);
    const label = trimToUndefined(entryRecord.label);
    const platform = trimToUndefined(entryRecord.platform);
    const handle = typeof entryRecord.handle === "string" ? entryRecord.handle.trim() : "";
    const canonicalUrl = trimToUndefined(entryRecord.canonicalUrl);
    const csvPath = trimToUndefined(entryRecord.csvPath);
    const latestAudienceCountRaw = trimToUndefined(entryRecord.latestAudienceCountRaw);
    const latestObservedAt = trimToUndefined(entryRecord.latestObservedAt);

    if (!linkId || !label || !platform || !canonicalUrl || !csvPath || !latestAudienceCountRaw) {
      throw new Error(`Follower-history index entry ${index + 1} is missing required fields.`);
    }
    if (!Number.isFinite(Date.parse(latestObservedAt ?? ""))) {
      throw new Error(
        `Follower-history index entry ${index + 1} has invalid latestObservedAt '${latestObservedAt ?? ""}'.`,
      );
    }
    if (!isAudienceKind(String(entryRecord.audienceKind))) {
      throw new Error(
        `Follower-history index entry ${index + 1} has invalid audienceKind '${String(entryRecord.audienceKind)}'.`,
      );
    }
    if (
      typeof entryRecord.latestAudienceCount !== "number" ||
      !Number.isFinite(entryRecord.latestAudienceCount)
    ) {
      throw new Error(
        `Follower-history index entry ${index + 1} has invalid latestAudienceCount '${String(entryRecord.latestAudienceCount)}'.`,
      );
    }

    try {
      new URL(canonicalUrl);
    } catch {
      throw new Error(
        `Follower-history index entry ${index + 1} has invalid canonicalUrl '${canonicalUrl}'.`,
      );
    }

    return {
      linkId,
      label,
      platform,
      handle,
      canonicalUrl,
      audienceKind: entryRecord.audienceKind as FollowerHistoryAudienceKind,
      csvPath,
      latestAudienceCount: entryRecord.latestAudienceCount,
      latestAudienceCountRaw,
      latestObservedAt: latestObservedAt as string,
    } satisfies FollowerHistoryIndexEntry;
  });

  return {
    version: FOLLOWER_HISTORY_INDEX_VERSION,
    updatedAt,
    entries,
  };
};

export const filterFollowerHistoryRows = (
  rows: readonly FollowerHistoryRow[],
  range: FollowerHistoryRange,
  now: Date = new Date(),
): FollowerHistoryRow[] => {
  const normalizedRows = normalizeFollowerHistoryRows(rows);
  if (range === "all") {
    return normalizedRows;
  }

  const days = FOLLOWER_HISTORY_RANGE_DAYS[range];
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1_000;

  return normalizedRows.filter((row) => Date.parse(row.observedAt) >= cutoff);
};

export const buildFollowerHistoryPoints = (
  rows: readonly FollowerHistoryRow[],
  mode: FollowerHistoryMode,
): FollowerHistoryPoint[] => {
  const normalizedRows = normalizeFollowerHistoryRows(rows);

  return normalizedRows.map((row, index) => {
    const previous = normalizedRows[index - 1];
    const delta = previous ? row.audienceCount - previous.audienceCount : 0;

    return {
      observedAt: row.observedAt,
      timestamp: Date.parse(row.observedAt),
      audienceCount: row.audienceCount,
      audienceCountRaw: row.audienceCountRaw,
      delta,
      value: mode === "growth" ? delta : row.audienceCount,
    };
  });
};

export const describeFollowerHistoryRange = (range: FollowerHistoryRange): string => {
  if (range === "all") {
    return "all available history";
  }

  return range.replace("d", " days");
};

const formatObservedAt = (value: string): string =>
  new Date(value).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const buildFollowerHistoryAccessibleSummary = ({
  audienceKind,
  label,
  rangeDescription,
  rows,
}: FollowerHistoryAccessibleSummaryOptions): string | null => {
  if (rows.length === 0) {
    return `${label} has no published ${audienceKind} history for ${rangeDescription}.`;
  }

  const points = buildFollowerHistoryPoints(rows, "raw");
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  if (!startPoint || !endPoint) {
    return null;
  }

  const delta = endPoint.audienceCount - startPoint.audienceCount;
  const direction =
    delta > 0
      ? `up ${delta.toLocaleString("en-US")}`
      : delta < 0
        ? `down ${Math.abs(delta).toLocaleString("en-US")}`
        : "no change";

  return [
    `${label} ${audienceKind} history for ${rangeDescription}.`,
    `Latest count ${endPoint.audienceCountRaw}.`,
    `${direction} from ${startPoint.audienceCountRaw} on ${formatObservedAt(startPoint.observedAt)} to ${endPoint.audienceCountRaw} on ${formatObservedAt(endPoint.observedAt)}.`,
  ].join(" ");
};

export const buildFollowerHistoryAvailabilityMap = (
  index: FollowerHistoryIndex | null | undefined,
): Map<string, FollowerHistoryIndexEntry> =>
  new Map((index?.entries ?? []).map((entry) => [entry.linkId, entry]));
