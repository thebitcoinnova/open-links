import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  OPENLINKS_AUTH_SESSION_POLL_ENV,
  OPENLINKS_AUTH_SESSION_TIMEOUT_ENV,
  resolveAuthWaitOverridesFromArgs,
  resolveAuthWaitSettings,
  valueForFlag,
} from "../authenticated-extractors/browser-session";
import {
  loadAuthenticatedExtractorsPolicy,
  resolveAuthenticatedExtractorById,
  resolveAuthenticatedExtractorDomainMatch,
} from "../authenticated-extractors/policy";
import { getAuthenticatedExtractorPlugin } from "../authenticated-extractors/registry";

interface CliArgs {
  extractorId: string;
  targetUrl: string;
}

const ROOT = process.cwd();
const OUTPUT_DIR_RELATIVE = path.join("output", "playwright", "auth-flow");

const nowIso = (): string => new Date().toISOString();
const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const writeOutputArtifact = (payload: unknown): string => {
  const absolute = absolutePath(path.join(OUTPUT_DIR_RELATIVE, `assist-${fileTimestamp()}.json`));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absolute;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const extractorId = valueForFlag(args, "--extractor")?.trim();
  const targetUrl = valueForFlag(args, "--url")?.trim();

  if (!extractorId) {
    throw new Error("Missing required --extractor <id> argument.");
  }

  if (!targetUrl) {
    throw new Error("Missing required --url <target-url> argument.");
  }

  return {
    extractorId,
    targetUrl,
  };
};

const run = async () => {
  const startedAt = nowIso();
  const args = parseArgs();
  const rawArgs = process.argv.slice(2);
  const waitOverrides = resolveAuthWaitOverridesFromArgs(rawArgs);
  if (waitOverrides.timeoutMs) {
    process.env[OPENLINKS_AUTH_SESSION_TIMEOUT_ENV] = String(waitOverrides.timeoutMs);
  }
  if (waitOverrides.pollMs) {
    process.env[OPENLINKS_AUTH_SESSION_POLL_ENV] = String(waitOverrides.pollMs);
  }
  const waitSettings = resolveAuthWaitSettings(waitOverrides);

  const plugin = getAuthenticatedExtractorPlugin(args.extractorId);
  if (!plugin) {
    throw new Error(`Unknown extractor id '${args.extractorId}'.`);
  }

  const policy = loadAuthenticatedExtractorsPolicy();
  const policyExtractor = resolveAuthenticatedExtractorById(args.extractorId, policy);
  if (!policyExtractor) {
    throw new Error(`Extractor '${args.extractorId}' has no policy entry.`);
  }

  if (!resolveAuthenticatedExtractorDomainMatch(args.targetUrl, policyExtractor)) {
    throw new Error(
      `URL '${args.targetUrl}' does not match extractor '${args.extractorId}' domains (${policyExtractor.domains.join(
        ", ",
      )}).`,
    );
  }

  console.log("Auth flow assist");
  console.log(`Extractor: ${args.extractorId}`);
  console.log(`Target URL: ${args.targetUrl}`);
  console.log(`Auth timeout (ms): ${waitSettings.timeoutMs}`);
  console.log(`Auth poll interval (ms): ${waitSettings.pollMs}`);
  console.log(
    "This command delegates to extractor ensureSession and records transition/action reports when available.",
  );

  const ensureResult = await plugin.ensureSession({
    extractorId: args.extractorId,
    targetUrl: args.targetUrl,
  });

  const artifactPayload = {
    startedAt,
    completedAt: nowIso(),
    extractorId: args.extractorId,
    targetUrl: args.targetUrl,
    waitSettings,
    verified: ensureResult.verified,
    details: ensureResult.details,
    hasStructuredReport: Boolean(ensureResult.report),
    report: ensureResult.report ?? null,
  };
  const artifactPath = writeOutputArtifact(artifactPayload);

  console.log("");
  console.log(`Verified: ${ensureResult.verified ? "yes" : "no"}`);
  console.log(`Details: ${ensureResult.details ?? "none"}`);
  console.log(`Artifact: ${path.relative(ROOT, artifactPath)}`);
  if (!ensureResult.report) {
    console.log(
      "No structured session report was returned by this extractor. Consider migrating it to auth-flow runtime helpers.",
    );
  }

  process.exit(ensureResult.verified ? 0 : 1);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Auth flow assist failed: ${message}`);
  process.exit(1);
});
