import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export const DEFAULT_LINKEDIN_DEBUG_SESSION = "openlinks-linkedin-debug";
export const LINKEDIN_DEBUG_OUTPUT_DIRECTORY = path.join("output", "playwright", "linkedin-debug");

export const OPENLINKS_AUTH_SESSION_TIMEOUT_ENV = "OPENLINKS_AUTH_SESSION_TIMEOUT_MS";
export const OPENLINKS_AUTH_SESSION_POLL_ENV = "OPENLINKS_AUTH_SESSION_POLL_MS";
export const DEFAULT_AUTH_SESSION_TIMEOUT_MS = 600_000;
export const DEFAULT_AUTH_SESSION_POLL_MS = 2_000;

const AUTH_COOKIE_CANDIDATES = ["li_at", "liap"];

export interface SessionConfig {
  session: string;
  sessionName: string;
  encryptionKey: string;
}

export interface AgentBrowserJsonResult<T = unknown> {
  command: string[];
  status: number | null;
  stdout: string;
  stderr: string;
  response: {
    success?: boolean;
    data?: T;
    error?: string;
  } | null;
}

export type LinkedinAuthState = "authenticated" | "login" | "mfa_challenge" | "authwall" | "unknown";

export interface AuthWaitSettings {
  timeoutMs: number;
  pollMs: number;
}

export interface LinkedinAuthSnapshot {
  timestamp: string;
  state: LinkedinAuthState;
  currentUrl?: string;
  cookieNames: string[];
  signals: string[];
}

export interface WaitForLinkedinAuthInput {
  targetUrl: string;
  headed?: boolean;
  timeoutMs?: number;
  pollMs?: number;
  logPrefix?: string;
  emitStateLogs?: boolean;
}

export interface WaitForLinkedinAuthResult {
  verified: boolean;
  timedOut: boolean;
  settings: AuthWaitSettings;
  transitions: LinkedinAuthSnapshot[];
  finalSnapshot?: LinkedinAuthSnapshot;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toText = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseInteger = (value: string | undefined): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveCurrentUrl = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (isRecord(value) && typeof value.url === "string") {
    return value.url;
  }
  return undefined;
};

const readEvalRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value) && isRecord(value.result)) {
    return value.result;
  }
  if (isRecord(value)) {
    return value;
  }
  return undefined;
};

const resolveHost = (url: string | undefined): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
};

const lower = (value: string | undefined): string => (value ?? "").toLowerCase();

export const nowIso = (): string => new Date().toISOString();

export const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

export const toAbsoluteFromRoot = (...segments: string[]): string => path.join(process.cwd(), ...segments);

export const ensureLinkedinDebugOutputDirectory = (): string => {
  const outputDir = toAbsoluteFromRoot(LINKEDIN_DEBUG_OUTPUT_DIRECTORY);
  fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
};

export const writeJsonFile = (absolutePath: string, payload: unknown): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

export const writeTextFile = (absolutePath: string, content: string): void => {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

export const redactSecret = (value: string): string => {
  if (value.length <= 10) {
    return "***";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

export const resolveSessionConfig = (): SessionConfig => {
  const session = process.env.AGENT_BROWSER_SESSION?.trim() || DEFAULT_LINKEDIN_DEBUG_SESSION;
  const sessionName = process.env.AGENT_BROWSER_SESSION_NAME?.trim() || session;
  const encryptionKey = process.env.AGENT_BROWSER_ENCRYPTION_KEY?.trim() ?? "";

  if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    throw new Error(
      "AGENT_BROWSER_ENCRYPTION_KEY is required and must be a 64-character hex value for LinkedIn authenticated debug tooling."
    );
  }

  return { session, sessionName, encryptionKey };
};

export const runRawCommand = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    allowFailure?: boolean;
    maxBufferBytes?: number;
  }
): SpawnSyncReturns<string> => {
  const maxBuffer = options?.maxBufferBytes ?? 20 * 1024 * 1024;
  const result = spawnSync(command, args, {
    cwd: options?.cwd ?? process.cwd(),
    env: options?.env ?? process.env,
    encoding: "utf8",
    maxBuffer
  });

  const status = result.status;
  const failed = status !== 0;
  if (failed && !options?.allowFailure) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const details = [stderr, stdout].filter((value) => value.length > 0).join("\n");
    throw new Error(`Command failed (${command} ${args.join(" ")}): ${details || `exit=${status}`}`);
  }

  return result;
};

