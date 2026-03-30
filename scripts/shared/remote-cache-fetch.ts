import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import {
  type RemoteCacheCheckMode,
  type RemoteCachePipeline,
  type RemoteCachePolicyRegistry,
  type ResolvedRemoteCachePolicyRule,
  resolveRequiredRemoteCachePolicyRule,
} from "./remote-cache-policy";

export type RemoteCacheBodyType = "buffer" | "text";
export type RemoteCacheCheckStatus =
  | "cache_fresh"
  | "head_unchanged"
  | "get_not_modified"
  | "fetched"
  | "error";
export type RemoteCacheHeadFallbackReason =
  | "status_not_ok"
  | "missing_validators"
  | "changed"
  | "network_error"
  | "cache_value_missing";

export interface RemoteCachePreviousState {
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  expiresAt?: string;
  bytes?: number;
}

export interface RemoteCacheResponseHeaders {
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  responseDate?: string;
  contentType?: string;
  contentLength?: number;
}

export interface RemoteCacheFetchOptions {
  url: string;
  pipeline: RemoteCachePipeline;
  policyRegistry: RemoteCachePolicyRegistry;
  timeoutMs: number;
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  acceptHeader?: string;
  userAgent: string;
  bodyType: RemoteCacheBodyType;
  previous?: RemoteCachePreviousState;
  cacheValueAvailable?: boolean;
  force?: boolean;
  statsCollector?: RemoteCacheStatsCollector;
}

interface SuccessfulRequestResult {
  ok: true;
  response: Response;
  statusCode: number;
  headers: RemoteCacheResponseHeaders;
  finalUrl?: string;
}

interface FailedRequestResult {
  ok: false;
  statusCode?: number;
  error?: string;
  headers?: RemoteCacheResponseHeaders;
  finalUrl?: string;
}

type RequestAttemptResult = SuccessfulRequestResult | FailedRequestResult;

interface RemoteCacheResultBase {
  url: string;
  finalUrl?: string;
  pipeline: RemoteCachePipeline;
  policy: ResolvedRemoteCachePolicyRule;
  checkMode: RemoteCacheCheckMode;
  checkedAt: string;
  durationMs: number;
  attemptedHead: boolean;
  headFallbackReason?: RemoteCacheHeadFallbackReason;
  headers: RemoteCacheResponseHeaders;
  statusCode?: number;
  bytesFetched: number;
  bytesSkipped: number;
}

export interface RemoteCacheFreshResult extends RemoteCacheResultBase {
  kind: "cache_fresh";
  checkStatus: "cache_fresh";
  method: "none";
}

export interface RemoteCacheNotModifiedResult extends RemoteCacheResultBase {
  kind: "not_modified";
  checkStatus: "head_unchanged" | "get_not_modified";
  method: "HEAD" | "GET";
}

export interface RemoteCacheFetchedResult extends RemoteCacheResultBase {
  kind: "fetched";
  checkStatus: "fetched";
  method: "GET";
  body: Buffer | string;
}

export interface RemoteCacheErrorResult extends RemoteCacheResultBase {
  kind: "error";
  checkStatus: "error";
  method: "HEAD" | "GET" | "none";
  error: string;
}

export type RemoteCacheFetchResult =
  | RemoteCacheFreshResult
  | RemoteCacheNotModifiedResult
  | RemoteCacheFetchedResult
  | RemoteCacheErrorResult;

export interface RemoteCacheStatsEntry {
  pipeline: RemoteCachePipeline;
  host: string;
  matchedDomain: string;
  ruleId: string;
  checkMode: RemoteCacheCheckMode;
  totalChecks: number;
  cacheFresh: number;
  headUnchanged: number;
  getNotModified: number;
  fetched: number;
  errors: number;
  bytesFetched: number;
  bytesSkipped: number;
  headFallbacks: Partial<Record<RemoteCacheHeadFallbackReason, number>>;
}

export interface RemoteCacheRunSummary {
  version: 1;
  scriptId: string;
  generatedAt: string;
  totals: {
    totalChecks: number;
    cacheFresh: number;
    headUnchanged: number;
    getNotModified: number;
    fetched: number;
    errors: number;
    bytesFetched: number;
    bytesSkipped: number;
  };
  entries: RemoteCacheStatsEntry[];
}

