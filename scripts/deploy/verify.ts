import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deploymentConfig, getCanonicalUrl, getPublicUrl } from "../../src/lib/deployment-config";
import { runCommand } from "../lib/command";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { parseArgs } from "./shared";

interface VerificationHttpResponse {
  body: string;
  headers: Map<string, string>;
  ok: boolean;
  source: "curl-resolve" | "fetch";
  status: number;
  url: string;
}

const args = parseArgs(process.argv.slice(2));
const retries = Number(args.retries ?? "12");
const delayMs = Number(args["delay-ms"] ?? "5000");
const verificationResults = [];
const commandName = "deploy:verify";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: "verification",
});

await run.addBreadcrumb({
  data: { delayMs, retries },
  detail: "Starting production verification checks.",
  status: "info",
  step: "initialize",
});

const canonicalUrl = getCanonicalUrl("/");
const canonicalResponse = await requestWithRetries(canonicalUrl, retries, delayMs);
const canonicalHtml = canonicalResponse.body;

assert(canonicalResponse.ok, `Expected ${canonicalUrl} to return 200.`);
assert(
  canonicalHtml.includes(
    `rel="canonical" href="${getCanonicalUrl("/").replaceAll('"', "&quot;")}"`,
  ),
  `Expected ${canonicalUrl} to include a canonical link to ${getCanonicalUrl("/")}.`,
);
assert(
  canonicalHtml.includes('name="robots" content="index, follow"'),
  `Expected ${canonicalUrl} to include an indexable robots meta tag.`,
);

verificationResults.push({
  detail: `${canonicalUrl} returned ${canonicalResponse.status} via ${canonicalResponse.source} and included canonical/indexable metadata.`,
  name: "canonical host",
  status: "passed" as const,
});

const pagesUrl = getPublicUrl("github-pages", "/");
const pagesResponse = await requestWithRetries(pagesUrl, retries, delayMs);
const pagesHtml = pagesResponse.body;

assert(pagesResponse.ok, `Expected ${pagesUrl} to return 200.`);
assert(
  pagesHtml.includes('name="robots" content="noindex, nofollow"'),
  `Expected ${pagesUrl} to include a noindex robots meta tag.`,
);
assert(
  pagesHtml.includes(`rel="canonical" href="${getCanonicalUrl("/").replaceAll('"', "&quot;")}"`),
  `Expected ${pagesUrl} to canonicalize to ${getCanonicalUrl("/")}.`,
);

verificationResults.push({
  detail: `${pagesUrl} returned ${pagesResponse.status} via ${pagesResponse.source}, noindexed the mirror, and pointed at the canonical AWS URL.`,
  name: "GitHub Pages mirror",
  status: "passed" as const,
});

const summary = {
  appliedChanges: [] as string[],
  artifactDir: undefined,
  artifactHash: undefined,
  command: commandName,
  discoveredRemoteState: {
    canonicalOrigin: deploymentConfig.primaryCanonicalOrigin,
    pagesOrigin: getPublicUrl("github-pages", "/"),
  },
  mode: "check" as const,
  plannedChanges: {},
  resultingUrls: [deploymentConfig.primaryCanonicalOrigin, pagesUrl],
  skippedReasons: [] as string[],
  target: "verification",
  verificationResults,
};

const { runDirectory } = await writeDeploySummary(summary, { runDirectory: run.runDirectory });
console.log(`Deployment verification complete. Summary: ${runDirectory}`);

async function requestWithRetries(url: string, retries: number, delayMs: number) {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return {
          body: await response.text(),
          headers: collectResponseHeaders(response.headers),
          ok: response.ok,
          source: "fetch" as const,
          status: response.status,
          url,
        } satisfies VerificationHttpResponse;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < retries) {
      await sleep(delayMs);
    }
  }

  const fallbackResponse = await requestWithResolvedCurl(url);
  if (fallbackResponse) {
    return fallbackResponse;
  }

  const hostname = new URL(url).hostname;
  if (
    hostname === deploymentConfig.primaryCanonicalDomain &&
    resolvePublicIpv4(hostname).length === 0
  ) {
    throw new Error(
      `Domain readiness blocker: ${hostname} does not resolve publicly yet. Wait for Route 53 alias creation and DNS propagation before rerunning deploy:verify.`,
    );
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${retries} attempts.`);
}

async function requestWithResolvedCurl(url: string) {
  const hostname = new URL(url).hostname;
  if (hostname !== deploymentConfig.primaryCanonicalDomain) {
    return null;
  }

  const publicIpv4s = resolvePublicIpv4(hostname);
  for (const ipAddress of publicIpv4s) {
    const maybeResponse = await requestWithCurlResolve(url, ipAddress);
    if (maybeResponse) {
      return maybeResponse;
    }
  }

  return null;
}

async function requestWithCurlResolve(url: string, ipAddress: string) {
  const requestUrl = new URL(url);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "open-links-verify-"));
  const headersPath = path.join(tempDirectory, "headers.txt");
  const bodyPath = path.join(tempDirectory, "body.txt");

  try {
    const result = runCommand(
      "curl",
      [
        "--silent",
        "--show-error",
        "--location",
        "--output",
        bodyPath,
        "--dump-header",
        headersPath,
        "--write-out",
        "%{http_code}|%{url_effective}",
        "--resolve",
        `${requestUrl.hostname}:443:${ipAddress}`,
        requestUrl.toString(),
      ],
      { allowFailure: true },
    );

    if (result.status !== 0 || !result.stdout.includes("|")) {
      return null;
    }

    const [statusText] = result.stdout.trim().split("|");
    const status = Number(statusText);
    if (!Number.isFinite(status)) {
      return null;
    }

    return {
      body: await readFile(bodyPath, "utf8"),
      headers: await readHeaders(headersPath),
      ok: status >= 200 && status < 300,
      source: "curl-resolve" as const,
      status,
      url,
    } satisfies VerificationHttpResponse;
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

function collectResponseHeaders(headers: Headers) {
  return new Map(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
}

async function readHeaders(headersPath: string) {
  const rawHeaders = await readFile(headersPath, "utf8");
  const entries = rawHeaders
    .split(/\r?\n/)
    .filter((line) => line.includes(":"))
    .map((line) => {
      const separatorIndex = line.indexOf(":");
      return [
        line.slice(0, separatorIndex).trim().toLowerCase(),
        line.slice(separatorIndex + 1).trim(),
      ] as const;
    });

  return new Map(entries);
}

function resolvePublicIpv4(hostname: string) {
  const result = runCommand("dig", ["+short", hostname, "A"], {
    allowFailure: true,
  });

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
