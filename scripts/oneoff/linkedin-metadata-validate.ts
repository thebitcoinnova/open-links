import path from "node:path";
import process from "node:process";
import { parseMetadata } from "../enrichment/parse-metadata";
import { loadEmbeddedCode } from "../shared/embedded-code-loader";
import {
  classifyPlaceholderSignals,
  extractCookieNames,
  fileTimestamp,
  nowIso,
  resolveAuthWaitOverridesFromArgs,
  resolveAuthWaitSettings,
  resolveLinkedinUrl,
  resolveSessionConfig,
  runAgentBrowserJson,
  summarizeLinkedinAuthTransitions,
  summarizeLinkedinAuthResult,
  toAbsoluteFromRoot,
  toBooleanFlag,
  valueForFlag,
  waitForLinkedinAuthenticatedSession,
  writeJsonFile,
  writeTextFile
} from "./linkedin-debug-common";

interface CookieBridgeDiagnostic {
  enabled: boolean;
  statusCode?: number;
  ok?: boolean;
  finalUrl?: string;
  placeholderSignals?: string[];
  responseSample?: string;
  error?: string;
}

const DEFAULT_MAX_HTML_BYTES = 1_000_000;
const LINKEDIN_READ_OUTER_HTML_SNIPPET = loadEmbeddedCode("browser/linkedin/read-outer-html.js");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readUrlValue = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (isRecord(value) && typeof value.url === "string" && value.url.length > 0) {
    return value.url;
  }
  return undefined;
};

const readEvalString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (isRecord(value) && typeof value.result === "string" && value.result.length > 0) {
    return value.result;
  }
  return undefined;
};

const parseMaxHtmlBytes = (args: string[]): number => {
  const raw = valueForFlag(args, "--max-html-bytes");
  if (!raw) {
    return DEFAULT_MAX_HTML_BYTES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 10_000) {
    return DEFAULT_MAX_HTML_BYTES;
  }
  return parsed;
};

const truncateHtmlIfNeeded = (html: string, maxBytes: number): { html: string; truncated: boolean } => {
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes <= maxBytes) {
    return { html, truncated: false };
  }

  const marker = "\n<!-- truncated by linkedin-metadata-validate.ts -->\n";
  const maxContentBytes = Math.max(0, maxBytes - Buffer.byteLength(marker, "utf8"));
  const truncatedBuffer = Buffer.from(html, "utf8").subarray(0, maxContentBytes);
  return {
    html: `${truncatedBuffer.toString("utf8")}${marker}`,
    truncated: true
  };
};

const toCookieHeader = (value: unknown): string | undefined => {
  const cookies = Array.isArray(value)
    ? value
    : typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Array.isArray((value as Record<string, unknown>).cookies)
      ? ((value as Record<string, unknown>).cookies as unknown[])
      : [];

  const pairs: string[] = [];
  for (const cookie of cookies) {
    if (typeof cookie !== "object" || cookie === null || Array.isArray(cookie)) {
      continue;
    }

    const record = cookie as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : undefined;
    const cookieValue = typeof record.value === "string" ? record.value : undefined;
    if (!name || !cookieValue) {
      continue;
    }
    pairs.push(`${name}=${cookieValue}`);
  }

  return pairs.length > 0 ? pairs.join("; ") : undefined;
};

