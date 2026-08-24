import { performance } from "node:perf_hooks";
import type {
  RemoteCacheFetchOptions,
  RemoteCacheFetchResult,
  RemoteCacheHeadFallbackReason,
  RemoteCachePreviousState,
  RemoteCacheResponseHeaders,
  RequestAttemptResult,
} from "./remote-cache-contracts";
import {
  type RemoteCacheCheckMode,
  type RemoteCachePipeline,
  resolveRequiredRemoteCachePolicyRule,
} from "./remote-cache-policy";
import { RemoteCacheStatsCollector } from "./remote-cache-stats";

export type * from "./remote-cache-contracts";
export {
  RemoteCacheStatsCollector,
  createRemoteCacheStatsOutputPath,
  writeRemoteCacheRunSummary,
} from "./remote-cache-stats";

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

type ResolvedRemoteCachePolicy = ReturnType<typeof resolveRequiredRemoteCachePolicyRule>;

const remoteResultBase = (input: {
  options: RemoteCacheFetchOptions;
  policy: ResolvedRemoteCachePolicy;
  checkedAt: string;
  startedAt: number;
  attemptedHead: boolean;
  headFallbackReason?: RemoteCacheHeadFallbackReason;
}) => ({
  url: input.options.url,
  pipeline: input.options.pipeline,
  policy: input.policy,
  checkMode: input.policy.rule.checkMode,
  checkedAt: input.checkedAt,
  durationMs: performance.now() - input.startedAt,
  attemptedHead: input.attemptedHead,
  headFallbackReason: input.headFallbackReason,
});

const finalizeRemoteResult = <T extends RemoteCacheFetchResult>(
  options: RemoteCacheFetchOptions,
  result: T,
): T => {
  options.statsCollector?.record(result);
  return result;
};

interface RemoteHeadCheckContext {
  options: RemoteCacheFetchOptions;
  policy: ResolvedRemoteCachePolicy;
  previous: RemoteCachePreviousState;
  cacheValueAvailable: boolean;
  retries: number;
  retryDelayMs: number;
  checkedAt: string;
  startedAt: number;
  baseHeaders: Record<string, string>;
}

const createRemoteFetchContext = (options: RemoteCacheFetchOptions): RemoteHeadCheckContext => ({
  options,
  startedAt: performance.now(),
  policy: resolveRequiredRemoteCachePolicyRule({
    registry: options.policyRegistry,
    pipeline: options.pipeline,
    url: options.url,
  }),
  previous: normalizePreviousState(options.previous),
  cacheValueAvailable: options.cacheValueAvailable === true,
  retries: Math.max(0, Math.floor(options.retries ?? 0)),
  retryDelayMs: Math.max(0, Math.floor(options.retryDelayMs ?? 250)),
  checkedAt: new Date().toISOString(),
  baseHeaders: buildBaseHeaders({
    userAgent: options.userAgent,
    headers: options.headers,
    acceptHeader: options.acceptHeader,
  }),
});

const maybeFreshRemoteResult = (
  context: RemoteHeadCheckContext,
): RemoteCacheFetchResult | undefined => {
  const { options, policy, previous, cacheValueAvailable, checkedAt, startedAt } = context;
  if (options.force || !cacheValueAvailable || !isRemoteCacheFresh(previous.expiresAt)) {
    return undefined;
  }
  return finalizeRemoteResult(options, {
    ...remoteResultBase({ options, policy, checkedAt, startedAt, attemptedHead: false }),
    kind: "cache_fresh",
    checkStatus: "cache_fresh",
    method: "none",
    finalUrl: options.url,
    headers: {
      etag: previous.etag,
      lastModified: previous.lastModified,
      cacheControl: previous.cacheControl,
    },
    bytesFetched: 0,
    bytesSkipped: resolveBytesSkipped(previous, undefined),
  });
};

