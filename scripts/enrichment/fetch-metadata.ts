import {
  type RemoteCacheCheckStatus,
  type RemoteCacheHeadFallbackReason,
  type RemoteCacheStatsCollector,
  fetchWithRemoteCachePolicy,
} from "../shared/remote-cache-fetch";
import {
  type RemoteCacheCheckMode,
  type RemoteCachePolicyRegistry,
  loadRemoteCachePolicyRegistry,
} from "../shared/remote-cache-policy";

export interface FetchMetadataOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  acceptHeader?: string;
  policyRegistry?: RemoteCachePolicyRegistry;
  statsCollector?: RemoteCacheStatsCollector;
  force?: boolean;
  cache?: {
    etag?: string;
    lastModified?: string;
    cacheControl?: string;
    expiresAt?: string;
    bytes?: number;
    hasValue?: boolean;
  };
}

export interface FetchMetadataResult {
  ok: boolean;
  notModified?: boolean;
  html?: string;
  attempts: number;
  durationMs: number;
  statusCode?: number;
  error?: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  responseDate?: string;
  contentType?: string;
  contentLength?: number;
  checkStatus?: RemoteCacheCheckStatus;
  checkMode?: RemoteCacheCheckMode;
  attemptedHead?: boolean;
  headFallbackReason?: RemoteCacheHeadFallbackReason;
  bytesFetched?: number;
  bytesSkipped?: number;
}

const DEFAULT_POLICY_REGISTRY = loadRemoteCachePolicyRegistry();

export const fetchMetadata = async (
  url: string,
  options: FetchMetadataOptions,
): Promise<FetchMetadataResult> => {
  const result = await fetchWithRemoteCachePolicy({
    url,
    pipeline: "public_rich_metadata",
    policyRegistry: options.policyRegistry ?? DEFAULT_POLICY_REGISTRY,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    retryDelayMs: options.retryDelayMs,
    headers: options.headers,
    acceptHeader: options.acceptHeader,
    userAgent: "open-links-enricher/0.1",
    bodyType: "text",
    previous: options.cache,
    cacheValueAvailable: options.cache?.hasValue,
    force: options.force,
    statsCollector: options.statsCollector,
  });

  if (result.kind === "fetched") {
    return {
      ok: true,
      html: typeof result.body === "string" ? result.body : result.body.toString("utf8"),
      attempts: options.retries + 1,
      durationMs: result.durationMs,
      statusCode: result.statusCode,
      etag: result.headers.etag,
      lastModified: result.headers.lastModified,
      cacheControl: result.headers.cacheControl,
      responseDate: result.headers.responseDate,
      contentType: result.headers.contentType,
      contentLength: result.headers.contentLength,
      checkStatus: result.checkStatus,
      checkMode: result.checkMode,
      attemptedHead: result.attemptedHead,
      headFallbackReason: result.headFallbackReason,
      bytesFetched: result.bytesFetched,
      bytesSkipped: result.bytesSkipped,
    };
  }

  if (result.kind === "not_modified" || result.kind === "cache_fresh") {
    return {
      ok: false,
      notModified: true,
      attempts: options.retries + 1,
      durationMs: result.durationMs,
      statusCode: result.statusCode,
      etag: result.headers.etag,
      lastModified: result.headers.lastModified,
      cacheControl: result.headers.cacheControl,
      responseDate: result.headers.responseDate,
      contentType: result.headers.contentType,
      contentLength: result.headers.contentLength,
      checkStatus: result.checkStatus,
      checkMode: result.checkMode,
      attemptedHead: result.attemptedHead,
      headFallbackReason: result.headFallbackReason,
      bytesFetched: result.bytesFetched,
      bytesSkipped: result.bytesSkipped,
    };
  }

  return {
    ok: false,
    attempts: options.retries + 1,
    durationMs: result.durationMs,
    statusCode: result.statusCode,
    error: result.error,
    etag: result.headers.etag,
    lastModified: result.headers.lastModified,
    cacheControl: result.headers.cacheControl,
    responseDate: result.headers.responseDate,
    contentType: result.headers.contentType,
    contentLength: result.headers.contentLength,
    checkStatus: result.checkStatus,
    checkMode: result.checkMode,
    attemptedHead: result.attemptedHead,
    headFallbackReason: result.headFallbackReason,
    bytesFetched: result.bytesFetched,
    bytesSkipped: result.bytesSkipped,
  };
};
