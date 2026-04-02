import { deploymentConfig } from "../../src/lib/deployment-config";
import { ensureAwsCliAvailable, loadAwsCallerIdentity } from "../lib/aws-deploy";
import { runCommand, runJsonCommand } from "../lib/command";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import { type GitHubPagesSiteState, computeDigest, planGitHubPagesSite } from "../lib/deploy-setup";
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

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const commandName = "deploy:setup:github";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "github-setup",
});
const awsEnabled = deploymentConfig.enabledTargets.includes("aws");

await run.addBreadcrumb({
  detail: "Validating GitHub CLI access and loading repository configuration.",
  status: "info",
  step: "initialize",
});

ensureGitHubCliAvailable();
ensureGitHubAuthentication();

const repositorySlug = resolveGitHubRepositorySlug(args.repo);
const productionEnvironment = deploymentConfig.githubProductionEnvironmentName;
const pagesEnvironment = deploymentConfig.githubPagesEnvironmentName;
const maybeRoleArn = awsEnabled ? resolveRoleArn(args["role-arn"]) : null;
const maybeRoleArnDigest = maybeRoleArn ? computeDigest(maybeRoleArn) : null;
const awsDeployVariable = deploymentConfig.githubAwsDeployEnabledVariableName;
const settingsUrls = [
  `https://github.com/${repositorySlug}/settings/environments`,
  `https://github.com/${repositorySlug}/settings/pages`,
  ...(awsEnabled
    ? [
        `https://github.com/${repositorySlug}/settings/secrets/actions`,
        `https://github.com/${repositorySlug}/settings/variables/actions`,
      ]
    : []),
];

await run.addBreadcrumb({
  data: {
    awsEnabled,
    maybeRoleArn,
    maybeRoleArnDigest,
    repositorySlug,
  },
  detail: "Resolved repository slug and deployment topology requirements.",
  status: "passed",
  step: "context",
});

const currentProductionEnvironment = awsEnabled
  ? loadEnvironmentState(repositorySlug, productionEnvironment)
  : null;
const currentPagesEnvironment = loadEnvironmentState(repositorySlug, pagesEnvironment);
const currentPagesSite = loadPagesSiteState(repositorySlug);
const currentDigest =
  awsEnabled && currentProductionEnvironment
    ? loadEnvironmentVariable(
        repositorySlug,
        productionEnvironment,
        deploymentConfig.githubRoleArnDigestVariableName,
      )
    : null;
const currentAwsDeployEnabled = awsEnabled
  ? loadRepoVariable(repositorySlug, awsDeployVariable)
  : null;

const environmentPlans = {
  [pagesEnvironment]: buildEnvironmentPlan(currentPagesEnvironment, pagesEnvironment),
  ...(awsEnabled
    ? {
        [productionEnvironment]: buildEnvironmentPlan(
          currentProductionEnvironment,
          productionEnvironment,
        ),
      }
    : {}),
};
const pagesPlan = planGitHubPagesSite(currentPagesSite);
const secretPlan = buildSecretPlan({
  awsEnabled,
  currentDigest,
  maybeRoleArnDigest,
  productionEnvironment,
});
const awsDeployVariablePlan = buildAwsDeployVariablePlan({
  awsEnabled,
  awsDeployVariable,
  currentAwsDeployEnabled,
});

await run.addBreadcrumb({
  data: {
    awsDeployVariablePlan,
    environmentPlans,
    pagesPlan,
    secretPlan,
  },
  detail: "Computed the GitHub repository setup mutation plan.",
  status: "planned",
  step: "plan",
});

const skippedReasons: string[] = [];
const appliedChanges: string[] = [];
const verificationResults: DeployVerificationResult[] = [
  {
    detail: `Authenticated GitHub CLI access for ${repositorySlug}.`,
    name: "gh auth",
    status: "passed",
  },
];