const ROOT = process.cwd();

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseContentLength = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const toResponseHeaders = (response: Response): RemoteCacheResponseHeaders => ({
  etag: trimToUndefined(response.headers.get("etag") ?? undefined),
  lastModified: trimToUndefined(response.headers.get("last-modified") ?? undefined),
  cacheControl: trimToUndefined(response.headers.get("cache-control") ?? undefined),
  responseDate: trimToUndefined(response.headers.get("date") ?? undefined),
  contentType: trimToUndefined(response.headers.get("content-type") ?? undefined)?.split(";")[0],
  contentLength: parseContentLength(response.headers.get("content-length")),
});

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const requestWithRetries = async (input: {
  method: "HEAD" | "GET";
  url: string;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  headers: Record<string, string>;
}): Promise<RequestAttemptResult> => {
  const attemptsAllowed = input.retries + 1;
  let lastError = "Unknown fetch error";
  let lastStatusCode: number | undefined;
  let lastHeaders: RemoteCacheResponseHeaders | undefined;

  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const response = await fetch(input.url, {
        method: input.method,
        redirect: "follow",
        signal: controller.signal,
        headers: input.headers,
      });

      const headers = toResponseHeaders(response);
      lastHeaders = headers;
      const finalUrl = trimToUndefined(response.url ?? undefined);

      if (response.ok || response.status === 304) {
        return {
          ok: true,
          response,
          statusCode: response.status,
          headers,
          finalUrl,
        };
      }

      lastStatusCode = response.status;
      lastError = `Received HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < attemptsAllowed && input.retryDelayMs > 0) {
      await delay(input.retryDelayMs);
    }
  }

  return {
    ok: false,
    statusCode: lastStatusCode,
    error: lastError,
    headers: lastHeaders,
    finalUrl: undefined,
  };
};

const normalizePreviousState = (
  previous: RemoteCachePreviousState | undefined,
): RemoteCachePreviousState => ({
  etag: trimToUndefined(previous?.etag),
  lastModified: trimToUndefined(previous?.lastModified),
  cacheControl: trimToUndefined(previous?.cacheControl),
  expiresAt: trimToUndefined(previous?.expiresAt),
  bytes:
    typeof previous?.bytes === "number" && Number.isFinite(previous.bytes) && previous.bytes >= 0
      ? previous.bytes
      : undefined,
});

const hasPreviousValidators = (previous: RemoteCachePreviousState): boolean =>
  Boolean(previous.etag || previous.lastModified);

const validatorsMatch = (
  previous: RemoteCachePreviousState,
  nextHeaders: RemoteCacheResponseHeaders,
): boolean => {
  const sharedEtag = previous.etag && nextHeaders.etag;
  const sharedLastModified = previous.lastModified && nextHeaders.lastModified;

  if (sharedEtag && sharedLastModified) {
    return previous.etag === nextHeaders.etag && previous.lastModified === nextHeaders.lastModified;
  }
  if (sharedEtag) {
    return previous.etag === nextHeaders.etag;
  }
  if (sharedLastModified) {
    return previous.lastModified === nextHeaders.lastModified;
  }

  return false;
};

const buildBaseHeaders = (input: {
  userAgent: string;
  headers?: Record<string, string>;
  acceptHeader?: string;
}): Record<string, string> => ({
  "user-agent": input.userAgent,
  ...(input.acceptHeader ? { accept: input.acceptHeader } : {}),
  ...(input.headers ?? {}),
});

const buildConditionalHeaders = (input: {
  baseHeaders: Record<string, string>;
  previous: RemoteCachePreviousState;
  includeValidators: boolean;
}): Record<string, string> => {
  const headers = { ...input.baseHeaders };

  if (!input.includeValidators) {
    return headers;
  }

  if (input.previous.etag) {
    headers["if-none-match"] = input.previous.etag;
  }
  if (input.previous.lastModified) {
    headers["if-modified-since"] = input.previous.lastModified;
  }

  return headers;
};

export const computeRemoteCacheExpiresAt = (
  cacheControl: string | undefined,
  responseDate: string | undefined,
): string | undefined => {
  if (!cacheControl) {
    return undefined;
  }

  for (const directive of cacheControl.split(",")) {
    const normalized = directive.trim().toLowerCase();
    if (!normalized.startsWith("max-age=")) {
      continue;
    }

    const rawSeconds = normalized.slice("max-age=".length).replaceAll('"', "");
    const seconds = Number.parseInt(rawSeconds, 10);
    if (!Number.isFinite(seconds) || seconds < 0) {
      return undefined;
    }

    const responseDateMs = responseDate ? Date.parse(responseDate) : Number.NaN;
    const baseMs = Number.isFinite(responseDateMs) ? responseDateMs : Date.now();
    return new Date(baseMs + seconds * 1000).toISOString();
  }

  return undefined;
};

export const isRemoteCacheFresh = (expiresAt: string | undefined): boolean => {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return false;
  }

  return expiresAtMs > Date.now();
};

const resolveBytesSkipped = (
  previous: RemoteCachePreviousState,
  fallbackContentLength: number | undefined,
): number => previous.bytes ?? fallbackContentLength ?? 0;

export class RemoteCacheStatsCollector {
  readonly scriptId: string;
  private readonly entries = new Map<string, RemoteCacheStatsEntry>();

  constructor(scriptId: string) {
    this.scriptId = scriptId;
  }

  record(result: RemoteCacheFetchResult): void {
    const key = [
      result.pipeline,
      result.policy.rule.id,
      result.policy.host,
      result.policy.rule.checkMode,
    ].join("|");
    const existing = this.entries.get(key) ?? {
      pipeline: result.pipeline,
      host: result.policy.host,
      matchedDomain: result.policy.matchedDomain,
      ruleId: result.policy.rule.id,
      checkMode: result.policy.rule.checkMode,
      totalChecks: 0,
      cacheFresh: 0,
      headUnchanged: 0,
      getNotModified: 0,
      fetched: 0,
      errors: 0,
      bytesFetched: 0,
      bytesSkipped: 0,
      headFallbacks: {},
    };

    existing.pipeline = result.pipeline;
    existing.totalChecks += 1;
    existing.bytesFetched += result.bytesFetched;
    existing.bytesSkipped += result.bytesSkipped;

    if (result.checkStatus === "cache_fresh") {
      existing.cacheFresh += 1;
    } else if (result.checkStatus === "head_unchanged") {
      existing.headUnchanged += 1;
    } else if (result.checkStatus === "get_not_modified") {
      existing.getNotModified += 1;
    } else if (result.checkStatus === "fetched") {
      existing.fetched += 1;
    } else {
      existing.errors += 1;
    }

    if (result.headFallbackReason) {
      existing.headFallbacks[result.headFallbackReason] =
        (existing.headFallbacks[result.headFallbackReason] ?? 0) + 1;
    }

    this.entries.set(key, existing);
  }

  toSummary(): RemoteCacheRunSummary {
    const entries = [...this.entries.values()].sort((left, right) => {
      if (left.pipeline !== right.pipeline) {
        return left.pipeline.localeCompare(right.pipeline);
      }
      return left.host.localeCompare(right.host);
    });

    return {
      version: 1,
      scriptId: this.scriptId,
      generatedAt: new Date().toISOString(),
      totals: {
        totalChecks: entries.reduce((sum, entry) => sum + entry.totalChecks, 0),
        cacheFresh: entries.reduce((sum, entry) => sum + entry.cacheFresh, 0),
        headUnchanged: entries.reduce((sum, entry) => sum + entry.headUnchanged, 0),
        getNotModified: entries.reduce((sum, entry) => sum + entry.getNotModified, 0),
        fetched: entries.reduce((sum, entry) => sum + entry.fetched, 0),
        errors: entries.reduce((sum, entry) => sum + entry.errors, 0),
        bytesFetched: entries.reduce((sum, entry) => sum + entry.bytesFetched, 0),
        bytesSkipped: entries.reduce((sum, entry) => sum + entry.bytesSkipped, 0),
      },
      entries,
    };
  }
}

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

export const createRemoteCacheStatsOutputPath = (scriptId: string): string => {
  const sanitizedId = scriptId.replaceAll(/[^a-zA-Z0-9_-]+/g, "-");
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join("output", "cache-revalidation", `${timestamp}-${sanitizedId}.json`);
};

export const writeRemoteCacheRunSummary = (
  relativePath: string,
  collector: RemoteCacheStatsCollector,
): void => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(collector.toSummary(), null, 2)}\n`, "utf8");
};

