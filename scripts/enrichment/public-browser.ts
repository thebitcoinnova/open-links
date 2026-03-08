import path from "node:path";
import process from "node:process";
import { runRawCommand } from "../authenticated-extractors/browser-session";

export interface PublicBrowserProfileConfig {
  profilePath: string;
  headed?: boolean;
  userAgent?: string;
  browserArgs?: string[];
}

export interface PublicBrowserJsonResult<T = unknown> {
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

export const PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY = path.join(
  "output",
  "playwright",
  "public-rich-sync",
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonMaybe = (stdout: string): PublicBrowserJsonResult["response"] => {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    return parsed as PublicBrowserJsonResult["response"];
  } catch {
    return null;
  }
};

const buildAgentBrowserCommand = (args: string[], config: PublicBrowserProfileConfig): string[] => {
  const command = ["--yes", "agent-browser", "--json", "--profile", config.profilePath];

  if (config.headed) {
    command.push("--headed");
  }

  if (config.userAgent) {
    command.push("--user-agent", config.userAgent);
  }

  if (config.browserArgs && config.browserArgs.length > 0) {
    command.push("--args", config.browserArgs.join(","));
  }

  command.push(...args);
  return command;
};

export const runPublicBrowserJson = <T = unknown>(
  args: string[],
  config: PublicBrowserProfileConfig,
  options?: {
    allowFailure?: boolean;
  },
): PublicBrowserJsonResult<T> => {
  const command = buildAgentBrowserCommand(args, config);
  const result = runRawCommand("npx", command, {
    allowFailure: true,
  });
  const response = parseJsonMaybe(result.stdout) as PublicBrowserJsonResult<T>["response"];
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

export const toAbsolutePublicRichOutputPath = (...segments: string[]): string =>
  path.join(process.cwd(), PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY, ...segments);