const parseJsonMaybe = (stdout: string): AgentBrowserJsonResult["response"] => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    return parsed as AgentBrowserJsonResult["response"];
  } catch {
    return null;
  }
};

export const runAgentBrowserJson = <T = unknown>(
  args: string[],
  config: SessionConfig,
  options?: {
    allowFailure?: boolean;
    extraArgs?: string[];
    cwd?: string;
  }
): AgentBrowserJsonResult<T> => {
  const command = [
    "--yes",
    "agent-browser",
    "--json",
    "--session",
    config.session,
    "--session-name",
    config.sessionName,
    ...(options?.extraArgs ?? []),
    ...args
  ];

  const result = runRawCommand("npx", command, {
    allowFailure: true,
    cwd: options?.cwd
  });
  const parsed = parseJsonMaybe(result.stdout) as AgentBrowserJsonResult<T>["response"];
  const response = parsed;
  const failedByExit = result.status !== 0;
  const failedByPayload = response?.success === false;
  const shouldFail = failedByExit || failedByPayload;

  if (shouldFail && !options?.allowFailure) {
    const payloadError =
      typeof response?.error === "string" && response.error.trim().length > 0 ? response.error.trim() : undefined;
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const details = [payloadError, stderr, stdout].filter((value) => value && value.length > 0).join("\n");
    throw new Error(`agent-browser command failed (${args.join(" ")}): ${details || `exit=${result.status}`}`);
  }

  return {
    command,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    response
  };
};

export const isBrowserBinaryMissingError = (input: string): boolean => {
  const normalized = input.toLowerCase();
  return (
    normalized.includes("executable doesn't exist") ||
    normalized.includes("please run the following command to download new browsers") ||
    normalized.includes("npx playwright install")
  );
};

export const extractCookieNames = (value: unknown): string[] => {
  const cookies = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.cookies)
      ? value.cookies
      : [];

  const names: string[] = [];
  for (const cookie of cookies) {
    if (!isRecord(cookie)) {
      continue;
    }
    const name = cookie.name;
    if (typeof name === "string" && name.length > 0 && !names.includes(name)) {
      names.push(name);
    }
  }

  return names;
};

export const resolveLinkedinUrl = (overrideUrl?: string): string => {
  if (overrideUrl && overrideUrl.trim().length > 0) {
    return overrideUrl.trim();
  }

  const linksPath = toAbsoluteFromRoot("data", "links.json");
  const linksPayload = JSON.parse(fs.readFileSync(linksPath, "utf8")) as unknown;
  if (!isRecord(linksPayload) || !Array.isArray(linksPayload.links)) {
    throw new Error("Unable to resolve LinkedIn URL: data/links.json has invalid shape.");
  }

  for (const link of linksPayload.links) {
    if (!isRecord(link)) {
      continue;
    }
    if (link.id !== "linkedin") {
      continue;
    }
    if (typeof link.url !== "string" || link.url.trim().length === 0) {
      break;
    }
    return link.url.trim();
  }

  throw new Error("Unable to resolve LinkedIn URL: no links[].id='linkedin' with non-empty url.");
};

export const classifyPlaceholderSignals = (input: {
  html?: string;
  title?: string;
  description?: string;
}): string[] => {
  const findings: string[] = [];
  const title = input.title ?? "";
  const description = input.description ?? "";
  const html = input.html ?? "";
  const combined = `${title}\n${description}\n${html}`;

  const checks: Array<{ label: string; pattern: RegExp }> = [
    { label: "linkedin_signup_title", pattern: /sign up\s*\|\s*linkedin/i },
    { label: "linkedin_join_prompt", pattern: /join linkedin/i },
    { label: "linkedin_authwall", pattern: /authwall/i },
    { label: "cloudflare_challenge", pattern: /just a moment\.\.\./i },
    { label: "js_cookie_challenge", pattern: /enable javascript and cookies to continue/i }
  ];

  for (const check of checks) {
    if (check.pattern.test(combined)) {
      findings.push(check.label);
    }
  }

  return findings;
};

export const toBooleanFlag = (args: string[], flag: string): boolean => args.includes(flag);

