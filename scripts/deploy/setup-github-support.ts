import { ensureAwsCliAvailable, loadAwsCallerIdentity } from "../lib/aws-deploy";
import { runCommand, runJsonCommand } from "../lib/command";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import {
  type GitHubPagesSiteState,
  type ResolvedAwsDeployRoleArn,
  classifyGitHubSetupAccessFailure,
  computeDigest,
  formatGitHubSetupAccessFailure,
  type planGitHubPagesSite,
  resolveAwsDeployRoleArn,
} from "../lib/deploy-setup";
import { deploymentConfig } from "../lib/effective-deployment-config";
import { resolveGitHubRepositorySlug } from "../lib/github-repository";
import { parseArgs } from "./shared";

interface GitHubEnvironmentResponse {
  html_url?: string;
  id?: number;
  name?: string;
}

interface GitHubPagesResponse {
  build_type?: string;
  html_url?: string;
  source?: {
    branch?: string | null;
    path?: string | null;
  } | null;
}

interface PlanDecision {
  action: "create" | "none" | "set";
  reason: string;
}

type SetupGitHubMode = "apply" | "check" | "check-access";

export function buildEnvironmentPlan(
  currentEnvironment: GitHubEnvironmentResponse | null,
  environmentName: string,
): PlanDecision {
  return currentEnvironment
    ? { action: "none", reason: `${environmentName} already exists.` }
    : { action: "create", reason: `${environmentName} does not exist yet.` };
}

export function buildSecretPlan(input: {
  awsEnabled: boolean;
  currentDigest: string | null;
  maybeRoleArnDigest: string | null;
  productionEnvironment: string;
}): PlanDecision {
  if (!input.awsEnabled || !input.maybeRoleArnDigest) {
    return {
      action: "none",
      reason:
        "AWS deploy is disabled by the effective deployment topology, so no production secret is required.",
    };
  }

  if (input.currentDigest === input.maybeRoleArnDigest) {
    return {
      action: "none",
      reason: "The GitHub environment digest already matches the desired AWS deploy role ARN.",
    };
  }

  return {
    action: "set",
    reason: input.currentDigest
      ? `The stored digest ${input.currentDigest} does not match the desired digest ${input.maybeRoleArnDigest}.`
      : `The ${input.productionEnvironment} environment digest variable is missing.`,
  };
}

export function buildAwsDeployVariablePlan(input: {
  awsDeployVariable: string;
  awsEnabled: boolean;
  currentAwsDeployEnabled: string | null;
}): PlanDecision {
  if (!input.awsEnabled) {
    return {
      action: "none",
      reason:
        "AWS deploy is disabled by the effective deployment topology, so no repository variable is required.",
    };
  }

  return input.currentAwsDeployEnabled === "true"
    ? {
        action: "none",
        reason: `${input.awsDeployVariable} already enables the AWS deploy job.`,
      }
    : {
        action: "set",
        reason: `${input.awsDeployVariable} is missing or not set to true.`,
      };
}

export function buildAwsVerificationResults(input: {
  awsDeployVariable: string;
  awsEnabled: boolean;
  finalAwsDeployEnabled: string | null;
  finalDigest: string | null;
  finalProductionEnvironment: GitHubEnvironmentResponse | null;
  maybeRoleArnDigest: string | null;
  mode: "apply" | "check";
  productionEnvironment: string;
}) {
  if (!input.awsEnabled) {
    return [
      {
        detail: "AWS deploy is disabled by the effective deployment topology.",
        name: "production environment",
        status: "skipped" as const,
      },
      {
        detail:
          "AWS deploy is disabled by the effective deployment topology, so no deploy role secret is required.",
        name: "deploy role secret digest",
        status: "skipped" as const,
      },
      {
        detail:
          "AWS deploy is disabled by the effective deployment topology, so no opt-in variable is required.",
        name: "AWS deploy opt-in variable",
        status: "skipped" as const,
      },
    ] satisfies DeployVerificationResult[];
  }

  return [
    buildEnvironmentVerificationResult(
      "production environment",
      input.productionEnvironment,
      input.finalProductionEnvironment !== null,
      input.mode,
    ),
    {
      detail:
        input.finalDigest === input.maybeRoleArnDigest
          ? `${input.productionEnvironment} environment digest ${input.finalDigest} matches the desired deploy role ARN.`
          : `${input.productionEnvironment} environment digest did not match the desired deploy role ARN.`,
      name: "deploy role secret digest",
      status:
        input.finalDigest === input.maybeRoleArnDigest
          ? "passed"
          : input.mode === "check"
            ? "skipped"
            : "failed",
    },
    {
      detail:
        input.finalAwsDeployEnabled === "true"
          ? `${input.awsDeployVariable} is set to true.`
          : `${input.awsDeployVariable} is not set to true.`,
      name: "AWS deploy opt-in variable",
      status:
        input.finalAwsDeployEnabled === "true"
          ? "passed"
          : input.mode === "check"
            ? "skipped"
            : "failed",
    },
  ] satisfies DeployVerificationResult[];
}

