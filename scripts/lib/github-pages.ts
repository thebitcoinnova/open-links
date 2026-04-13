const terminalFailureStatuses = new Set([
  "deployment_failed",
  "deployment_perms_error",
  "deployment_content_failed",
  "deployment_cancelled",
  "deployment_lost",
]);

const defaultDeploymentTimeoutMs = 10 * 60 * 1000;
const defaultPollIntervalMs = 5 * 1000;
const defaultPublicReadinessTimeoutMs = 10 * 60 * 1000;

export interface CreatePagesDeploymentEnv {
  actionsIdTokenRequestToken: string;
  actionsIdTokenRequestUrl: string;
  artifactId: number;
  githubOutput: string;
  githubRepository: string;
  githubToken: string;
  pagesBuildVersion: string;
}

export interface WaitForPagesDeploymentEnv {
  deploymentId: string;
  githubRepository: string;
  githubToken: string;
  maybeExpectedCommitSha?: string;
  maybeExpectedPublicUrl?: string;
}

export type PagesDeploymentPhase = "failure" | "pending" | "success";

interface JsonResponseResult<T> {
  rawText: string;
  value: T;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface WaitForPagesDeploymentDependencies {
  fetchImpl?: FetchLike;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface WaitForPagesDeploymentOptions extends WaitForPagesDeploymentEnv {
  deploymentTimeoutMs?: number;
  pollIntervalMs?: number;
  publicReadinessTimeoutMs?: number;
}

export function loadCreatePagesDeploymentEnv(
  env: Record<string, string | undefined>,
): CreatePagesDeploymentEnv {
  return {
    actionsIdTokenRequestToken: getRequiredEnv(env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
    actionsIdTokenRequestUrl: getRequiredEnv(env, "ACTIONS_ID_TOKEN_REQUEST_URL"),
    artifactId: getRequiredIntegerEnv(env, "ARTIFACT_ID"),
    githubOutput: getRequiredEnv(env, "GITHUB_OUTPUT"),
    githubRepository: getRequiredEnv(env, "GITHUB_REPOSITORY"),
    githubToken: getRequiredEnv(env, "GITHUB_TOKEN"),
    pagesBuildVersion:
      getOptionalEnv(env, "PAGES_BUILD_VERSION") ?? getRequiredEnv(env, "GITHUB_SHA"),
  };
}

export function loadWaitForPagesDeploymentEnv(
  env: Record<string, string | undefined>,
): WaitForPagesDeploymentEnv {
  return {
    deploymentId: getRequiredEnv(env, "DEPLOYMENT_ID"),
    githubRepository: getRequiredEnv(env, "GITHUB_REPOSITORY"),
    githubToken: getRequiredEnv(env, "GITHUB_TOKEN"),
    maybeExpectedCommitSha: getOptionalEnv(env, "EXPECTED_COMMIT_SHA"),
    maybeExpectedPublicUrl: getOptionalEnv(env, "EXPECTED_PUBLIC_URL"),
  };
}

export function parsePagesDeploymentResponse(response: Record<string, unknown>) {
  const maybePageUrl = typeof response.page_url === "string" ? response.page_url : "";
  const maybeId = response.id;

  if (typeof maybeId === "number" && Number.isFinite(maybeId)) {
    return {
      deploymentId: String(maybeId),
      maybePageUrl,
    };
  }

  if (typeof maybeId === "string" && maybeId.length > 0) {
    return {
      deploymentId: maybeId,
      maybePageUrl,
    };
  }

  const maybeStatusUrl = response.status_url;
  if (typeof maybeStatusUrl === "string" && maybeStatusUrl.length > 0) {
    const maybeDeploymentId = maybeStatusUrl.split("/").filter(Boolean).at(-1);
    if (maybeDeploymentId) {
      return {
        deploymentId: maybeDeploymentId,
        maybePageUrl,
      };
    }
  }

  throw new Error("GitHub Pages deployment response did not include an id or status_url.");
}

export function classifyPagesDeploymentStatus(status: unknown): PagesDeploymentPhase {
  if (status === "succeed") {
    return "success";
  }

  if (typeof status === "string" && terminalFailureStatuses.has(status)) {
    return "failure";
  }

  return "pending";
}

export async function waitForPagesDeployment(
  options: WaitForPagesDeploymentOptions,
  dependencies: WaitForPagesDeploymentDependencies = {},
) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? defaultSleep;
  const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs;

  await waitForDeploymentApiSuccess(
    {
      deploymentId: options.deploymentId,
      githubRepository: options.githubRepository,
      githubToken: options.githubToken,
      maybeExpectedCommitSha: options.maybeExpectedCommitSha,
      maybeExpectedPublicUrl: options.maybeExpectedPublicUrl,
    },
    {
      deploymentTimeoutMs: options.deploymentTimeoutMs ?? defaultDeploymentTimeoutMs,
      fetchImpl,
      now,
      pollIntervalMs,
      sleep,
    },
  );

  const maybeExpectedCommitSha = options.maybeExpectedCommitSha?.trim();
  const maybeExpectedPublicUrl = options.maybeExpectedPublicUrl?.trim();
  if (!maybeExpectedCommitSha || !maybeExpectedPublicUrl) {
    return;
  }

  await waitForPublicCommitReadiness(
    {
      expectedCommitSha: maybeExpectedCommitSha,
      publicUrl: maybeExpectedPublicUrl,
    },
    {
      fetchImpl,
      now,
      pollIntervalMs,
      publicReadinessTimeoutMs: options.publicReadinessTimeoutMs ?? defaultPublicReadinessTimeoutMs,
      sleep,
    },
  );
}

function getRequiredEnv(env: Record<string, string | undefined>, key: string) {
  const maybeValue = env[key];
  if (!maybeValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return maybeValue;
}

function getRequiredIntegerEnv(env: Record<string, string | undefined>, key: string) {
  const rawValue = getRequiredEnv(env, key);
  const maybeParsedValue = Number(rawValue);

  if (!Number.isInteger(maybeParsedValue)) {
    throw new Error(`Expected ${key} to be an integer, received: ${rawValue}`);
  }

  return maybeParsedValue;
}

function getOptionalEnv(env: Record<string, string | undefined>, key: string) {
  const maybeValue = env[key]?.trim();
  return maybeValue ? maybeValue : undefined;
}

async function waitForDeploymentApiSuccess(
  env: WaitForPagesDeploymentEnv,
  options: {
    deploymentTimeoutMs: number;
    fetchImpl: FetchLike;
    now: () => number;
    pollIntervalMs: number;
    sleep: (milliseconds: number) => Promise<void>;
  },
) {
  const deadline = options.now() + options.deploymentTimeoutMs;

  while (true) {
    const { rawText, value: deploymentResponse } = await fetchJson<Record<string, unknown>>(
      `https://api.github.com/repos/${env.githubRepository}/pages/deployments/${env.deploymentId}`,
      {
        headers: {
          Authorization: `Bearer ${env.githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
      "Pages deployment status request",
      options.fetchImpl,
    );

    const phase = classifyPagesDeploymentStatus(deploymentResponse.status);
    if (phase === "success") {
      return;
    }

    if (phase === "failure") {
      throw new Error(`Pages deployment ${env.deploymentId} failed: ${rawText}`);
    }

    if (options.now() >= deadline) {
      throw new Error(
        `Timed out waiting for Pages deployment ${env.deploymentId}. Last response: ${rawText}`,
      );
    }

    await options.sleep(options.pollIntervalMs);
  }
}

async function waitForPublicCommitReadiness(
  options: {
    expectedCommitSha: string;
    publicUrl: string;
  },
  dependencies: {
    fetchImpl: FetchLike;
    now: () => number;
    pollIntervalMs: number;
    publicReadinessTimeoutMs: number;
    sleep: (milliseconds: number) => Promise<void>;
  },
) {
  const publicBuildInfoUrl = buildPublicBuildInfoUrl(options.publicUrl);
  const deadline = dependencies.now() + dependencies.publicReadinessTimeoutMs;
  let maybeLastObservedCommitSha: string | undefined;
  let maybeLastReadinessError = `No successful response received from ${publicBuildInfoUrl}.`;

  while (true) {
    try {
      const { value: buildInfoResponse } = await fetchJson<Record<string, unknown>>(
        publicBuildInfoUrl,
        {
          headers: {
            Accept: "application/json",
          },
        },
        "Pages public build-info request",
        dependencies.fetchImpl,
      );

      const observedCommitSha = parseBuildInfoCommitSha(buildInfoResponse);
      if (observedCommitSha === options.expectedCommitSha) {
        return;
      }

      maybeLastObservedCommitSha = observedCommitSha;
      maybeLastReadinessError = `Expected ${publicBuildInfoUrl} to report commit ${options.expectedCommitSha}, received '${observedCommitSha}'.`;
    } catch (error) {
      maybeLastReadinessError =
        error instanceof Error ? error.message : `Unknown readiness error: ${String(error)}`;
    }

    if (dependencies.now() >= deadline) {
      throw new Error(
        `Timed out waiting for ${publicBuildInfoUrl} to report commit ${options.expectedCommitSha}. Last readiness result: ${maybeLastReadinessError}${maybeLastObservedCommitSha ? ` Last observed commit: '${maybeLastObservedCommitSha}'.` : ""}`,
      );
    }

    await dependencies.sleep(dependencies.pollIntervalMs);
  }
}

function buildPublicBuildInfoUrl(publicUrl: string) {
  const normalizedPublicUrl = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  return new URL("build-info.json", normalizedPublicUrl).toString();
}

function parseBuildInfoCommitSha(response: Record<string, unknown>) {
  const maybeCommitSha = response.commitSha;
  if (typeof maybeCommitSha !== "string" || maybeCommitSha.trim().length === 0) {
    throw new Error("Pages public build-info response did not include a commitSha string.");
  }

  return maybeCommitSha.trim();
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  description: string,
  fetchImpl: FetchLike,
): Promise<JsonResponseResult<T>> {
  const response = await fetchImpl(url, init);
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `${description} failed (${response.status} ${response.statusText}): ${rawText}`,
    );
  }

  try {
    return {
      rawText,
      value: JSON.parse(rawText) as T,
    };
  } catch {
    throw new Error(`${description} returned invalid JSON: ${rawText}`);
  }
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
