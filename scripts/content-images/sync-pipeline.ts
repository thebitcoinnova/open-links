import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { collectContentImageSlots } from "../../src/lib/content/content-image-slots";
import {
  type RemoteCacheStatsCollector,
  computeRemoteCacheExpiresAt,
  fetchWithRemoteCachePolicy,
} from "../shared/remote-cache-fetch";
import type { loadRemoteCachePolicyRegistry } from "../shared/remote-cache-policy";
import type { ContentImageCliArgs } from "./cli-contracts";
import { resolveContentImageExtension } from "./extensions";
import {
  type ContentImageSyncStatus,
  type GeneratedContentImagesManifest,
  type RuntimeGeneratedContentImageEntry,
  type StableGeneratedContentImageEntry,
  createContentImagePreviousState,
  normalizeRuntimeEntry,
  normalizeStableEntry,
  stabilizeContentImageEntry,
} from "./manifest";

const ROOT = process.cwd();
const FETCH_TIMEOUT_MS = 10_000;

type ContentImageSlot = ReturnType<typeof collectContentImageSlots>[number];
type ContentImageFetchResult = Awaited<ReturnType<typeof fetchWithRemoteCachePolicy>>;
export type ContentImageRunSummary = ReturnType<typeof createContentImageRunSummary>;
export type ContentImageRunState = {
  args: ContentImageCliArgs;
  previousManifest: GeneratedContentImagesManifest<StableGeneratedContentImageEntry> | null;
  previousRuntimeManifest: GeneratedContentImagesManifest<RuntimeGeneratedContentImageEntry> | null;
  remoteCachePolicyRegistry: ReturnType<typeof loadRemoteCachePolicyRegistry>;
  remoteCacheStats: RemoteCacheStatsCollector;
  nextBySlot: Record<string, StableGeneratedContentImageEntry>;
  nextRuntimeBySlot: Record<string, RuntimeGeneratedContentImageEntry>;
  summary: ContentImageRunSummary;
};