export function buildGitHubAdminAccessPreflightResult(input: {
  awsDeployVariable: string;
  awsEnabled: boolean;
  pagesEnvironment: string;
  productionEnvironment: string;
}) {
  const surfaceList = buildGitHubAdminPreflightSurfaces(input);

  return {
    detail: `Repository admin access is sufficient to inspect ${surfaceList.join(", ")}.`,
    name: "GitHub admin access preflight",
    status: "passed" as const,
  };
}

export function buildGitHubAdminPreflightSurfaces(input: {
  awsDeployVariable: string;
  awsEnabled: boolean;
  pagesEnvironment: string;
  productionEnvironment: string;
}) {
  return [
    `${input.pagesEnvironment} environment`,
    "GitHub Pages configuration",
    ...(input.awsEnabled
      ? [
          `${input.productionEnvironment} environment`,
          `${input.productionEnvironment} environment digest variable`,
          `repository variable ${input.awsDeployVariable}`,
        ]
      : []),
  ];
}

export function allPlansAreNoOps(
  environmentPlans: Record<string, PlanDecision>,
  pagesPlan: ReturnType<typeof planGitHubPagesSite>,
  secretPlan: PlanDecision,
  awsDeployVariablePlan: PlanDecision,
) {
  return (
    Object.values(environmentPlans).every((plan) => plan.action === "none") &&
    pagesPlan.action === "none" &&
    secretPlan.action === "none" &&
    awsDeployVariablePlan.action === "none"
  );
}

export function ensureGitHubCliAvailable() {
  runCommand("gh", ["--version"]);
}

export function ensureGitHubAuthentication() {
  runCommand("gh", ["auth", "status"]);
}

export function resolveSetupGitHubMode(args: Record<string, string>): SetupGitHubMode {
  if (args["check-access"] === "true") {
    return "check-access";
  }

  return args.apply === "true" ? "apply" : "check";
}

export function loadAwsDeployIdentity() {
  ensureAwsCliAvailable();
  return loadAwsCallerIdentity();
}

export function buildAwsRoleVerificationResults(
  awsEnabled: boolean,
  maybeResolvedRoleArn: ResolvedAwsDeployRoleArn | null,
) {
  if (!awsEnabled || !maybeResolvedRoleArn) {
    return [] satisfies DeployVerificationResult[];
  }

  const detailPrefix =
    maybeResolvedRoleArn.source === "explicit-override"
      ? `Using explicit --role-arn override ${maybeResolvedRoleArn.resolvedRoleArn}. Config-derived role ARN is ${maybeResolvedRoleArn.configDerivedRoleArn}.`
      : `Using config-derived deploy role ARN ${maybeResolvedRoleArn.resolvedRoleArn}.`;
  const detail = `${detailPrefix} Expected role name ${deploymentConfig.awsDeployRoleName}; expected policy name ${deploymentConfig.awsDeployPolicyName}.`;

  return [
    {
      detail: maybeResolvedRoleArn.mismatchDetail ?? detail,
      name: "AWS deploy role identity",
      status: maybeResolvedRoleArn.mismatchDetail ? "failed" : "passed",
    },
  ] satisfies DeployVerificationResult[];
}

export function loadEnvironmentState(repositorySlug: string, environmentName: string) {
  const result = runCommand(
    "gh",
    buildGitHubApiArgs("GET", `repos/${repositorySlug}/environments/${environmentName}`),
    {
      allowFailure: true,
    },
  );

  if (result.status !== 0) {
    if (isMissingGitHubResource(result.stderr, result.stdout)) {
      return null;
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to inspect environment ${environmentName}.`,
    );
  }

  return JSON.parse(result.stdout) as GitHubEnvironmentResponse;
}

export function readGitHubSetupSurface<T>(
  repositorySlug: string,
  settingsUrls: string[],
  surface: string,
  read: () => T,
) {
  try {
    return read();
  } catch (error) {
    const errorDetail = error instanceof Error ? error.message : String(error);
    const maybeFailure = classifyGitHubSetupAccessFailure({
      errorMessage: errorDetail,
      repositorySlug,
      settingsUrls,
      surface,
    });

    if (maybeFailure) {
      throw new Error(formatGitHubSetupAccessFailure(maybeFailure));
    }

    throw error;
  }
}

export function createEnvironment(repositorySlug: string, environmentName: string) {
  runGitHubApiJson<GitHubEnvironmentResponse>(
    "PUT",
    `repos/${repositorySlug}/environments/${environmentName}`,
    { wait_timer: 0 },
  );
}

export function loadPagesSiteState(repositorySlug: string): GitHubPagesSiteState {
  const result = runCommand("gh", buildGitHubApiArgs("GET", `repos/${repositorySlug}/pages`), {
    allowFailure: true,
  });

  if (result.status !== 0) {
    if (isMissingGitHubResource(result.stderr, result.stdout)) {
      return {
        buildType: null,
        exists: false,
      };
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to inspect GitHub Pages for ${repositorySlug}.`,
    );
  }

  const response = JSON.parse(result.stdout) as GitHubPagesResponse;
  return {
    buildType: response.build_type ?? null,
    exists: true,
    htmlUrl: response.html_url,
    sourceBranch: response.source?.branch ?? null,
    sourcePath: response.source?.path ?? null,
  };
}