if (allPlansAreNoOps(environmentPlans, pagesPlan, secretPlan, awsDeployVariablePlan)) {
  skippedReasons.push(
    awsEnabled
      ? "The required GitHub environments, Pages workflow mode, deploy role secret, and AWS opt-in variable already match the desired state."
      : "The github-pages environment and Pages workflow mode already match the desired state.",
  );
  await run.addBreadcrumb({
    detail: "Remote GitHub repository settings already match the desired state.",
    status: "skipped",
    step: "plan",
  });
} else if (mode === "check") {
  skippedReasons.push("Check mode only. No GitHub repository mutations were executed.");
  await run.addBreadcrumb({
    detail: "Check mode prevented GitHub repository mutations.",
    status: "skipped",
    step: "apply",
  });
} else {
  for (const [environmentName, plan] of Object.entries(environmentPlans)) {
    if (plan.action === "create") {
      createEnvironment(repositorySlug, environmentName);
      appliedChanges.push(`Created GitHub environment ${environmentName}.`);
    }
  }

  if (pagesPlan.action === "create") {
    updatePagesSite(repositorySlug, "POST");
    appliedChanges.push("Enabled GitHub Pages with GitHub Actions workflow deployments.");
  } else if (pagesPlan.action === "update") {
    updatePagesSite(repositorySlug, "PUT");
    appliedChanges.push("Updated GitHub Pages to use GitHub Actions workflow deployments.");
  }

  if (secretPlan.action === "set" && maybeRoleArnDigest && maybeRoleArn) {
    setEnvironmentVariable(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnDigestVariableName,
      maybeRoleArnDigest,
    );
    setEnvironmentSecret(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnSecretName,
      maybeRoleArn,
    );
    appliedChanges.push(
      `Updated ${productionEnvironment} environment variable ${deploymentConfig.githubRoleArnDigestVariableName}.`,
    );
    appliedChanges.push(
      `Updated ${productionEnvironment} environment secret ${deploymentConfig.githubRoleArnSecretName}.`,
    );
  }

  if (awsDeployVariablePlan.action === "set") {
    setRepoVariable(repositorySlug, awsDeployVariable, "true");
    appliedChanges.push(`Set repository variable ${awsDeployVariable}=true.`);
  }
}

const finalProductionEnvironment = awsEnabled
  ? loadEnvironmentState(repositorySlug, productionEnvironment)
  : null;
const finalPagesEnvironment = loadEnvironmentState(repositorySlug, pagesEnvironment);
const finalPagesSite = loadPagesSiteState(repositorySlug);
const finalDigest =
  awsEnabled && finalProductionEnvironment
    ? loadEnvironmentVariable(
        repositorySlug,
        productionEnvironment,
        deploymentConfig.githubRoleArnDigestVariableName,
      )
    : null;
const finalAwsDeployEnabled = awsEnabled
  ? loadRepoVariable(repositorySlug, awsDeployVariable)
  : null;

verificationResults.push(
  buildEnvironmentVerificationResult(
    "github-pages environment",
    pagesEnvironment,
    finalPagesEnvironment !== null,
    mode,
  ),
  buildPagesVerificationResult(finalPagesSite, mode),
  ...buildAwsVerificationResults({
    awsDeployVariable,
    awsEnabled,
    finalAwsDeployEnabled,
    finalDigest,
    finalProductionEnvironment,
    maybeRoleArnDigest,
    mode,
    productionEnvironment,
  }),
);

const summary = {
  appliedChanges,
  artifactDir: undefined,
  artifactHash: undefined,
  command: commandName,
  discoveredRemoteState: {
    awsEnabled,
    currentAwsDeployEnabled,
    currentDigest,
    currentPagesEnvironment,
    currentPagesSite,
    currentProductionEnvironment,
    finalAwsDeployEnabled,
    finalDigest,
    finalPagesEnvironment,
    finalPagesSite,
    finalProductionEnvironment,
    maybeRoleArn,
    maybeRoleArnDigest,
    repositorySlug,
  },
  mode,
  plannedChanges: {
    awsDeployVariablePlan,
    environmentPlans,
    pagesPlan,
    secretPlan,
  },
  resultingUrls: settingsUrls,
  skippedReasons,
  target: "github-setup",
  verificationResults,
};

const { runDirectory } = await writeDeploySummary(summary, { runDirectory: run.runDirectory });

