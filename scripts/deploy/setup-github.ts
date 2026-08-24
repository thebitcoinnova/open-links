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
  planGitHubPagesSite,
  resolveAwsDeployRoleArn,
} from "../lib/deploy-setup";
import { deploymentConfig } from "../lib/effective-deployment-config";
import { resolveGitHubRepositorySlug } from "../lib/github-repository";
import { parseArgs } from "./shared";

import {
  allPlansAreNoOps,
  buildAwsDeployVariablePlan,
  buildAwsRoleVerificationResults,
  buildAwsVerificationResults,
  buildEnvironmentPlan,
  buildEnvironmentVerificationResult,
  buildGitHubAdminAccessPreflightResult,
  buildGitHubAdminPreflightSurfaces,
  buildPagesVerificationResult,
  buildSecretPlan,
  createEnvironment,
  ensureGitHubAuthentication,
  ensureGitHubCliAvailable,
  loadAwsDeployIdentity,
  loadEnvironmentState,
  loadEnvironmentVariable,
  loadPagesSiteState,
  loadRepoVariable,
  readGitHubSetupSurface,
  resolveSetupGitHubMode,
  setEnvironmentSecret,
  setEnvironmentVariable,
  setRepoVariable,
  updatePagesSite,
} from "./setup-github-support";
const args = parseArgs(process.argv.slice(2));
const mode = resolveSetupGitHubMode(args);
const runMode: "apply" | "check" = mode === "apply" ? "apply" : "check";
const commandName = "deploy:setup:github";
const run = await createDeployRun({
  command: commandName,
  mode: runMode,
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
const awsIdentity = awsEnabled ? loadAwsDeployIdentity() : null;
const maybeResolvedRoleArn = awsIdentity
  ? resolveAwsDeployRoleArn({
      accountId: awsIdentity.Account,
      maybeAmbientRoleArn: process.env.AWS_DEPLOY_ROLE_ARN,
      maybeExplicitRoleArn: args["role-arn"],
    })
  : null;
const maybeRoleArn = maybeResolvedRoleArn?.resolvedRoleArn ?? null;
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
    awsIdentity,
    awsDeployPolicyName: deploymentConfig.awsDeployPolicyName,
    awsDeployRoleName: deploymentConfig.awsDeployRoleName,
    maybeRoleArn,
    maybeRoleArnDigest,
    maybeResolvedRoleArn,
    repositorySlug,
  },
  detail: "Resolved repository slug and deployment topology requirements.",
  status: "passed",
  step: "context",
});

const verificationResults: DeployVerificationResult[] = [
  {
    detail: `Authenticated GitHub CLI access for ${repositorySlug}.`,
    name: "gh auth",
    status: "passed",
  },
  ...buildAwsRoleVerificationResults(awsEnabled, maybeResolvedRoleArn),
];
const skippedReasons: string[] = [];
const appliedChanges: string[] = [];
const discoveredRemoteState: Record<string, unknown> = {
  awsEnabled,
  awsIdentity,
  awsDeployPolicyName: deploymentConfig.awsDeployPolicyName,
  awsDeployRoleName: deploymentConfig.awsDeployRoleName,
  maybeRoleArn,
  maybeRoleArnDigest,
  maybeResolvedRoleArn,
  repositorySlug,
  settingsUrls,
};
let plannedChanges: unknown = {
  mode,
};