const checkRemoteHead = async (
  context: RemoteHeadCheckContext,
): Promise<{
  attemptedHead: boolean;
  headFallbackReason?: RemoteCacheHeadFallbackReason;
  result?: RemoteCacheFetchResult;
}> => {
  const {
    options,
    policy,
    previous,
    cacheValueAvailable,
    retries,
    retryDelayMs,
    checkedAt,
    startedAt,
    baseHeaders,
  } = context;
  if (
    options.force ||
    policy.rule.checkMode !== "head_then_get" ||
    !hasPreviousValidators(previous)
  ) {
    return { attemptedHead: false };
  }

  const headResult = await requestWithRetries({
    method: "HEAD",
    url: options.url,
    timeoutMs: Math.max(500, Math.floor(options.timeoutMs)),
    retries,
    retryDelayMs,
    headers: baseHeaders,
  });
  if (headResult.ok) {
    const unchanged =
      headResult.statusCode === 304 || validatorsMatch(previous, headResult.headers);
    if (unchanged && cacheValueAvailable) {
      return {
        attemptedHead: true,
        result: finalizeRemoteResult(options, {
          ...remoteResultBase({ options, policy, checkedAt, startedAt, attemptedHead: true }),
          kind: "not_modified",
          checkStatus: "head_unchanged",
          method: "HEAD",
          finalUrl: headResult.finalUrl,
          headers: headResult.headers,
          statusCode: headResult.statusCode,
          bytesFetched: 0,
          bytesSkipped: resolveBytesSkipped(previous, headResult.headers.contentLength),
        }),
      };
    }
    if (unchanged) return { attemptedHead: true, headFallbackReason: "cache_value_missing" };
    if (!headResult.headers.etag && !headResult.headers.lastModified) {
      return { attemptedHead: true, headFallbackReason: "missing_validators" };
    }
    return { attemptedHead: true, headFallbackReason: "changed" };
  }
  return {
    attemptedHead: true,
    headFallbackReason: headResult.statusCode === undefined ? "network_error" : "status_not_ok",
  };
};

export const fetchWithRemoteCachePolicy = async (
  options: RemoteCacheFetchOptions,
): Promise<RemoteCacheFetchResult> => {
  const context = createRemoteFetchContext(options);
  const {
    startedAt,
    policy,
    previous,
    cacheValueAvailable,
    retries,
    retryDelayMs,
    checkedAt,
    baseHeaders,
  } = context;

  const maybeFreshResult = maybeFreshRemoteResult(context);
  if (maybeFreshResult) return maybeFreshResult;

  const headCheck = await checkRemoteHead(context);
  if (headCheck.result) return headCheck.result;
  const { attemptedHead, headFallbackReason } = headCheck;

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
      return finalizeRemoteResult(options, {
        ...remoteResultBase({
          options,
          policy,
          checkedAt,
          startedAt,
          attemptedHead,
          headFallbackReason,
        }),
        kind: "error",
        checkStatus: "error",
        method: "GET",
        error: `Received HTTP 304 for '${options.url}' but no cached value is available.`,
        finalUrl: getResult.finalUrl,
        headers: getResult.headers,
        statusCode: getResult.statusCode,
        bytesFetched: 0,
        bytesSkipped: 0,
      });
    }

    return finalizeRemoteResult(options, {
      ...remoteResultBase({
        options,
        policy,
        checkedAt,
        startedAt,
        attemptedHead,
        headFallbackReason,
      }),
      kind: "not_modified",
      checkStatus: "get_not_modified",
      method: "GET",
      finalUrl: getResult.finalUrl,
      headers: getResult.headers,
      statusCode: getResult.statusCode,
      bytesFetched: 0,
      bytesSkipped: resolveBytesSkipped(previous, getResult.headers.contentLength),
    });
  }

  if (!getResult.ok) {
    return finalizeRemoteResult(options, {
      ...remoteResultBase({
        options,
        policy,
        checkedAt,
        startedAt,
        attemptedHead,
        headFallbackReason,
      }),
      kind: "error",
      checkStatus: "error",
      method: "GET",
      error: getResult.error ?? "Metadata fetch failed.",
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
    return finalizeRemoteResult(options, {
      ...remoteResultBase({
        options,
        policy,
        checkedAt,
        startedAt,
        attemptedHead,
        headFallbackReason,
      }),
      kind: "error",
      checkStatus: "error",
      method: "GET",
      error: "Response body was empty.",
      finalUrl: getResult.finalUrl,
      headers: getResult.headers,
      statusCode: getResult.statusCode,
      bytesFetched: 0,
      bytesSkipped: 0,
    });
  }

  return finalizeRemoteResult(options, {
    ...remoteResultBase({
      options,
      policy,
      checkedAt,
      startedAt,
      attemptedHead,
      headFallbackReason,
    }),
    kind: "fetched",
    checkStatus: "fetched",
    method: "GET",
    body,
    finalUrl: getResult.finalUrl,
    headers: getResult.headers,
    statusCode: getResult.statusCode,
    bytesFetched,
    bytesSkipped: 0,
  });
};