export const fetchWithRemoteCachePolicy = async (
  options: RemoteCacheFetchOptions,
): Promise<RemoteCacheFetchResult> => {
  const startedAt = performance.now();
  const policy = resolveRequiredRemoteCachePolicyRule({
    registry: options.policyRegistry,
    pipeline: options.pipeline,
    url: options.url,
  });
  const previous = normalizePreviousState(options.previous);
  const cacheValueAvailable = options.cacheValueAvailable === true;
  const retries = Math.max(0, Math.floor(options.retries ?? 0));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? 250));
  const checkedAt = new Date().toISOString();
  const baseHeaders = buildBaseHeaders({
    userAgent: options.userAgent,
    headers: options.headers,
    acceptHeader: options.acceptHeader,
  });

  const finalize = <T extends RemoteCacheFetchResult>(result: T): T => {
    options.statsCollector?.record(result);
    return result;
  };

  if (!options.force && cacheValueAvailable && isRemoteCacheFresh(previous.expiresAt)) {
    return finalize({
      kind: "cache_fresh",
      checkStatus: "cache_fresh",
      method: "none",
      url: options.url,
      pipeline: options.pipeline,
      policy,
      checkMode: policy.rule.checkMode,
      checkedAt,
      durationMs: performance.now() - startedAt,
      attemptedHead: false,
      finalUrl: options.url,
      headers: {
        etag: previous.etag,
        lastModified: previous.lastModified,
        cacheControl: previous.cacheControl,
      },
      bytesFetched: 0,
      bytesSkipped: resolveBytesSkipped(previous, undefined),
    });
  }

  let attemptedHead = false;
  let headFallbackReason: RemoteCacheHeadFallbackReason | undefined;

  if (
    !options.force &&
    policy.rule.checkMode === "head_then_get" &&
    hasPreviousValidators(previous)
  ) {
    attemptedHead = true;
    const headResult = await requestWithRetries({
      method: "HEAD",
      url: options.url,
      timeoutMs: Math.max(500, Math.floor(options.timeoutMs)),
      retries,
      retryDelayMs,
      headers: baseHeaders,
    });

    if (headResult.ok && headResult.statusCode === 304) {
      if (cacheValueAvailable) {
        return finalize({
          kind: "not_modified",
          checkStatus: "head_unchanged",
          method: "HEAD",
          url: options.url,
          pipeline: options.pipeline,
          policy,
          checkMode: policy.rule.checkMode,
          checkedAt,
          durationMs: performance.now() - startedAt,
          attemptedHead,
          finalUrl: headResult.finalUrl,
          headers: headResult.headers,
          statusCode: headResult.statusCode,
          bytesFetched: 0,
          bytesSkipped: resolveBytesSkipped(previous, headResult.headers.contentLength),
        });
      }

      headFallbackReason = "cache_value_missing";
    } else if (headResult.ok) {
      const matches = validatorsMatch(previous, headResult.headers);

      if (matches && cacheValueAvailable) {
        return finalize({
          kind: "not_modified",
          checkStatus: "head_unchanged",
          method: "HEAD",
          url: options.url,
          pipeline: options.pipeline,
          policy,
          checkMode: policy.rule.checkMode,
          checkedAt,
          durationMs: performance.now() - startedAt,
          attemptedHead,
          finalUrl: headResult.finalUrl,
          headers: headResult.headers,
          statusCode: headResult.statusCode,
          bytesFetched: 0,
          bytesSkipped: resolveBytesSkipped(previous, headResult.headers.contentLength),
        });
      }

      if (matches) {
        headFallbackReason = "cache_value_missing";
      } else if (!headResult.headers.etag && !headResult.headers.lastModified) {
        headFallbackReason = "missing_validators";
      } else {
        headFallbackReason = "changed";
      }
    } else if (headResult.statusCode !== undefined) {
      headFallbackReason = "status_not_ok";
    } else {
      headFallbackReason = "network_error";
    }
  }

  const includeConditionalValidators =
    !options.force && policy.rule.checkMode !== "always_get" && hasPreviousValidators(previous);
  const getResult = await requestWithRetries({
    method: "GET",
    url: options.url,
    timeoutMs: Math.max(500, Math.floor(options.timeoutMs)),
    retries,
    retryDelayMs,
    headers: buildConditionalHeaders({
      baseHeaders,
      previous,
      includeValidators: includeConditionalValidators,
    }),
  });

  if (getResult.ok && getResult.statusCode === 304) {
    if (!cacheValueAvailable) {
      return finalize({
        kind: "error",
        checkStatus: "error",
        method: "GET",
        error: `Received HTTP 304 for '${options.url}' but no cached value is available.`,
        url: options.url,
        pipeline: options.pipeline,
        policy,
        checkMode: policy.rule.checkMode,
        checkedAt,
        durationMs: performance.now() - startedAt,
        attemptedHead,
        headFallbackReason,
        finalUrl: getResult.finalUrl,
        headers: getResult.headers,
        statusCode: getResult.statusCode,
        bytesFetched: 0,
        bytesSkipped: 0,
      });
    }

    return finalize({
      kind: "not_modified",
      checkStatus: "get_not_modified",
      method: "GET",
      url: options.url,
      pipeline: options.pipeline,
      policy,
      checkMode: policy.rule.checkMode,
      checkedAt,
      durationMs: performance.now() - startedAt,
      attemptedHead,
      headFallbackReason,
      finalUrl: getResult.finalUrl,
      headers: getResult.headers,
      statusCode: getResult.statusCode,
      bytesFetched: 0,
      bytesSkipped: resolveBytesSkipped(previous, getResult.headers.contentLength),
    });
  }

  if (!getResult.ok) {
    return finalize({
      kind: "error",
      checkStatus: "error",
      method: "GET",
      error: getResult.error ?? "Metadata fetch failed.",
      url: options.url,
      pipeline: options.pipeline,
      policy,
      checkMode: policy.rule.checkMode,
      checkedAt,
      durationMs: performance.now() - startedAt,
      attemptedHead,
      headFallbackReason,
      finalUrl: getResult.finalUrl,
      headers: getResult.headers ?? {},
      statusCode: getResult.statusCode,
      bytesFetched: 0,
      bytesSkipped: 0,
    });
  }

  const response = getResult.response;
  const body =
    options.bodyType === "buffer"
      ? Buffer.from(await response.arrayBuffer())
      : await response.text();
  const bytesFetched = typeof body === "string" ? Buffer.byteLength(body, "utf8") : body.byteLength;

  if (bytesFetched === 0) {
    return finalize({
      kind: "error",
      checkStatus: "error",
      method: "GET",
      error: "Response body was empty.",
      url: options.url,
      pipeline: options.pipeline,
      policy,
      checkMode: policy.rule.checkMode,
      checkedAt,
      durationMs: performance.now() - startedAt,
      attemptedHead,
      headFallbackReason,
      finalUrl: getResult.finalUrl,
      headers: getResult.headers,
      statusCode: getResult.statusCode,
      bytesFetched: 0,
      bytesSkipped: 0,
    });
  }

  return finalize({
    kind: "fetched",
    checkStatus: "fetched",
    method: "GET",
    body,
    url: options.url,
    pipeline: options.pipeline,
    policy,
    checkMode: policy.rule.checkMode,
    checkedAt,
    durationMs: performance.now() - startedAt,
    attemptedHead,
    headFallbackReason,
    finalUrl: getResult.finalUrl,
    headers: getResult.headers,
    statusCode: getResult.statusCode,
    bytesFetched,
    bytesSkipped: 0,
  });
};