export const valueForFlag = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const raw = args[index + 1];
  if (typeof raw !== "string" || raw.startsWith("--")) {
    return undefined;
  }

  return raw;
};

export const resolveAuthWaitSettings = (input?: {
  timeoutMs?: number;
  pollMs?: number;
}): AuthWaitSettings => {
  const envTimeout = parseInteger(process.env[OPENLINKS_AUTH_SESSION_TIMEOUT_ENV]);
  const envPoll = parseInteger(process.env[OPENLINKS_AUTH_SESSION_POLL_ENV]);

  const timeoutMs = Math.max(
    5_000,
    input?.timeoutMs ?? envTimeout ?? DEFAULT_AUTH_SESSION_TIMEOUT_MS
  );
  const pollMs = Math.max(250, input?.pollMs ?? envPoll ?? DEFAULT_AUTH_SESSION_POLL_MS);

  return {
    timeoutMs,
    pollMs: Math.min(pollMs, timeoutMs)
  };
};

export const resolveAuthWaitOverridesFromArgs = (
  args: string[]
): { timeoutMs?: number; pollMs?: number } => {
  const timeoutMs = parseInteger(valueForFlag(args, "--auth-timeout-ms"));
  const pollMs = parseInteger(valueForFlag(args, "--poll-ms"));

  return {
    timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : undefined,
    pollMs: pollMs && pollMs > 0 ? pollMs : undefined
  };
};

const inspectLinkedinAuthSnapshot = (config: SessionConfig): LinkedinAuthSnapshot => {
  const currentUrl = resolveCurrentUrl(
    runAgentBrowserJson(["get", "url"], config, { allowFailure: true }).response?.data
  );
  const cookieNames = extractCookieNames(
    runAgentBrowserJson(["cookies", "get"], config, { allowFailure: true }).response?.data
  );

  const evalData = readEvalRecord(
    runAgentBrowserJson<unknown>(
      [
        "eval",
        `(() => {
          const text = (document.body?.innerText || "")
            .replace(/\\s+/g, " ")
            .trim()
            .toLowerCase();
          return {
            title: (document.title || "").toLowerCase(),
            body: text.slice(0, 5000),
            hasPasswordField: Boolean(document.querySelector("input[type='password'], input[name='session_password'], #password")),
            hasUsernameField: Boolean(document.querySelector("input[type='email'], input[name='session_key'], #username")),
            hasOtpField: Boolean(document.querySelector("input[autocomplete='one-time-code'], input[name*='pin'], input[id*='challenge']")),
            hasGlobalNav: Boolean(document.querySelector(".global-nav, #global-nav, header nav"))
          };
        })()`
      ],
      config,
      { allowFailure: true }
    ).response?.data
  );

  const title = lower(toText(evalData?.title));
  const body = lower(toText(evalData?.body));
  const hasPasswordField = evalData?.hasPasswordField === true;
  const hasUsernameField = evalData?.hasUsernameField === true;
  const hasOtpField = evalData?.hasOtpField === true;
  const hasGlobalNav = evalData?.hasGlobalNav === true;

  const host = resolveHost(currentUrl);
  const pathText = lower(currentUrl);

  const hasAuthCookie = AUTH_COOKIE_CANDIDATES.some((cookieName) => cookieNames.includes(cookieName));
  const authwallSignals =
    /linkedin\.com\/(authwall|signup)/i.test(pathText) ||
    body.includes("join linkedin") ||
    title.includes("sign up | linkedin") ||
    title.includes("join linkedin");
  const challengeSignals =
    /linkedin\.com\/(checkpoint|challenge|security-verification)/i.test(pathText) ||
    hasOtpField ||
    body.includes("two-step verification") ||
    body.includes("enter the verification code") ||
    body.includes("security challenge") ||
    body.includes("verify it's you");
  const loginSignals =
    /linkedin\.com\/(uas\/login|login)/i.test(pathText) ||
    hasPasswordField ||
    hasUsernameField ||
    body.includes("sign in") ||
    title.includes("sign in");

  const signals: string[] = [];
  let state: LinkedinAuthState = "unknown";

  if (host && !host.includes("linkedin.com")) {
    signals.push("outside_linkedin_host");
    state = "unknown";
  } else if (authwallSignals) {
    signals.push("authwall_detected");
    state = "authwall";
  } else if (challengeSignals) {
    signals.push("challenge_detected");
    state = "mfa_challenge";
  } else if (hasAuthCookie && hasGlobalNav) {
    signals.push("auth_cookie_and_nav");
    state = "authenticated";
  } else if (hasAuthCookie && /linkedin\.com\/(in|feed|company|school)\//i.test(pathText)) {
    signals.push("auth_cookie_profile_path");
    state = "authenticated";
  } else if (loginSignals) {
    signals.push("login_detected");
    state = "login";
  } else if (hasAuthCookie && host?.includes("linkedin.com")) {
    signals.push("auth_cookie_only");
    state = "authenticated";
  } else {
    signals.push("no_clear_state");
    state = "unknown";
  }

  return {
    timestamp: nowIso(),
    state,
    currentUrl,
    cookieNames,
    signals
  };
};

