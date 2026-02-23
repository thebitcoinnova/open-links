import { performance } from "node:perf_hooks";

export interface FetchMetadataOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs?: number;
}

export interface FetchMetadataResult {
  ok: boolean;
  html?: string;
  attempts: number;
  durationMs: number;
  statusCode?: number;
  error?: string;
}

interface FetchOnceResult {
  ok: boolean;
  html?: string;
  statusCode?: number;
  error?: string;
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchOnce = async (url: string, timeoutMs: number): Promise<FetchOnceResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "open-links-enricher/0.1",
        accept: "text/html,application/xhtml+xml"
      }
    });

    const html = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        error: `Received HTTP ${response.status}`
      };
    }

    return {
      ok: true,
      statusCode: response.status,
      html
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    return {
      ok: false,
      error: message
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchMetadata = async (
  url: string,
  options: FetchMetadataOptions
): Promise<FetchMetadataResult> => {
  const timeoutMs = Math.max(500, Math.floor(options.timeoutMs));
  const retries = Math.max(0, Math.floor(options.retries));
  const retryDelayMs = Math.max(0, Math.floor(options.retryDelayMs ?? 250));
  const attemptsAllowed = retries + 1;
  const startedAt = performance.now();

  let lastError = "Metadata fetch failed";
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= attemptsAllowed; attempt += 1) {
    const result = await fetchOnce(url, timeoutMs);

    if (result.ok && result.html) {
      return {
        ok: true,
        html: result.html,
        attempts: attempt,
        durationMs: performance.now() - startedAt,
        statusCode: result.statusCode
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
    error: lastError
  };
};
