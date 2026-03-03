import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import process from "node:process";

export const OPENLINKS_AUTH_SESSION_TIMEOUT_ENV = "OPENLINKS_AUTH_SESSION_TIMEOUT_MS";
export const OPENLINKS_AUTH_SESSION_POLL_ENV = "OPENLINKS_AUTH_SESSION_POLL_MS";
export const DEFAULT_AUTH_SESSION_TIMEOUT_MS = 600_000;
export const DEFAULT_AUTH_SESSION_POLL_MS = 2_000;
export const DEFAULT_AUTH_SESSION_NAME = "openlinks-auth-session";
const DUMMY_ENCRYPTION_KEY = "0000000000000000000000000000000000000000000000000000000000000000";

export interface BrowserSessionConfig {
  session: string;
  sessionName: string;
  encryptionKey: string;
}

export interface AuthWaitSettings {
  timeoutMs: number;
  pollMs: number;
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

const parseInteger = (value: string | undefined): number | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

export const resolveAuthWaitOverridesFromArgs = (
  args: string[],
): { timeoutMs?: number; pollMs?: number } => {
  const timeoutMs = parseInteger(valueForFlag(args, "--auth-timeout-ms"));
  const pollMs = parseInteger(valueForFlag(args, "--poll-ms"));

  return {
    timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : undefined,
    pollMs: pollMs && pollMs > 0 ? pollMs : undefined,
  };
};

export const resolveAuthWaitSettings = (input?: {
  timeoutMs?: number;
  pollMs?: number;
}): AuthWaitSettings => {
  const envTimeout = parseInteger(process.env[OPENLINKS_AUTH_SESSION_TIMEOUT_ENV]);
  const envPoll = parseInteger(process.env[OPENLINKS_AUTH_SESSION_POLL_ENV]);

  const timeoutMs = Math.max(
    5_000,
    input?.timeoutMs ?? envTimeout ?? DEFAULT_AUTH_SESSION_TIMEOUT_MS,
  );
  const pollMs = Math.max(250, input?.pollMs ?? envPoll ?? DEFAULT_AUTH_SESSION_POLL_MS);

  return {
    timeoutMs,
    pollMs: Math.min(pollMs, timeoutMs),
  };
};

export const resolveBrowserSessionConfig = (input?: {
  defaultSession?: string;
  requireEncryptionKey?: boolean;
}): BrowserSessionConfig => {
  const defaultSession = input?.defaultSession ?? DEFAULT_AUTH_SESSION_NAME;
  const session = process.env.AGENT_BROWSER_SESSION?.trim() || defaultSession;
  const sessionName = process.env.AGENT_BROWSER_SESSION_NAME?.trim() || session;
  const providedKey = process.env.AGENT_BROWSER_ENCRYPTION_KEY?.trim() ?? "";
  const hasValidKey = /^[a-fA-F0-9]{64}$/.test(providedKey);

  if (input?.requireEncryptionKey && !hasValidKey) {
    throw new Error(
      "AGENT_BROWSER_ENCRYPTION_KEY is required and must be a 64-character hex value for this workflow.",
    );
  }

  return {
    session,
    sessionName,
    encryptionKey: hasValidKey ? providedKey : DUMMY_ENCRYPTION_KEY,
  };
};

export const runRawCommand = (
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    allowFailure?: boolean;
    maxBufferBytes?: number;
  },
): SpawnSyncReturns<string> => {
  const maxBuffer = options?.maxBufferBytes ?? 20 * 1024 * 1024;
  const result = spawnSync(command, args, {
    cwd: options?.cwd ?? process.cwd(),
    env: options?.env ?? process.env,
    encoding: "utf8",
    maxBuffer,
  });

  const failed = result.status !== 0;
  if (failed && !options?.allowFailure) {
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const details = [stderr, stdout].filter((value) => value.length > 0).join("\n");
    throw new Error(
      `Command failed (${command} ${args.join(" ")}): ${details || `exit=${result.status}`}`,
    );
  }

  return result;
};

export const runAgentBrowserJson = <T = unknown>(
  args: string[],
  config: BrowserSessionConfig,
  options?: {
    allowFailure?: boolean;
    extraArgs?: string[];
    cwd?: string;
  },
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
    ...args,
  ];

  const result = runRawCommand("npx", command, {
    allowFailure: true,
    cwd: options?.cwd,
  });

  const parsed = parseJsonMaybe(result.stdout) as AgentBrowserJsonResult<T>["response"];
  const response = parsed;
  const failedByExit = result.status !== 0;
  const failedByPayload = response?.success === false;
  const shouldFail = failedByExit || failedByPayload;

  if (shouldFail && !options?.allowFailure) {
    const payloadError =
      typeof response?.error === "string" && response.error.trim().length > 0
        ? response.error.trim()
        : undefined;
    const stderr = (result.stderr ?? "").trim();
    const stdout = (result.stdout ?? "").trim();
    const details = [payloadError, stderr, stdout]
      .filter((value) => value && value.length > 0)
      .join("\n");
    throw new Error(
      `agent-browser command failed (${args.join(" ")}): ${details || `exit=${result.status}`}`,
    );
  }

  return {
    command,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    response,
  };
};