export const summarizeLinkedinAuthResult = (result: WaitForLinkedinAuthResult): string => {
  const final = result.finalSnapshot;
  return [
    `verified=${result.verified ? "yes" : "no"}`,
    `timedOut=${result.timedOut ? "yes" : "no"}`,
    `state=${final?.state ?? "unknown"}`,
    `url=${final?.currentUrl ?? "unknown"}`,
    `cookies=${final?.cookieNames.length ?? 0}`,
    `transitions=${result.transitions.length}`
  ].join("; ");
};

export const summarizeLinkedinAuthTransitions = (result: WaitForLinkedinAuthResult): string =>
  result.transitions
    .map((snapshot) => `${snapshot.state}@${snapshot.currentUrl ?? "unknown"}`)
    .join(" -> ");

export const waitForLinkedinAuthenticatedSession = async (
  config: SessionConfig,
  input: WaitForLinkedinAuthInput
): Promise<WaitForLinkedinAuthResult> => {
  const settings = resolveAuthWaitSettings({
    timeoutMs: input.timeoutMs,
    pollMs: input.pollMs
  });
  const logPrefix = input.logPrefix ?? "[linkedin-auth]";
  const emitStateLogs = input.emitStateLogs ?? true;

  const openResult = runAgentBrowserJson(["open", input.targetUrl], config, {
    extraArgs: input.headed ? ["--headed"] : [],
    allowFailure: true
  });

  if (emitStateLogs && openResult.response?.success === false) {
    console.warn(`${logPrefix} open warning: ${openResult.response.error ?? "unknown"}`);
  }

  if (emitStateLogs) {
    console.log(
      `${logPrefix} waiting for authenticated session. Multi-factor authentication or challenge steps are optional; flow continues automatically once authenticated is detected.`
    );
  }

  runAgentBrowserJson(["wait", "1000"], config, { allowFailure: true });

  const transitions: LinkedinAuthSnapshot[] = [];
  let signature = "";
  const startedAt = Date.now();

  while (Date.now() - startedAt <= settings.timeoutMs) {
    const snapshot = inspectLinkedinAuthSnapshot(config);
    const nextSignature = `${snapshot.state}|${snapshot.currentUrl ?? ""}`;

    if (nextSignature !== signature) {
      signature = nextSignature;
      transitions.push(snapshot);
      if (emitStateLogs) {
        console.log(
          `${logPrefix} state=${snapshot.state} url=${snapshot.currentUrl ?? "unknown"} signals=${snapshot.signals.join(",")}`
        );
      }
    }

    if (snapshot.state === "authenticated") {
      return {
        verified: true,
        timedOut: false,
        settings,
        transitions,
        finalSnapshot: snapshot
      };
    }

    runAgentBrowserJson(["wait", String(settings.pollMs)], config, {
      allowFailure: true
    });
  }

  const finalSnapshot = inspectLinkedinAuthSnapshot(config);
  const finalSignature = `${finalSnapshot.state}|${finalSnapshot.currentUrl ?? ""}`;
  if (finalSignature !== signature) {
    transitions.push(finalSnapshot);
  }

  if (emitStateLogs) {
    console.warn(
      `${logPrefix} timed out after ${settings.timeoutMs}ms (last state=${finalSnapshot.state}, url=${
        finalSnapshot.currentUrl ?? "unknown"
      }).`
    );
  }

  return {
    verified: finalSnapshot.state === "authenticated",
    timedOut: true,
    settings,
    transitions,
    finalSnapshot
  };
};
