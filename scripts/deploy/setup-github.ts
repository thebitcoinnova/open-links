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

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const commandName = "deploy:setup:github";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "github-setup",
});

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
const roleArn = resolveRoleArn(args["role-arn"]);
const roleArnDigest = computeDigest(roleArn);
const awsDeployVariable = deploymentConfig.githubAwsDeployEnabledVariableName;
const settingsUrls = [
  `https://github.com/${repositorySlug}/settings/environments`,
  `https://github.com/${repositorySlug}/settings/pages`,
  `https://github.com/${repositorySlug}/settings/secrets/actions`,
  `https://github.com/${repositorySlug}/settings/variables/actions`,
];

await run.addBreadcrumb({
  data: {
    repositorySlug,
    roleArn,
    roleArnDigest,
  },
  detail: "Resolved repository slug and deploy role ARN.",
  status: "passed",
  step: "context",
});

const currentProductionEnvironment = loadEnvironmentState(repositorySlug, productionEnvironment);
const currentPagesEnvironment = loadEnvironmentState(repositorySlug, pagesEnvironment);
const currentPagesSite = loadPagesSiteState(repositorySlug);
const currentDigest = currentProductionEnvironment
  ? loadEnvironmentVariable(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnDigestVariableName,
    )
  : null;
const currentAwsDeployEnabled = loadRepoVariable(repositorySlug, awsDeployVariable);

const environmentPlans = {
  [productionEnvironment]: currentProductionEnvironment
    ? { action: "none" as const }
    : { action: "create" as const },
  [pagesEnvironment]: currentPagesEnvironment
    ? { action: "none" as const }
    : { action: "create" as const },
};
const pagesPlan = planGitHubPagesSite(currentPagesSite);
const secretPlan =
  currentDigest === roleArnDigest
    ? {
        action: "none" as const,
        reason: "The GitHub environment digest already matches the desired AWS deploy role ARN.",
      }
    : {
        action: "set" as const,
        reason: currentDigest
          ? `The stored digest ${currentDigest} does not match the desired digest ${roleArnDigest}.`
          : "The production environment digest variable is missing.",
      };
const awsDeployVariablePlan =
  currentAwsDeployEnabled === "true"
    ? {
        action: "none" as const,
        reason: `${awsDeployVariable} already enables the AWS deploy job.`,
      }
    : {
        action: "set" as const,
        reason: `${awsDeployVariable} is missing or not set to true.`,
      };

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
    "The production environment, github-pages environment, Pages workflow mode, deploy role secret, and AWS opt-in variable already match the desired state.",
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
  if (environmentPlans[productionEnvironment].action === "create") {
    createEnvironment(repositorySlug, productionEnvironment);
    appliedChanges.push(`Created GitHub environment ${productionEnvironment}.`);
  }

  if (environmentPlans[pagesEnvironment].action === "create") {
    createEnvironment(repositorySlug, pagesEnvironment);
    appliedChanges.push(`Created GitHub environment ${pagesEnvironment}.`);
  }

  if (pagesPlan.action === "create") {
    updatePagesSite(repositorySlug, "POST");
    appliedChanges.push("Enabled GitHub Pages with GitHub Actions workflow deployments.");
  } else if (pagesPlan.action === "update") {
    updatePagesSite(repositorySlug, "PUT");
    appliedChanges.push("Updated GitHub Pages to use GitHub Actions workflow deployments.");
  }

  if (secretPlan.action === "set") {
    setEnvironmentVariable(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnDigestVariableName,
      roleArnDigest,
    );
    setEnvironmentSecret(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnSecretName,
      roleArn,
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

const finalProductionEnvironment = loadEnvironmentState(repositorySlug, productionEnvironment);
const finalPagesEnvironment = loadEnvironmentState(repositorySlug, pagesEnvironment);
const finalPagesSite = loadPagesSiteState(repositorySlug);
const finalDigest = finalProductionEnvironment
  ? loadEnvironmentVariable(
      repositorySlug,
      productionEnvironment,
      deploymentConfig.githubRoleArnDigestVariableName,
    )
  : null;
const finalAwsDeployEnabled = loadRepoVariable(repositorySlug, awsDeployVariable);

verificationResults.push(
  buildEnvironmentVerificationResult(
    "production environment",
    productionEnvironment,
    finalProductionEnvironment !== null,
    mode,
  ),
  buildEnvironmentVerificationResult(
    "github-pages environment",
    pagesEnvironment,
    finalPagesEnvironment !== null,
    mode,
  ),
  buildPagesVerificationResult(finalPagesSite, mode),
  {
    detail:
      finalDigest === roleArnDigest
        ? `${productionEnvironment} environment digest ${finalDigest} matches the desired deploy role ARN.`
        : `${productionEnvironment} environment digest did not match the desired deploy role ARN.`,
    name: "deploy role secret digest",
    status: finalDigest === roleArnDigest ? "passed" : mode === "check" ? "skipped" : "failed",
  },
  {
    detail:
      finalAwsDeployEnabled === "true"
        ? `${awsDeployVariable} is set to true.`
        : `${awsDeployVariable} is not set to true.`,
    name: "AWS deploy opt-in variable",
    status: finalAwsDeployEnabled === "true" ? "passed" : mode === "check" ? "skipped" : "failed",
  },
);

const summary = {
  appliedChanges,
  artifactDir: undefined,
  artifactHash: undefined,
  command: commandName,
  discoveredRemoteState: {
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
    repositorySlug,
    roleArn,
    roleArnDigest,
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

function allPlansAreNoOps(
  environmentPlans: Record<string, { action: "create" | "none" }>,
  pagesPlan: ReturnType<typeof planGitHubPagesSite>,
  secretPlan: { action: "none" | "set"; reason: string },
  awsDeployVariablePlan: { action: "none" | "set"; reason: string },
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
