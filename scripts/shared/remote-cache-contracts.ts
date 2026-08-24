import type {
  RemoteCacheCheckMode,
  RemoteCachePipeline,
  RemoteCachePolicyRegistry,
  ResolvedRemoteCachePolicyRule,
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
  statsCollector?: RemoteCacheStatsRecorder;
}

export interface SuccessfulRequestResult {
  ok: true;
  response: Response;
  statusCode: number;
  headers: RemoteCacheResponseHeaders;
  finalUrl?: string;
}

export interface FailedRequestResult {
  ok: false;
  statusCode?: number;
  error?: string;
  headers?: RemoteCacheResponseHeaders;
  finalUrl?: string;
}

export type RequestAttemptResult = SuccessfulRequestResult | FailedRequestResult;

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

export interface RemoteCacheStatsRecorder {
  record(result: RemoteCacheFetchResult): void;
}

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
