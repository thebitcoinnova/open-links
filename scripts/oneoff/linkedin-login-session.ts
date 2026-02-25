import path from "node:path";
import process from "node:process";
import {
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
  valueForFlag,
  waitForLinkedinAuthenticatedSession,
  writeJsonFile
} from "./linkedin-debug-common";

const run = async () => {
  const args = process.argv.slice(2);
  const urlOverride = valueForFlag(args, "--url");
  const targetUrl = resolveLinkedinUrl(urlOverride);
  const config = resolveSessionConfig();
  const authOverrides = resolveAuthWaitOverridesFromArgs(args);
  const authSettings = resolveAuthWaitSettings(authOverrides);

  console.log("Starting LinkedIn auth session initializer (autonomous mode)...");
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Session: ${config.session}`);
  console.log(`Session name: ${config.sessionName}`);
  console.log(`Auth timeout (ms): ${authSettings.timeoutMs}`);
  console.log(`Auth poll interval (ms): ${authSettings.pollMs}`);
  console.log(
    "A headed browser will open. Complete login in the browser; if your account has multi-factor authentication or a challenge step, finish it there. This script continues automatically once authenticated."
  );

  const authResult = await waitForLinkedinAuthenticatedSession(config, {
    targetUrl,
    headed: true,
    timeoutMs: authSettings.timeoutMs,
    pollMs: authSettings.pollMs,
    logPrefix: "[linkedin:debug:login]",
    emitStateLogs: true
  });

  const summary = {
    timestamp: nowIso(),
    mode: "autonomous-headed",
    session: config.session,
    sessionName: config.sessionName,
    targetUrl,
    verificationPassed: authResult.verified,
    settings: authResult.settings,
    timedOut: authResult.timedOut,
    finalSnapshot: authResult.finalSnapshot,
    transitions: authResult.transitions,
    transitionsSummary: summarizeLinkedinAuthTransitions(authResult),
    notes: authResult.verified
      ? ["Authenticated session detected automatically."]
      : [
          "Authentication did not complete before timeout.",
          "Rerun login script and complete any outstanding credential/challenge steps."
        ]
  };

  const artifactPath = toAbsoluteFromRoot(
    "output",
    "playwright",
    "linkedin-debug",
    `session-check-${fileTimestamp()}.json`
  );
  writeJsonFile(artifactPath, summary);

  runAgentBrowserJson(["close"], config, { allowFailure: true });

  console.log("");
  console.log(`Verification: ${authResult.verified ? "PASS" : "FAIL"}`);
  console.log(`Session summary: ${summarizeLinkedinAuthResult(authResult)}`);
  console.log(`Transitions: ${summarizeLinkedinAuthTransitions(authResult) || "none"}`);
  console.log(`Artifact: ${path.relative(process.cwd(), artifactPath)}`);
  console.log(
    authResult.verified
      ? "Next step: npm run linkedin:debug:validate"
      : "Re-run: npm run linkedin:debug:login"
  );

  process.exit(authResult.verified ? 0 : 1);
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LinkedIn login session initializer failed: ${message}`);
  process.exit(1);
});