export function updatePagesSite(repositorySlug: string, method: "POST" | "PUT") {
  runGitHubApiJson<GitHubPagesResponse>(method, `repos/${repositorySlug}/pages`, {
    build_type: "workflow",
  });
}

export function loadEnvironmentVariable(
  repositorySlug: string,
  environmentName: string,
  variableName: string,
) {
  const response = runJsonCommand<Array<{ name: string; value?: string }>>("gh", [
    "variable",
    "list",
    "--repo",
    repositorySlug,
    "--env",
    environmentName,
    "--json",
    "name,value",
  ]);

  return response.find((variable) => variable.name === variableName)?.value ?? null;
}

export function loadRepoVariable(repositorySlug: string, variableName: string) {
  const response = runJsonCommand<Array<{ name: string; value?: string }>>("gh", [
    "variable",
    "list",
    "--repo",
    repositorySlug,
    "--json",
    "name,value",
  ]);

  return response.find((variable) => variable.name === variableName)?.value ?? null;
}

export function setEnvironmentVariable(
  repositorySlug: string,
  environmentName: string,
  variableName: string,
  value: string,
) {
  runCommand("gh", [
    "variable",
    "set",
    variableName,
    "--repo",
    repositorySlug,
    "--env",
    environmentName,
    "--body",
    value,
  ]);
}

export function setRepoVariable(repositorySlug: string, variableName: string, value: string) {
  runCommand("gh", ["variable", "set", variableName, "--repo", repositorySlug, "--body", value]);
}

export function setEnvironmentSecret(
  repositorySlug: string,
  environmentName: string,
  secretName: string,
  value: string,
) {
  runCommand("gh", [
    "secret",
    "set",
    secretName,
    "--repo",
    repositorySlug,
    "--env",
    environmentName,
    "--body",
    value,
  ]);
}

export function buildEnvironmentVerificationResult(
  name: string,
  environmentName: string,
  exists: boolean,
  mode: "apply" | "check",
): DeployVerificationResult {
  return {
    detail: exists ? `${environmentName} exists.` : `${environmentName} does not exist yet.`,
    name,
    status: exists ? "passed" : mode === "check" ? "skipped" : "failed",
  };
}

export function buildPagesVerificationResult(
  state: GitHubPagesSiteState,
  mode: "apply" | "check",
): DeployVerificationResult {
  const configured = state.exists && state.buildType === "workflow";

  return {
    detail: configured
      ? "GitHub Pages is enabled with build_type=workflow."
      : state.exists
        ? `GitHub Pages exists but is configured with build_type=${state.buildType ?? "unknown"}.`
        : "GitHub Pages is not enabled yet.",
    name: "GitHub Pages workflow mode",
    status: configured ? "passed" : mode === "check" ? "skipped" : "failed",
  };
}

export function buildGitHubApiArgs(
  method: "GET" | "POST" | "PUT",
  endpoint: string,
  body?: Record<string, unknown>,
) {
  const args = [
    "api",
    "--method",
    method,
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    `X-GitHub-Api-Version: ${deploymentConfig.githubApiVersion}`,
    endpoint,
  ];

  if (body) {
    args.push("-H", "Content-Type: application/json");
    args.push("--input", "-");
  }

  return args;
}

export function runGitHubApiJson<T>(
  method: "GET" | "POST" | "PUT",
  endpoint: string,
  body?: Record<string, unknown>,
) {
  return runJsonCommand<T>("gh", buildGitHubApiArgs(method, endpoint, body), {
    stdin: body ? JSON.stringify(body) : undefined,
  });
}

export function isMissingGitHubResource(stderr: string, stdout: string) {
  return /(http 404|not found)/i.test(`${stderr}\n${stdout}`);
}