const maybeFailure = verificationResults.find((result) => result.status === "failed");
if (maybeFailure) {
  throw new Error(`${maybeFailure.name} verification failed. See ${runDirectory} for details.`);
}

console.log(`GitHub setup ${mode} complete. Summary: ${runDirectory}`);

function buildEnvironmentPlan(
  currentEnvironment: GitHubEnvironmentResponse | null,
  environmentName: string,
): PlanDecision {
  return currentEnvironment
    ? { action: "none", reason: `${environmentName} already exists.` }
    : { action: "create", reason: `${environmentName} does not exist yet.` };
}

function buildSecretPlan(input: {
  awsEnabled: boolean;
  currentDigest: string | null;
  maybeRoleArnDigest: string | null;
  productionEnvironment: string;
}): PlanDecision {
  if (!input.awsEnabled || !input.maybeRoleArnDigest) {
    return {
      action: "none",
      reason:
        "AWS deploy is disabled by config/deployment.json, so no production secret is required.",
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

function buildAwsDeployVariablePlan(input: {
  awsDeployVariable: string;
  awsEnabled: boolean;
  currentAwsDeployEnabled: string | null;
}): PlanDecision {
  if (!input.awsEnabled) {
    return {
      action: "none",
      reason:
        "AWS deploy is disabled by config/deployment.json, so no repository variable is required.",
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

function buildAwsVerificationResults(input: {
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
        detail: "AWS deploy is disabled by config/deployment.json.",
        name: "production environment",
        status: "skipped" as const,
      },
      {
        detail:
          "AWS deploy is disabled by config/deployment.json, so no deploy role secret is required.",
        name: "deploy role secret digest",
        status: "skipped" as const,
      },
      {
        detail:
          "AWS deploy is disabled by config/deployment.json, so no opt-in variable is required.",
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

function allPlansAreNoOps(
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

function ensureGitHubCliAvailable() {
  runCommand("gh", ["--version"]);
}

function ensureGitHubAuthentication() {
  runCommand("gh", ["auth", "status"]);
}

function resolveRoleArn(maybeRoleArn: string | undefined) {
  if (maybeRoleArn) {
    return maybeRoleArn;
  }

  if (process.env.AWS_DEPLOY_ROLE_ARN) {
    return process.env.AWS_DEPLOY_ROLE_ARN;
  }

  ensureAwsCliAvailable();
  const identity = loadAwsCallerIdentity();
  return `arn:aws:iam::${identity.Account}:role/${deploymentConfig.awsDeployRoleName}`;
}

function loadEnvironmentState(repositorySlug: string, environmentName: string) {
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

function createEnvironment(repositorySlug: string, environmentName: string) {
  runGitHubApiJson<GitHubEnvironmentResponse>(
    "PUT",
    `repos/${repositorySlug}/environments/${environmentName}`,
    { wait_timer: 0 },
  );
}

function loadPagesSiteState(repositorySlug: string): GitHubPagesSiteState {
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

function updatePagesSite(repositorySlug: string, method: "POST" | "PUT") {
  runGitHubApiJson<GitHubPagesResponse>(method, `repos/${repositorySlug}/pages`, {
    build_type: "workflow",
  });
}

function loadEnvironmentVariable(
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

function loadRepoVariable(repositorySlug: string, variableName: string) {
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

function setEnvironmentVariable(
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

function setRepoVariable(repositorySlug: string, variableName: string, value: string) {
  runCommand("gh", ["variable", "set", variableName, "--repo", repositorySlug, "--body", value]);
}

function setEnvironmentSecret(
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

function buildEnvironmentVerificationResult(
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

function buildPagesVerificationResult(
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

function buildGitHubApiArgs(
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

function runGitHubApiJson<T>(
  method: "GET" | "POST" | "PUT",
  endpoint: string,
  body?: Record<string, unknown>,
) {
  return runJsonCommand<T>("gh", buildGitHubApiArgs(method, endpoint, body), {
    stdin: body ? JSON.stringify(body) : undefined,
  });
}

function isMissingGitHubResource(stderr: string, stdout: string) {
  return /(http 404|not found)/i.test(`${stderr}\n${stdout}`);
}
