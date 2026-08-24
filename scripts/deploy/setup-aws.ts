import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assessAwsDomainReadiness,
  buildSiteBucketName,
  ensureAwsCliAvailable,
  formatDomainReadinessMessage,
  loadAwsCallerIdentity,
  resolveHostedZones,
} from "../lib/aws-deploy";
import { runCommand, runJsonCommand } from "../lib/command";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import {
  buildAwsDeployPolicy,
  buildGithubOidcTrustPolicy,
  githubOidcThumbprint,
  normalizePolicyDocument,
} from "../lib/deploy-setup";
import { deploymentConfig } from "../lib/effective-deployment-config";
import { resolveGitHubRepositorySlug } from "../lib/github-repository";
import { parseArgs } from "./shared";

import {
  allPlansAreNoOps,
  applyAddOidcClientId,
  applyCreateManagedPolicy,
  applyCreateOidcProvider,
  applyCreateRole,
  applyUpdateManagedPolicy,
  applyUpdateRoleTrustPolicy,
  attachManagedPolicy,
  deleteManagedPolicyVersion,
  loadGithubOidcProviderState,
  loadManagedPolicyState,
  loadRoleState,
  planManagedPolicy,
  planOidcProvider,
  planRole,
  planRoleAttachment,
} from "./setup-aws-support";
const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const commandName = "deploy:setup:aws";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "aws-setup",
});

await run.addBreadcrumb({
  detail: "Validating AWS CLI access and collecting repository/AWS context.",
  status: "info",
  step: "initialize",
});

ensureAwsCliAvailable();

const identity = loadAwsCallerIdentity();
const repositorySlug = resolveGitHubRepositorySlug(args.repo);
const siteBucketName = buildSiteBucketName(identity.Account);
const desiredTrustPolicy = buildGithubOidcTrustPolicy(identity.Account, repositorySlug);
const desiredRoleArn = `arn:aws:iam::${identity.Account}:role/${deploymentConfig.awsDeployRoleName}`;
const desiredPolicyArn = `arn:aws:iam::${identity.Account}:policy/${deploymentConfig.awsDeployPolicyName}`;
const domainReadiness = assessAwsDomainReadiness();

await run.addBreadcrumb({
  data: {
    accountId: identity.Account,
    domainReadiness,
    repositorySlug,
    siteBucketName,
  },
  detail: "Resolved account identity, repository slug, and AWS domain readiness state.",
  status: "passed",
  step: "context",
});

