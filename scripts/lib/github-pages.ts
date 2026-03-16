const terminalFailureStatuses = new Set([
  "deployment_failed",
  "deployment_perms_error",
  "deployment_content_failed",
  "deployment_cancelled",
  "deployment_lost",
]);

export interface CreatePagesDeploymentEnv {
  actionsIdTokenRequestToken: string;
  actionsIdTokenRequestUrl: string;
  artifactId: number;
  githubOutput: string;
  githubRepository: string;
  githubSha: string;
  githubToken: string;
}

export interface WaitForPagesDeploymentEnv {
  deploymentId: string;
  githubRepository: string;
  githubToken: string;
}

export type PagesDeploymentPhase = "failure" | "pending" | "success";

export function loadCreatePagesDeploymentEnv(
  env: Record<string, string | undefined>,
): CreatePagesDeploymentEnv {
  return {
    actionsIdTokenRequestToken: getRequiredEnv(env, "ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
    actionsIdTokenRequestUrl: getRequiredEnv(env, "ACTIONS_ID_TOKEN_REQUEST_URL"),
    artifactId: getRequiredIntegerEnv(env, "ARTIFACT_ID"),
    githubOutput: getRequiredEnv(env, "GITHUB_OUTPUT"),
    githubRepository: getRequiredEnv(env, "GITHUB_REPOSITORY"),
    githubSha: getRequiredEnv(env, "GITHUB_SHA"),
    githubToken: getRequiredEnv(env, "GITHUB_TOKEN"),
  };
}

export function loadWaitForPagesDeploymentEnv(
  env: Record<string, string | undefined>,
): WaitForPagesDeploymentEnv {
  return {
    deploymentId: getRequiredEnv(env, "DEPLOYMENT_ID"),
    githubRepository: getRequiredEnv(env, "GITHUB_REPOSITORY"),
    githubToken: getRequiredEnv(env, "GITHUB_TOKEN"),
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