if (maybeResolvedRoleArn?.mismatchDetail) {
  skippedReasons.push(
    "GitHub setup stopped before mutating repository settings because the local role ARN override drifted from the deployment config.",
  );

  await run.addBreadcrumb({
    detail: maybeResolvedRoleArn.mismatchDetail,
    status: "failed",
    step: "context",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges: [],
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState,
      mode: runMode,
      plannedChanges: {
        blockedBy: "ambient role ARN drift",
      },
      resultingUrls: settingsUrls,
      skippedReasons,
      target: "github-setup",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  throw new Error(`${maybeResolvedRoleArn.mismatchDetail} See ${runDirectory} for details.`);
}

try {
  const currentProductionEnvironment = awsEnabled
    ? readGitHubSetupSurface(
        repositorySlug,
        settingsUrls,
        `${productionEnvironment} environment`,
        () => loadEnvironmentState(repositorySlug, productionEnvironment),
      )
    : null;
  const currentPagesEnvironment = readGitHubSetupSurface(
    repositorySlug,
    settingsUrls,
    `${pagesEnvironment} environment`,
    () => loadEnvironmentState(repositorySlug, pagesEnvironment),
  );
  const currentPagesSite = readGitHubSetupSurface(
    repositorySlug,
    settingsUrls,
    "GitHub Pages configuration",
    () => loadPagesSiteState(repositorySlug),
  );
  const currentDigest =
    awsEnabled && currentProductionEnvironment
      ? readGitHubSetupSurface(
          repositorySlug,
          settingsUrls,
          `${productionEnvironment} environment digest variable`,
          () =>
            loadEnvironmentVariable(
              repositorySlug,
              productionEnvironment,
              deploymentConfig.githubRoleArnDigestVariableName,
            ),
        )
      : null;
  const currentAwsDeployEnabled = awsEnabled
    ? readGitHubSetupSurface(
        repositorySlug,
        settingsUrls,
        `repository variable ${awsDeployVariable}`,
        () => loadRepoVariable(repositorySlug, awsDeployVariable),
      )
    : null;

  Object.assign(discoveredRemoteState, {
    currentAwsDeployEnabled,
    currentDigest,
    currentPagesEnvironment,
    currentPagesSite,
    currentProductionEnvironment,
  });

  if (mode === "check-access") {
    plannedChanges = {
      mode,
      requiredSurfaces: buildGitHubAdminPreflightSurfaces({
        awsDeployVariable,
        awsEnabled,
        pagesEnvironment,
        productionEnvironment,
      }),
    };
    skippedReasons.push(
      "GitHub admin preflight only. No GitHub repository mutations were executed.",
    );
    verificationResults.push(
      buildGitHubAdminAccessPreflightResult({
        awsDeployVariable,
        awsEnabled,
        pagesEnvironment,
        productionEnvironment,
      }),
    );

    await run.addBreadcrumb({
      detail: "Verified GitHub admin access for required repository setup surfaces.",
      status: "passed",
      step: "access check",
    });

    const { runDirectory } = await writeDeploySummary(
      {
        appliedChanges,
        artifactDir: undefined,
        artifactHash: undefined,
        command: commandName,
        discoveredRemoteState,
        mode: runMode,
        plannedChanges,
        resultingUrls: settingsUrls,
        skippedReasons,
        target: "github-setup",
        verificationResults,
      },
      { runDirectory: run.runDirectory },
    );

    console.log(`GitHub setup access check complete. Summary: ${runDirectory}`);
    process.exit(0);
  }

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

  plannedChanges = {
    awsDeployVariablePlan,
    environmentPlans,
    mode,
    pagesPlan,
    secretPlan,
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
    ? readGitHubSetupSurface(
        repositorySlug,
        settingsUrls,
        `${productionEnvironment} environment`,
        () => loadEnvironmentState(repositorySlug, productionEnvironment),
      )
    : null;
  const finalPagesEnvironment = readGitHubSetupSurface(
    repositorySlug,
    settingsUrls,
    `${pagesEnvironment} environment`,
    () => loadEnvironmentState(repositorySlug, pagesEnvironment),
  );
  const finalPagesSite = readGitHubSetupSurface(
    repositorySlug,
    settingsUrls,
    "GitHub Pages configuration",
    () => loadPagesSiteState(repositorySlug),
  );
  const finalDigest =
    awsEnabled && finalProductionEnvironment
      ? readGitHubSetupSurface(
          repositorySlug,
          settingsUrls,
          `${productionEnvironment} environment digest variable`,
          () =>
            loadEnvironmentVariable(
              repositorySlug,
              productionEnvironment,
              deploymentConfig.githubRoleArnDigestVariableName,
            ),
        )
      : null;
  const finalAwsDeployEnabled = awsEnabled
    ? readGitHubSetupSurface(
        repositorySlug,
        settingsUrls,
        `repository variable ${awsDeployVariable}`,
        () => loadRepoVariable(repositorySlug, awsDeployVariable),
      )
    : null;

  Object.assign(discoveredRemoteState, {
    finalAwsDeployEnabled,
    finalDigest,
    finalPagesEnvironment,
    finalPagesSite,
    finalProductionEnvironment,
  });

  verificationResults.push(
    buildEnvironmentVerificationResult(
      "github-pages environment",
      pagesEnvironment,
      finalPagesEnvironment !== null,
      runMode,
    ),
    buildPagesVerificationResult(finalPagesSite, runMode),
    ...buildAwsVerificationResults({
      awsDeployVariable,
      awsEnabled,
      finalAwsDeployEnabled,
      finalDigest,
      finalProductionEnvironment,
      maybeRoleArnDigest,
      mode: runMode,
      productionEnvironment,
    }),
  );

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState,
      mode: runMode,
      plannedChanges,
      resultingUrls: settingsUrls,
      skippedReasons,
      target: "github-setup",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  const maybeFailure = verificationResults.find((result) => result.status === "failed");
  if (maybeFailure) {
    console.error(`${maybeFailure.name} verification failed. See ${runDirectory} for details.`);
    process.exit(1);
  }

  console.log(`GitHub setup ${mode} complete. Summary: ${runDirectory}`);
} catch (error) {
  const errorDetail = error instanceof Error ? error.message : String(error);

  await run.addBreadcrumb({
    detail: mode === "check-access" ? "GitHub admin preflight failed." : "GitHub setup failed.",
    status: "failed",
    step: mode === "check-access" ? "access check" : "setup",
  });

  if (mode === "check-access") {
    skippedReasons.push(
      "GitHub admin preflight failed before GitHub repository mutations were applied.",
    );
  } else if (appliedChanges.length === 0) {
    skippedReasons.push("GitHub setup stopped before applying repository mutations.");
  }

  if (!verificationResults.some((result) => result.status === "failed")) {
    verificationResults.push({
      detail: errorDetail,
      name: mode === "check-access" ? "GitHub admin access preflight" : "GitHub setup",
      status: "failed",
    });
  }

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState,
      mode: runMode,
      plannedChanges,
      resultingUrls: settingsUrls,
      skippedReasons,
      target: "github-setup",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  console.error(`${errorDetail}\nSee ${runDirectory}.`);
  process.exit(1);
}
