import { Buffer } from "node:buffer";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { runRawCommand } from "../authenticated-extractors/browser-session";
import { loadEmbeddedCode } from "../shared/embedded-code-loader";

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

export interface PublicReferralBrowserSnapshot {
  currentUrl?: string;
  title?: string;
  bodyText?: string;
  candidateTexts?: string[];
}

export interface PublicReferralBrowserCaptureResult {
  ok: boolean;
  artifactPath: string;
  snapshot?: PublicReferralBrowserSnapshot;
  error?: string;
}

export interface CapturePublicReferralTextInput {
  linkId: string;
  sourceUrl: string;
  generatedAt: string;
  browserWaitMs: number;
  headed?: boolean;
  userAgent?: string;
}

export const PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY = path.join(
  "output",
  "playwright",
  "public-rich-sync",
);
export const PUBLIC_REFERRAL_BROWSER_OUTPUT_DIRECTORY = path.join(
  PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY,
  "referral-browser",
);
const PUBLIC_REFERRAL_PROFILE_DIRECTORY = path.join(PUBLIC_RICH_SYNC_OUTPUT_DIRECTORY, "profiles");
const DEFAULT_REFERRAL_BROWSER_WAIT_MS = 8_000;
const REFERRAL_BROWSER_WARMUP_MS = 1_500;
const REFERRAL_BROWSER_TEXT_SNIPPET = loadEmbeddedCode(
  "browser/referral/extract-public-referral-text.js",
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

const safeTrim = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const extractEvalResult = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  if (
    "result" in value &&
    typeof value.result === "object" &&
    value.result !== null &&
    !Array.isArray(value.result)
  ) {
    return value.result as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};

const extractCandidateTexts = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const texts = value
    .map((entry) => safeTrim(entry))
    .filter((entry): entry is string => Boolean(entry));

  return texts.length > 0 ? texts : undefined;
};

const toReferralSnapshot = (
  payload: Record<string, unknown> | null,
): PublicReferralBrowserSnapshot | undefined => {
  if (!payload) {
    return undefined;
  }

  return {
    currentUrl: safeTrim(payload.currentUrl),
    title: safeTrim(payload.title),
    bodyText: safeTrim(payload.bodyText),
    candidateTexts: extractCandidateTexts(payload.candidateTexts),
  };
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

const fileTimestamp = (): string => new Date().toISOString().replaceAll(":", "-");

const writeJsonArtifact = (absoluteArtifactPath: string, payload: unknown): string => {
  fs.mkdirSync(path.dirname(absoluteArtifactPath), { recursive: true });
  fs.writeFileSync(absoluteArtifactPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return absoluteArtifactPath;
};

const buildReferralProfileConfig = (
  input: Pick<CapturePublicReferralTextInput, "linkId" | "headed" | "userAgent">,
): PublicBrowserProfileConfig => ({
  profilePath: path.join(
    process.cwd(),
    PUBLIC_REFERRAL_PROFILE_DIRECTORY,
    `referral-${input.linkId}`,
  ),
  headed: input.headed,
  userAgent: input.userAgent,
});

export const capturePublicReferralTextFromBrowser = (
  input: CapturePublicReferralTextInput,
  dependencies?: {
    runPublicBrowserJsonImpl?: typeof runPublicBrowserJson;
  },
): PublicReferralBrowserCaptureResult => {
  const runPublicBrowserJsonImpl = dependencies?.runPublicBrowserJsonImpl ?? runPublicBrowserJson;
  const config = buildReferralProfileConfig(input);
  fs.mkdirSync(config.profilePath, { recursive: true });

  const artifactRelativePath = path.join(
    PUBLIC_REFERRAL_BROWSER_OUTPUT_DIRECTORY,
    `${input.linkId}-${fileTimestamp()}.json`,
  );
  const artifactAbsolutePath = path.join(process.cwd(), artifactRelativePath);
  let snapshot: PublicReferralBrowserSnapshot | undefined;
  let error: string | undefined;

  try {
    runPublicBrowserJsonImpl(["open", input.sourceUrl], config, {
      allowFailure: true,
    });
    runPublicBrowserJsonImpl(["wait", String(REFERRAL_BROWSER_WARMUP_MS)], config, {
      allowFailure: true,
    });
    runPublicBrowserJsonImpl(
      ["wait", String(Math.max(DEFAULT_REFERRAL_BROWSER_WAIT_MS, input.browserWaitMs))],
      config,
      {
        allowFailure: true,
      },
    );

    const evalResult = runPublicBrowserJsonImpl<unknown>(
      ["eval", "--base64", Buffer.from(REFERRAL_BROWSER_TEXT_SNIPPET, "utf8").toString("base64")],
      config,
      {
        allowFailure: false,
      },
    );

    snapshot = toReferralSnapshot(extractEvalResult(evalResult.response?.data));
    if (!snapshot) {
      error = "Referral public browser capture did not return structured snapshot data.";
    }
  } catch (captureError: unknown) {
    error = captureError instanceof Error ? captureError.message : String(captureError);
  } finally {
    runPublicBrowserJsonImpl(["close"], config, {
      allowFailure: true,
    });
  }

  writeJsonArtifact(artifactAbsolutePath, {
    timestamp: input.generatedAt,
    linkId: input.linkId,
    sourceUrl: input.sourceUrl,
    headed: input.headed ?? false,
    browserWaitMs: input.browserWaitMs,
    profilePath: path.relative(process.cwd(), config.profilePath),
    snapshot: snapshot ?? null,
    ok: !error,
    error: error ?? null,
  });

  return {
    ok: !error,
    artifactPath: artifactRelativePath,
    snapshot,
    error,
  };
};
