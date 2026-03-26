import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BuildInfo } from "../../src/lib/build-info";
import {
  type DeployTarget,
  deploymentConfig,
  parseDeployTarget,
} from "../../src/lib/deployment-config";
import { resolveBuildInfo } from "../lib/build-info";
import { runCommand } from "../lib/command";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import {
  assertLiveTargetSnapshot,
  buildLiveTargetExpectation,
  normalizePublicBaseUrl,
} from "../lib/live-deploy-verify";
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
const explicitTarget = args.target?.trim();
const explicitTargets = args.targets
  ?.split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const targets = resolveTargets(explicitTarget, explicitTargets);
const expectedCommitSha =
  args["expect-commit-sha"]?.trim() || resolveBuildInfo().commitSha.trim() || undefined;
const verificationResults = [];
const commandName = "deploy:verify";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: targets.join(","),
});

await run.addBreadcrumb({
  data: { delayMs, expectedCommitSha, retries, targets },
  detail: "Starting live deployment verification checks.",
  status: "info",
  step: "initialize",
});

const discoveredRemoteState: Array<{
  buildInfoUrl: string;
  expectedCanonicalUrl: string;
  expectedRobotsMeta: string;
  publicUrl: string;
  target: DeployTarget;
}> = [];
const resultingUrls: string[] = [];

for (const target of targets) {
  const publicOrigin = resolveExplicitPublicOrigin(target, args);
  const expectation = buildLiveTargetExpectation(target, {
    expectedCommitSha,
    publicOrigin,
  });
  const htmlResponse = await requestWithRetries(expectation.publicUrl, retries, delayMs);
  const buildInfoResponse = await requestWithRetries(expectation.buildInfoUrl, retries, delayMs);

  assert(htmlResponse.ok, `Expected ${expectation.publicUrl} to return 200.`);
  assert(buildInfoResponse.ok, `Expected ${expectation.buildInfoUrl} to return 200.`);

  const buildInfo = parseBuildInfo(buildInfoResponse.body, target);
  assertLiveTargetSnapshot(expectation, {
    buildInfo,
    html: htmlResponse.body,
  });

  verificationResults.push({
    detail: `${expectation.publicUrl} returned ${htmlResponse.status} via ${htmlResponse.source}, ${expectation.buildInfoUrl} reported commit ${buildInfo.commitSha || "<empty>"}, and the page matched the expected canonical/robots policy.`,
    name: target,
    status: "passed" as const,
  });
  discoveredRemoteState.push({
    buildInfoUrl: expectation.buildInfoUrl,
    expectedCanonicalUrl: expectation.expectedCanonicalUrl,
    expectedRobotsMeta: expectation.expectedRobotsMeta,
    publicUrl: expectation.publicUrl,
    target,
  });
  resultingUrls.push(expectation.publicUrl);
}

const summary = {
  appliedChanges: [] as string[],
  artifactDir: undefined,
  artifactHash: undefined,
  command: commandName,
  discoveredRemoteState,
  mode: "check" as const,
  plannedChanges: {
    expectedCommitSha,
    targets,
  },
  resultingUrls,
  skippedReasons: [] as string[],
  target: targets.join(","),
  verificationResults,
};

const { runDirectory } = await writeDeploySummary(summary, { runDirectory: run.runDirectory });
console.log(`Deployment verification complete. Summary: ${runDirectory}`);

function resolveTargets(
  maybeTarget: string | undefined,
  maybeTargets: string[] | undefined,
): DeployTarget[] {
  if (maybeTarget) {
    return [parseDeployTarget(maybeTarget)];
  }

  if (maybeTargets && maybeTargets.length > 0) {
    return maybeTargets.map((target) => parseDeployTarget(target));
  }

  return ["aws", "github-pages"];
}

function resolveExplicitPublicOrigin(target: DeployTarget, parsedArgs: Record<string, string>) {
  const genericOrigin = normalizePublicBaseUrl(parsedArgs["public-origin"]);
  if (genericOrigin && targets.length === 1) {
    return genericOrigin;
  }

  return normalizePublicBaseUrl(parsedArgs[`${target}-origin`]);
}

function parseBuildInfo(body: string, target: DeployTarget) {
  try {
    return JSON.parse(body) as BuildInfo;
  } catch (error) {
    throw new Error(
      `Expected ${target} build-info.json to contain valid JSON. ${(error as Error).message}`,
    );
  }
}

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
