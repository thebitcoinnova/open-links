import { performance } from "node:perf_hooks";

export interface FetchMetadataOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
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
}

interface FetchOnceResult {
  ok: boolean;
  notModified?: boolean;
  html?: string;
  statusCode?: number;
  error?: string;
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  responseDate?: string;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchOnce = async (
  url: string,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<FetchOnceResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "open-links-enricher/0.1",
        accept: "text/html,application/xhtml+xml",
        ...headers,
      },
    });

    const responseHeaders = {
      etag: response.headers.get("etag") ?? undefined,
      lastModified: response.headers.get("last-modified") ?? undefined,
      cacheControl: response.headers.get("cache-control") ?? undefined,
      responseDate: response.headers.get("date") ?? undefined,
    };

    if (response.status === 304) {
      return {
        ok: false,
        notModified: true,
        statusCode: response.status,
        ...responseHeaders,
      };
    }

    const html = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        error: `Received HTTP ${response.status}`,
        ...responseHeaders,
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      html,
      ...responseHeaders,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return {
      ok: false,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchMetadata = async (
  url: string,
  options: FetchMetadataOptions,
): Promise<FetchMetadataResult> => {
  const timeoutMs = Math.max(500, Math.floor(options.timeoutMs));
  const retries = Math.max(0, Math.floor(options.retries));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? 250));
  const attemptsAllowed = retries + 1;
  const startedAt = performance.now();
  const requestHeaders = options.headers ?? {};

  let lastError = "Metadata fetch failed";
  let lastStatusCode: number | undefined;
  let lastHeaders:
    | Pick<FetchMetadataResult, "etag" | "lastModified" | "cacheControl" | "responseDate">
    | undefined;

  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    const result = await fetchOnce(url, timeoutMs, requestHeaders);

    if (result.ok && result.html) {
      return {
        ok: true,
        html: result.html,
        attempts: attempt,
        durationMs: performance.now() - startedAt,
        statusCode: result.statusCode,
        etag: result.etag,
        lastModified: result.lastModified,
        cacheControl: result.cacheControl,
        responseDate: result.responseDate,
      };
    }

    lastHeaders = {
      etag: result.etag,
      lastModified: result.lastModified,
      cacheControl: result.cacheControl,
      responseDate: result.responseDate,
    };

    if (result.notModified) {
      return {
        ok: false,
        notModified: true,
        attempts: attempt,
        durationMs: performance.now() - startedAt,
        statusCode: result.statusCode,
        ...lastHeaders,
      };
    }

    if (result.error) {
      lastError = result.error;
    }
    if (typeof result.statusCode === "number") {
      lastStatusCode = result.statusCode;
    }

    if (attempt < attemptsAllowed && retryDelayMs > 0) {
      await delay(retryDelayMs);
    }
  }

  return {
    ok: false,
    attempts: attemptsAllowed,
    durationMs: performance.now() - startedAt,
    statusCode: lastStatusCode,
    error: lastError,
    ...lastHeaders,
  };
};