const normalizeRelativePath = (input: string): string =>
  input
    .replaceAll("\\", "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .trim();

const normalizePublicPath = (relativePath: string): string => {
  const normalized = normalizeRelativePath(relativePath);
  return normalized.startsWith("public/") ? normalized.slice("public/".length) : normalized;
};

const absolutePath = (candidatePath: string): string =>
  path.isAbsolute(candidatePath) ? candidatePath : path.join(ROOT, candidatePath);

const resolvedPathFromOutputDir = (outputDir: string, fileName: string): string => {
  const normalized = normalizeRelativePath(outputDir).replace(/\/+$/, "");
  const relativeToPublic = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;
  return [relativeToPublic, fileName].filter(Boolean).join("/");
};

const toCanonicalHttpUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const logWarning = (message: string) => console.warn(`WARNING [images:sync] ${message}`);

export const createContentImageRunSummary = () => ({
  fetched: 0,
  notModified: 0,
  cacheFresh: 0,
  cacheOnError: 0,
  fallbackOnError: 0,
});

const recordRunStatus = (summary: ContentImageRunSummary, status: ContentImageSyncStatus) => {
  if (status === "fetched") summary.fetched += 1;
  else if (status === "get_not_modified" || status === "head_unchanged") summary.notModified += 1;
  else if (status === "cache_fresh") summary.cacheFresh += 1;
  else if (status === "cache_on_error") summary.cacheOnError += 1;
  else summary.fallbackOnError += 1;
};

const buildRuntimeEntry = (input: RuntimeGeneratedContentImageEntry) =>
  normalizeRuntimeEntry(input);

const buildStableEntry = (input: StableGeneratedContentImageEntry) => normalizeStableEntry(input);

const writeSlotEntries = (
  slotId: string,
  previousStableEntry: StableGeneratedContentImageEntry | undefined,
  state: ContentImageRunState,
  input: { stable?: StableGeneratedContentImageEntry; runtime: RuntimeGeneratedContentImageEntry },
) => {
  if (input.stable) {
    state.nextBySlot[slotId] = stabilizeContentImageEntry(previousStableEntry, input.stable);
  }
  state.nextRuntimeBySlot[slotId] = input.runtime;
};

const handleFetchedSlot = (
  slot: ContentImageSlot,
  httpUrl: string,
  previousStableEntry: StableGeneratedContentImageEntry | undefined,
  result: Extract<ContentImageFetchResult, { kind: "fetched" }>,
  state: ContentImageRunState,
) => {
  const buffer = result.body as Buffer;
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const extension = resolveContentImageExtension(
    result.headers.contentType,
    httpUrl,
    previousStableEntry?.resolvedPath,
  );
  const fileName = `${hash}.${extension}`;
  const resolvedPath = resolvedPathFromOutputDir(state.args.outputDir, fileName);
  fs.writeFileSync(path.join(absolutePath(state.args.outputDir), fileName), buffer);
  const warning =
    result.bytesFetched > state.args.maxBytesWarn
      ? `Image '${httpUrl}' is ${result.bytesFetched} bytes, exceeding max-bytes-warn=${state.args.maxBytesWarn}.`
      : undefined;
  if (warning) logWarning(warning);
  writeSlotEntries(slot.slotId, previousStableEntry, state, {
    stable: buildStableEntry({
      resolvedPath,
      updatedAt: result.checkedAt,
      contentType: result.headers.contentType,
      bytes: result.bytesFetched,
    }),
    runtime: buildRuntimeEntry({
      sourceUrl: httpUrl,
      etag: result.headers.etag,
      lastModified: result.headers.lastModified,
      checkStatus: "fetched",
      checkedAt: result.checkedAt,
      cacheControl: result.headers.cacheControl,
      expiresAt: computeRemoteCacheExpiresAt(
        result.headers.cacheControl,
        result.headers.responseDate,
      ),
      warning,
    }),
  });
  recordRunStatus(state.summary, "fetched");
  console.log(
    `OpenLinks content image sync: fetched '${httpUrl}' -> '${normalizePublicPath(resolvedPath)}'.`,
  );
};

const handleRevalidatedSlot = (
  slot: ContentImageSlot,
  httpUrl: string,
  previousStableEntry: StableGeneratedContentImageEntry | undefined,
  previousRuntimeEntry: RuntimeGeneratedContentImageEntry | undefined,
  cachedAssetExists: boolean,
  result: ContentImageFetchResult,
  state: ContentImageRunState,
): boolean => {
  if (
    (result.kind !== "not_modified" && result.kind !== "cache_fresh") ||
    !previousStableEntry?.resolvedPath ||
    !cachedAssetExists
  )
    return false;
  writeSlotEntries(slot.slotId, previousStableEntry, state, {
    stable: buildStableEntry({ ...previousStableEntry, updatedAt: result.checkedAt }),
    runtime: buildRuntimeEntry({
      sourceUrl: httpUrl,
      etag: result.headers.etag ?? previousRuntimeEntry?.etag,
      lastModified: result.headers.lastModified ?? previousRuntimeEntry?.lastModified,
      checkStatus: result.checkStatus,
      checkedAt: result.checkedAt,
      cacheControl: result.headers.cacheControl ?? previousRuntimeEntry?.cacheControl,
      expiresAt:
        computeRemoteCacheExpiresAt(result.headers.cacheControl, result.headers.responseDate) ??
        previousRuntimeEntry?.expiresAt,
    }),
  });
  recordRunStatus(state.summary, result.checkStatus);
  console.log(
    result.kind === "cache_fresh"
      ? `OpenLinks content image sync: cache is fresh for '${httpUrl}'.`
      : `OpenLinks content image sync: not modified '${httpUrl}'.`,
  );
  return true;
};

const handleFailedSlot = (
  slot: ContentImageSlot,
  httpUrl: string,
  previousStableEntry: StableGeneratedContentImageEntry | undefined,
  previousRuntimeEntry: RuntimeGeneratedContentImageEntry | undefined,
  cachedAssetExists: boolean,
  result: ContentImageFetchResult,
  state: ContentImageRunState,
) => {
  const failure = result.kind === "error" ? result.error : result.kind;
  if (previousStableEntry?.resolvedPath && cachedAssetExists) {
    const warning = `Image fetch failed (${failure}) for '${httpUrl}'. Reusing cached '${normalizePublicPath(previousStableEntry.resolvedPath)}'.`;
    logWarning(warning);
    writeSlotEntries(slot.slotId, previousStableEntry, state, {
      stable: previousStableEntry,
      runtime: buildRuntimeEntry({
        sourceUrl: httpUrl,
        etag: previousRuntimeEntry?.etag,
        lastModified: previousRuntimeEntry?.lastModified,
        checkStatus: "cache_on_error",
        checkedAt: new Date().toISOString(),
        cacheControl: previousRuntimeEntry?.cacheControl,
        expiresAt: previousRuntimeEntry?.expiresAt,
        warning,
      }),
    });
    recordRunStatus(state.summary, "cache_on_error");
    return;
  }
  const warning = `Image fetch failed (${failure}) for '${httpUrl}'. Runtime will use local fallback behavior.`;
  logWarning(warning);
  state.nextRuntimeBySlot[slot.slotId] = buildRuntimeEntry({
    sourceUrl: httpUrl,
    checkStatus: "fallback_on_error",
    checkedAt: new Date().toISOString(),
    warning,
  });
  recordRunStatus(state.summary, "fallback_on_error");
};

export const processContentImageSlot = async (
  slot: ContentImageSlot,
  state: ContentImageRunState,
) => {
  const candidate = slot.sourceUrl;
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(candidate)) return;
  const httpUrl = toCanonicalHttpUrl(candidate);
  const previousStableEntry = state.previousManifest?.bySlot[slot.slotId];
  const previousRuntimeEntry = state.previousRuntimeManifest?.bySlot[slot.slotId];
  const cachedAssetExists =
    !!previousStableEntry?.resolvedPath &&
    fs.existsSync(path.join(ROOT, "public", normalizePublicPath(previousStableEntry.resolvedPath)));
  if (!httpUrl) {
    const warning = `Unsupported non-http image URL '${candidate}'. Runtime will use local fallback behavior.`;
    logWarning(warning);
    state.nextRuntimeBySlot[slot.slotId] = buildRuntimeEntry({
      sourceUrl: candidate,
      checkStatus: "fallback_on_error",
      checkedAt: new Date().toISOString(),
      warning,
    });
    recordRunStatus(state.summary, "fallback_on_error");
    return;
  }
  const result = await fetchWithRemoteCachePolicy({
    url: httpUrl,
    pipeline: "content_images",
    policyRegistry: state.remoteCachePolicyRegistry,
    timeoutMs: FETCH_TIMEOUT_MS,
    headers: { accept: "image/*,*/*;q=0.8" },
    userAgent: "open-links-content-image-sync/0.1",
    bodyType: "buffer",
    previous: createContentImagePreviousState(httpUrl, previousStableEntry, previousRuntimeEntry),
    cacheValueAvailable: cachedAssetExists,
    force: state.args.force,
    statsCollector: state.remoteCacheStats,
  });
  if (result.kind === "fetched") {
    handleFetchedSlot(slot, httpUrl, previousStableEntry, result, state);
    return;
  }
  if (
    handleRevalidatedSlot(
      slot,
      httpUrl,
      previousStableEntry,
      previousRuntimeEntry,
      cachedAssetExists,
      result,
      state,
    )
  )
    return;
  handleFailedSlot(
    slot,
    httpUrl,
    previousStableEntry,
    previousRuntimeEntry,
    cachedAssetExists,
    result,
    state,
  );
};
