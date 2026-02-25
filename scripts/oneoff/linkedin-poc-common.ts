import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";

export const DEFAULT_LINKEDIN_POC_SESSION = "openlinks-linkedin-poc";
export const LINKEDIN_POC_OUTPUT_DIR = path.join("output", "playwright", "linkedin-poc");

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const nowIso = (): string => new Date().toISOString();

export const fileTimestamp = (): string => nowIso().replaceAll(":", "-");

export const toAbsoluteFromRoot = (...segments: string[]): string => path.join(process.cwd(), ...segments);

export const ensureLinkedinPocOutputDirectory = (): string => {
  const outputDir = toAbsoluteFromRoot(LINKEDIN_POC_OUTPUT_DIR);
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
  const session = process.env.AGENT_BROWSER_SESSION?.trim() || DEFAULT_LINKEDIN_POC_SESSION;
  const sessionName = process.env.AGENT_BROWSER_SESSION_NAME?.trim() || session;
  const encryptionKey = process.env.AGENT_BROWSER_ENCRYPTION_KEY?.trim() ?? "";

  if (!/^[a-fA-F0-9]{64}$/.test(encryptionKey)) {
    throw new Error(
      "AGENT_BROWSER_ENCRYPTION_KEY is required and must be a 64-character hex value for this PoC."
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
  return args[index + 1];
};
