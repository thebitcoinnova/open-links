import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  extractCookieNames,
  fileTimestamp,
  nowIso,
  resolveLinkedinUrl,
  resolveSessionConfig,
  runAgentBrowserJson,
  toAbsoluteFromRoot,
  valueForFlag,
  writeJsonFile
} from "./linkedin-poc-common";

const AUTH_COOKIE_CANDIDATES = ["li_at", "liap"];

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

const run = async () => {
  const args = process.argv.slice(2);
  const urlOverride = valueForFlag(args, "--url");
  const targetUrl = resolveLinkedinUrl(urlOverride);
  const config = resolveSessionConfig();

  console.log("Starting LinkedIn manual auth session initializer...");
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Session: ${config.session}`);
  console.log(`Session name: ${config.sessionName}`);

  const openResult = runAgentBrowserJson(["open", targetUrl], config, {
    extraArgs: ["--headed"],
    allowFailure: true
  });
  if (openResult.response?.success === false) {
    console.warn(`agent-browser open returned a warning: ${openResult.response.error ?? "unknown error"}`);
    console.warn("Continuing so you can complete login manually in the opened browser.");
  }

  console.log("");
  console.log("Complete login in the opened browser.");
  console.log("If prompted, complete MFA/challenge steps.");
  console.log("Return here and press Enter to continue verification.");

  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Interactive terminal is required for manual login confirmation.");
  }

  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question("Press Enter after LinkedIn login is complete: ");
  rl.close();

  const currentUrlResult = runAgentBrowserJson<unknown>(["get", "url"], config, {
    allowFailure: true
  });
  const cookiesResult = runAgentBrowserJson<unknown>(["cookies", "get"], config, {
    allowFailure: true
  });

  const currentUrl = readUrlValue(currentUrlResult.response?.data);
  const cookieNames = extractCookieNames(cookiesResult.response?.data);
  const hasAuthCookie = AUTH_COOKIE_CANDIDATES.some((cookieName) => cookieNames.includes(cookieName));
  const onLinkedIn = (() => {
    if (!currentUrl) {
      return false;
    }
    try {
      return new URL(currentUrl).hostname.includes("linkedin.com");
    } catch {
      return false;
    }
  })();
  const verificationPassed = onLinkedIn && hasAuthCookie;

  const summary = {
    timestamp: nowIso(),
    mode: "manual-headed",
    session: config.session,
    sessionName: config.sessionName,
    targetUrl,
    currentUrl,
    verificationPassed,
    checks: {
      onLinkedInDomain: onLinkedIn,
      hasAuthCookie,
      authCookieCandidates: AUTH_COOKIE_CANDIDATES,
      discoveredCookieNames: cookieNames
    },
    notes: verificationPassed
      ? ["Authenticated session appears valid for LinkedIn."]
      : [
          "Session verification did not fully pass. Re-run login and confirm successful account landing page.",
          "If this persists, inspect cookie list and currentUrl in this artifact."
        ]
  };

  const artifactPath = toAbsoluteFromRoot(
    "output",
    "playwright",
    "linkedin-poc",
    `session-check-${fileTimestamp()}.json`
  );
  writeJsonFile(artifactPath, summary);

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  console.log("");
  console.log(`Verification: ${verificationPassed ? "PASS" : "FAIL"}`);
  console.log(`Current URL: ${currentUrl ?? "unknown"}`);
  console.log(`Cookies found: ${cookieNames.length}`);
  console.log(`Artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(
    verificationPassed
      ? "Next step: npm run poc:linkedin:validate"
      : "Re-run: npm run poc:linkedin:login"
  );

  process.exit(verificationPassed ? 0 : 1);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LinkedIn login session initializer failed: ${message}`);
  process.exit(1);
});
