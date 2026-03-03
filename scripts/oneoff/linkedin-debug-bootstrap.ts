import process from "node:process";
import {
  type SessionConfig,
  isBrowserBinaryMissingError,
  nowIso,
  redactSecret,
  resolveSessionConfig,
  runAgentBrowserJson,
  runRawCommand,
} from "./linkedin-debug-common";

const installAgentBrowserBinaries = () => {
  console.log("Installing browser binaries via agent-browser...");
  runRawCommand("npx", ["--yes", "agent-browser", "install"], {
    allowFailure: false,
  });
};

const probeAgentBrowser = (config: SessionConfig) => {
  const probeSession = `${config.session}-bootstrap-probe`;
  const probeSessionName = `${config.sessionName}-bootstrap-probe`;
  const probeConfig: SessionConfig = {
    session: probeSession,
    sessionName: probeSessionName,
    encryptionKey: config.encryptionKey,
  };

  const openResult = runAgentBrowserJson(["open", "https://example.com"], probeConfig, {
    allowFailure: true,
  });

  const closeResult = runAgentBrowserJson(["close"], probeConfig, {
    allowFailure: true,
  });

  return { openResult, closeResult };
};

const run = () => {
  const startedAt = nowIso();
  const npxCheck = runRawCommand("npx", ["--version"], {
    allowFailure: true,
  });
  if (npxCheck.status !== 0) {
    throw new Error(
      "npx is required for LinkedIn authenticated debug tooling. Install Node.js/npm and retry.",
    );
  }

  const config = resolveSessionConfig();
  const versionResult = runRawCommand("npx", ["--yes", "agent-browser", "--version"], {
    allowFailure: true,
  });
  if (versionResult.status !== 0) {
    const details = [versionResult.stderr, versionResult.stdout]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join("\n");
    throw new Error(`agent-browser is not usable in this environment.\n${details}`);
  }

  let installAttempted = false;
  let probe = probeAgentBrowser(config);
  const probeFailureContext = `${probe.openResult.stderr}\n${probe.openResult.stdout}\n${
    probe.openResult.response?.error ?? ""
  }`;

  if (
    probe.openResult.status !== 0 ||
    probe.openResult.response?.success === false ||
    probe.openResult.response === null
  ) {
    if (!isBrowserBinaryMissingError(probeFailureContext)) {
      throw new Error(
        `agent-browser probe failed for a non-install reason:\n${probeFailureContext.trim()}`,
      );
    }

    installAttempted = true;
    installAgentBrowserBinaries();
    probe = probeAgentBrowser(config);

    if (
      probe.openResult.status !== 0 ||
      probe.openResult.response?.success === false ||
      probe.openResult.response === null
    ) {
      const retryContext = `${probe.openResult.stderr}\n${probe.openResult.stdout}\n${
        probe.openResult.response?.error ?? ""
      }`;
      throw new Error(`agent-browser probe still failed after install:\n${retryContext.trim()}`);
    }
  }

  console.log("LinkedIn authenticated metadata debug bootstrap complete.");
  console.log(`Started at: ${startedAt}`);
  console.log(`Session: ${config.session}`);
  console.log(`Session name: ${config.sessionName}`);
  console.log(`Encryption key: ${redactSecret(config.encryptionKey)}`);
  console.log(`Browser install attempted: ${installAttempted ? "yes" : "no"}`);
  console.log("Next step: npm run linkedin:debug:login");
};

try {
  run();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LinkedIn debug bootstrap failed: ${message}`);
  process.exit(1);
}