const runCookieBridgeDiagnostic = async (
  url: string,
  sessionData: unknown
): Promise<CookieBridgeDiagnostic> => {
  try {
    const cookieHeader = toCookieHeader(sessionData);
    if (!cookieHeader) {
      return {
        enabled: true,
        error: "No exportable cookies found for cookie-bridge diagnostic."
      };
    }

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        cookie: cookieHeader
      }
    });

    const html = await response.text();
    const placeholderSignals = classifyPlaceholderSignals({ html });
    const sample = html.replace(/\s+/g, " ").trim().slice(0, 600);

    return {
      enabled: true,
      statusCode: response.status,
      ok: response.ok,
      finalUrl: response.url,
      placeholderSignals,
      responseSample: sample
    };
  } catch (error) {
    return {
      enabled: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const run = async () => {
  const args = process.argv.slice(2);
  const headed = toBooleanFlag(args, "--headed");
  const cookieBridgeCheck = toBooleanFlag(args, "--cookie-bridge-check");
  const maxHtmlBytes = parseMaxHtmlBytes(args);
  const urlOverride = valueForFlag(args, "--url");

  const authOverrides = resolveAuthWaitOverridesFromArgs(args);
  const authSettings = resolveAuthWaitSettings(authOverrides);
  const precheckTimeoutMs = headed
    ? authSettings.timeoutMs
    : Math.min(authSettings.timeoutMs, 15_000);

  const config = resolveSessionConfig();
  const targetUrl = resolveLinkedinUrl(urlOverride);

  const authResult = await waitForLinkedinAuthenticatedSession(config, {
    targetUrl,
    headed,
    timeoutMs: precheckTimeoutMs,
    pollMs: authSettings.pollMs,
    logPrefix: "[linkedin:debug:validate-auth]",
    emitStateLogs: headed
  });

  const stamp = fileTimestamp();
  const summaryArtifactPath = toAbsoluteFromRoot(
    "output",
    "playwright",
    "linkedin-debug",
    `summary-${stamp}.json`
  );

  if (!authResult.verified) {
    const summary = {
      timestamp: nowIso(),
      mode: headed ? "headed" : "headless",
      targetUrl,
      pass: false,
      failureReasons: ["reauth_required"],
      auth: {
        precheckTimeoutMs,
        settings: authResult.settings,
        summary: summarizeLinkedinAuthResult(authResult),
        transitionsSummary: summarizeLinkedinAuthTransitions(authResult),
        transitions: authResult.transitions,
        finalSnapshot: authResult.finalSnapshot
      },
      cookieBridgeDiagnostic: { enabled: false }
    };

    writeJsonFile(summaryArtifactPath, summary);
    runAgentBrowserJson(["close"], config, { allowFailure: true });

    console.log("LinkedIn metadata validation: FAIL");
    console.log(`Target URL: ${targetUrl}`);
    console.log(`Session precheck: ${summarizeLinkedinAuthResult(authResult)}`);
    console.log("Reason: authenticated session not available; rerun login initializer.");
    console.log(`Summary artifact: ${path.relative(process.cwd(), summaryArtifactPath)}`);
    process.exit(1);
  }

  runAgentBrowserJson(["wait", "--load", "networkidle"], config, { allowFailure: true });
  runAgentBrowserJson(["wait", "2000"], config, { allowFailure: true });

  const currentUrlResult = runAgentBrowserJson<unknown>(["get", "url"], config, {
    allowFailure: true
  });
  const htmlResult = runAgentBrowserJson<unknown>(
    ["eval", LINKEDIN_READ_OUTER_HTML_SNIPPET],
    config,
    { allowFailure: false }
  );

  const html = readEvalString(htmlResult.response?.data);
  if (!html) {
    throw new Error(
      `Unable to read HTML from authenticated browser session. Raw payload: ${JSON.stringify(
        htmlResult.response?.data ?? null
      )}`
    );
  }
  const currentUrl = readUrlValue(currentUrlResult.response?.data);

  const parsed = parseMetadata(html, targetUrl);
  const placeholderSignals = classifyPlaceholderSignals({
    html,
    title: parsed.metadata.title,
    description: parsed.metadata.description
  });
  const metadataMissing = parsed.completeness === "none";
  const placeholderDetected = placeholderSignals.length > 0;
  const pass = !metadataMissing && !placeholderDetected;

  const cookiesPayload = runAgentBrowserJson(["cookies", "get"], config, {
    allowFailure: true
  }).response?.data;
  const cookieNames = extractCookieNames(cookiesPayload);

  const htmlWrite = truncateHtmlIfNeeded(html, maxHtmlBytes);
  const htmlArtifactPath = toAbsoluteFromRoot(
    "output",
    "playwright",
    "linkedin-debug",
    `page-${stamp}.html`
  );
  const metadataArtifactPath = toAbsoluteFromRoot(
    "output",
    "playwright",
    "linkedin-debug",
    `metadata-${stamp}.json`
  );

  writeTextFile(htmlArtifactPath, htmlWrite.html);
  writeJsonFile(metadataArtifactPath, {
    timestamp: nowIso(),
    targetUrl,
    currentUrl,
    parsed
  });

  const cookieBridgeDiagnostic = cookieBridgeCheck
    ? await runCookieBridgeDiagnostic(targetUrl, cookiesPayload)
    : { enabled: false };

  const failureReasons: string[] = [];
  if (metadataMissing) {
    failureReasons.push("metadata_missing");
  }
  if (placeholderDetected) {
    failureReasons.push(`placeholder_detected:${placeholderSignals.join(",")}`);
  }

  const summary = {
    timestamp: nowIso(),
    mode: headed ? "headed" : "headless",
    session: config.session,
    sessionName: config.sessionName,
    targetUrl,
    currentUrl,
    parseCompleteness: parsed.completeness,
    pass,
    failureReasons,
    placeholderSignals,
    metadata: parsed.metadata,
    missingFields: parsed.missing,
    htmlArtifact: path.relative(process.cwd(), htmlArtifactPath),
    metadataArtifact: path.relative(process.cwd(), metadataArtifactPath),
    htmlTruncated: htmlWrite.truncated,
    observedCookieNames: cookieNames,
    auth: {
      precheckTimeoutMs,
      settings: authResult.settings,
      summary: summarizeLinkedinAuthResult(authResult),
      transitionsSummary: summarizeLinkedinAuthTransitions(authResult),
      transitions: authResult.transitions,
      finalSnapshot: authResult.finalSnapshot
    },
    cookieBridgeDiagnostic
  };

  writeJsonFile(summaryArtifactPath, summary);
  runAgentBrowserJson(["close"], config, { allowFailure: true });

  console.log(`LinkedIn metadata validation: ${pass ? "PASS" : "FAIL"}`);
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Current URL: ${currentUrl ?? "unknown"}`);
  console.log(`Completeness: ${parsed.completeness}`);
  console.log(`Auth transitions: ${summarizeLinkedinAuthTransitions(authResult) || "none"}`);
  console.log(`Placeholder signals: ${placeholderSignals.length > 0 ? placeholderSignals.join(", ") : "none"}`);
  if (cookieBridgeCheck) {
    if ("error" in cookieBridgeDiagnostic && cookieBridgeDiagnostic.error) {
      console.log(`Cookie-bridge diagnostic: error (${cookieBridgeDiagnostic.error})`);
    } else {
      console.log(
        `Cookie-bridge diagnostic: status=${cookieBridgeDiagnostic.statusCode ?? "unknown"} placeholderSignals=${
          cookieBridgeDiagnostic.placeholderSignals?.join(", ") || "none"
        }`
      );
    }
  }
  console.log(`Summary artifact: ${path.relative(process.cwd(), summaryArtifactPath)}`);

  if (pass) {
    console.log("Next step: use parsed metadata as candidate manual metadata for data/links.json.");
  } else {
    console.log(
      "Next step: re-run linkedin:debug:login (multi-factor authentication is optional) or keep enrichment disabled/manual for LinkedIn."
    );
  }

  process.exit(pass ? 0 : 1);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LinkedIn metadata validator failed: ${message}`);
  process.exit(1);
});