if (!domainReadiness.ready) {
  const blockerDetail = formatDomainReadinessMessage(domainReadiness);
  const verificationResults: DeployVerificationResult[] = [
    {
      detail: blockerDetail,
      name: "domain readiness",
      status: mode === "check" ? "skipped" : "failed",
    },
    {
      detail: `Resolved repository slug ${repositorySlug} for the GitHub OIDC trust policy.`,
      name: "repository slug",
      status: "passed",
    },
  ];
  const skippedReasons =
    mode === "check"
      ? [blockerDetail]
      : [
          `Apply mode stopped before IAM/OIDC mutations because ${deploymentConfig.primaryCanonicalDomain} is not fully ready in Route 53 yet.`,
        ];

  await run.addBreadcrumb({
    detail: blockerDetail,
    status: mode === "check" ? "skipped" : "failed",
    step: "domain readiness",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges: [],
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        domainReadiness,
        identity,
        repositorySlug,
        siteBucketName,
      },
      mode,
      plannedChanges: {
        blockedBy: "domain readiness",
      },
      resultingUrls: [],
      skippedReasons,
      target: "aws-setup",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  if (mode === "check") {
    console.log(`AWS setup ${mode} blocked by domain readiness. Summary: ${runDirectory}`);
    process.exit(0);
  }

  throw new Error(
    `AWS setup apply blocked until ${deploymentConfig.primaryCanonicalDomain} is ready. See ${runDirectory}.`,
  );
}

const hostedZones = resolveHostedZones();
const desiredManagedPolicy = buildAwsDeployPolicy(identity.Account, hostedZones);

const currentOidcProvider = loadGithubOidcProviderState();
const currentManagedPolicy = loadManagedPolicyState(desiredPolicyArn);
const currentRoleState = loadRoleState(desiredRoleArn);

const oidcPlan = planOidcProvider(currentOidcProvider);
const managedPolicyPlan = planManagedPolicy(currentManagedPolicy, desiredManagedPolicy);
const rolePlan = planRole(currentRoleState, desiredTrustPolicy);
const attachmentPlan = planRoleAttachment(currentRoleState, desiredPolicyArn);

await run.addBreadcrumb({
  data: {
    attachmentPlan,
    managedPolicyPlan,
    oidcPlan,
    rolePlan,
  },
  detail: "Computed the AWS setup mutation plan.",
  status: "planned",
  step: "plan",
});

const skippedReasons: string[] = [];
const appliedChanges: string[] = [];
const verificationResults: DeployVerificationResult[] = [
  {
    detail: `Resolved the Route 53 hosted zone for ${deploymentConfig.primaryCanonicalDomain}.`,
    name: "hosted zones",
    status: "passed",
  },
  {
    detail: `Resolved repository slug ${repositorySlug} for the GitHub OIDC trust policy.`,
    name: "repository slug",
    status: "passed",
  },
];

if (allPlansAreNoOps(oidcPlan, managedPolicyPlan, rolePlan, attachmentPlan)) {
  skippedReasons.push(
    "The GitHub OIDC provider, deploy role, managed policy, and role attachment already match the desired state.",
  );
  await run.addBreadcrumb({
    detail: "Remote AWS setup already matches the desired state.",
    status: "skipped",
    step: "plan",
  });
} else if (mode === "check") {
  skippedReasons.push("Check mode only. No IAM or OIDC mutations were executed.");
  await run.addBreadcrumb({
    detail: "Check mode prevented IAM and OIDC mutations.",
    status: "skipped",
    step: "apply",
  });
} else {
  if (oidcPlan.action === "create") {
    applyCreateOidcProvider();
    appliedChanges.push(
      `Created the GitHub Actions OIDC provider ${deploymentConfig.awsGithubOidcProviderUrl}.`,
    );
  } else if (oidcPlan.action === "add-client-id") {
    applyAddOidcClientId(oidcPlan.arn, oidcPlan.clientId);
    appliedChanges.push(`Added client ID ${oidcPlan.clientId} to ${oidcPlan.arn}.`);
  }

  if (managedPolicyPlan.action === "create") {
    await applyCreateManagedPolicy(desiredPolicyArn, desiredManagedPolicy);
    appliedChanges.push(`Created managed policy ${desiredPolicyArn}.`);
  } else if (managedPolicyPlan.action === "update-version") {
    if (managedPolicyPlan.deleteVersionId) {
      deleteManagedPolicyVersion(desiredPolicyArn, managedPolicyPlan.deleteVersionId);
      appliedChanges.push(
        `Deleted non-default policy version ${managedPolicyPlan.deleteVersionId} from ${desiredPolicyArn}.`,
      );
    }

    await applyUpdateManagedPolicy(desiredPolicyArn, desiredManagedPolicy);
    appliedChanges.push(`Published a new default version for managed policy ${desiredPolicyArn}.`);
  }

  if (rolePlan.action === "create") {
    await applyCreateRole(desiredTrustPolicy);
    appliedChanges.push(`Created IAM role ${desiredRoleArn}.`);
  } else if (rolePlan.action === "update-trust") {
    await applyUpdateRoleTrustPolicy(desiredTrustPolicy);
    appliedChanges.push(`Updated the trust policy on IAM role ${desiredRoleArn}.`);
  }

  if (attachmentPlan.action === "attach") {
    attachManagedPolicy(desiredPolicyArn);
    appliedChanges.push(`Attached ${desiredPolicyArn} to ${desiredRoleArn}.`);
  }
}

const finalOidcProvider = loadGithubOidcProviderState();
const finalManagedPolicy = loadManagedPolicyState(desiredPolicyArn);
const finalRoleState = loadRoleState(desiredRoleArn);

verificationResults.push(
  {
    detail: finalOidcProvider
      ? `OIDC provider ${finalOidcProvider.arn} includes client ID ${deploymentConfig.awsGithubOidcAudience}.`
      : "GitHub Actions OIDC provider is still missing after the run.",
    name: "OIDC provider",
    status: finalOidcProvider?.clientIds.includes(deploymentConfig.awsGithubOidcAudience)
      ? "passed"
      : mode === "check"
        ? "skipped"
        : "failed",
  },
  {
    detail: finalManagedPolicy
      ? `Managed policy ${desiredPolicyArn} is present with the expected scoped bucket and Route 53 permissions.`
      : "Managed policy is missing after the run.",
    name: "managed policy",
    status:
      finalManagedPolicy &&
      normalizePolicyDocument(finalManagedPolicy.document) ===
        normalizePolicyDocument(desiredManagedPolicy)
        ? "passed"
        : mode === "check"
          ? "skipped"
          : "failed",
  },
  {
    detail: finalRoleState
      ? `IAM role ${desiredRoleArn} is present.`
      : "Deploy IAM role is missing after the run.",
    name: "deploy role",
    status: finalRoleState ? "passed" : mode === "check" ? "skipped" : "failed",
  },
  {
    detail: finalRoleState?.attachedPolicyArns.includes(desiredPolicyArn)
      ? `Managed policy ${desiredPolicyArn} is attached to ${desiredRoleArn}.`
      : `Managed policy ${desiredPolicyArn} is not attached to ${desiredRoleArn}.`,
    name: "role attachment",
    status: finalRoleState?.attachedPolicyArns.includes(desiredPolicyArn)
      ? "passed"
      : mode === "check"
        ? "skipped"
        : "failed",
  },
);

const summary = {
  appliedChanges,
  artifactDir: undefined,
  artifactHash: undefined,
  command: commandName,
  discoveredRemoteState: {
    finalManagedPolicy,
    finalOidcProvider,
    finalRoleState,
    hostedZones,
    identity,
    initialManagedPolicy: currentManagedPolicy,
    initialOidcProvider: currentOidcProvider,
    initialRoleState: currentRoleState,
    repositorySlug,
    siteBucketName,
  },
  mode,
  plannedChanges: {
    attachmentPlan,
    managedPolicyPlan,
    oidcPlan,
    rolePlan,
  },
  resultingUrls: [],
  skippedReasons,
  target: "aws-setup",
  verificationResults,
};

const { runDirectory } = await writeDeploySummary(summary, { runDirectory: run.runDirectory });
console.log(`AWS setup ${mode} complete. Role ARN: ${desiredRoleArn}. Summary: ${runDirectory}`);
