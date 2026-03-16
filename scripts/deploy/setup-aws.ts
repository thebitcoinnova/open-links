import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deploymentConfig } from "../../src/lib/deployment-config";
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
import { resolveGitHubRepositorySlug } from "../lib/github-repository";
import { parseArgs } from "./shared";

interface OpenIdConnectProviderListResponse {
  OpenIDConnectProviderList?: Array<{
    Arn: string;
  }>;
}

interface OpenIdConnectProviderResponse {
  ClientIDList?: string[];
  ThumbprintList?: string[];
  Url?: string;
}

interface GetPolicyResponse {
  Policy?: {
    Arn: string;
    DefaultVersionId: string;
    PolicyName: string;
  };
}

interface GetPolicyVersionResponse {
  PolicyVersion?: {
    Document?: unknown;
    IsDefaultVersion?: boolean;
    VersionId?: string;
  };
}

interface ListPolicyVersionsResponse {
  Versions?: Array<{
    CreateDate?: string;
    IsDefaultVersion?: boolean;
    VersionId?: string;
  }>;
}

interface GetRoleResponse {
  Role?: {
    Arn: string;
    AssumeRolePolicyDocument?: unknown;
    RoleName: string;
  };
}

interface ListAttachedRolePoliciesResponse {
  AttachedPolicies?: Array<{
    PolicyArn?: string;
    PolicyName?: string;
  }>;
}

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
          "Apply mode stopped before IAM/OIDC mutations because openlinks.us is not fully ready in Route 53 yet.",
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

  throw new Error(`AWS setup apply blocked until openlinks.us is ready. See ${runDirectory}.`);
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
    detail: "Resolved the Route 53 hosted zone for openlinks.us.",
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

function allPlansAreNoOps(
  oidcPlan: ReturnType<typeof planOidcProvider>,
  managedPolicyPlan: ReturnType<typeof planManagedPolicy>,
  rolePlan: ReturnType<typeof planRole>,
  attachmentPlan: ReturnType<typeof planRoleAttachment>,
) {
  return (
    oidcPlan.action === "none" &&
    managedPolicyPlan.action === "none" &&
    rolePlan.action === "none" &&
    attachmentPlan.action === "none"
  );
}

function loadGithubOidcProviderState() {
  const response = runJsonCommand<OpenIdConnectProviderListResponse>("aws", [
    "iam",
    "list-open-id-connect-providers",
    "--output",
    "json",
  ]);
  const providerArn = response.OpenIDConnectProviderList?.map((provider) => provider.Arn).find(
    (arn) => {
      const details = runJsonCommand<OpenIdConnectProviderResponse>("aws", [
        "iam",
        "get-open-id-connect-provider",
        "--open-id-connect-provider-arn",
        arn,
        "--output",
        "json",
      ]);

      return details.Url === deploymentConfig.awsGithubOidcProviderUrl.replace("https://", "");
    },
  );

  if (!providerArn) {
    return null;
  }

  const details = runJsonCommand<OpenIdConnectProviderResponse>("aws", [
    "iam",
    "get-open-id-connect-provider",
    "--open-id-connect-provider-arn",
    providerArn,
    "--output",
    "json",
  ]);

  return {
    arn: providerArn,
    clientIds: [...(details.ClientIDList ?? [])].sort((left, right) => left.localeCompare(right)),
    thumbprints: [...(details.ThumbprintList ?? [])].sort((left, right) =>
      left.localeCompare(right),
    ),
    url: details.Url ?? "",
  };
}

function planOidcProvider(currentState: ReturnType<typeof loadGithubOidcProviderState>) {
  if (!currentState) {
    return {
      action: "create" as const,
      clientId: deploymentConfig.awsGithubOidcAudience,
    };
  }

  if (!currentState.clientIds.includes(deploymentConfig.awsGithubOidcAudience)) {
    return {
      action: "add-client-id" as const,
      arn: currentState.arn,
      clientId: deploymentConfig.awsGithubOidcAudience,
    };
  }

  return {
    action: "none" as const,
  };
}

function applyCreateOidcProvider() {
  runCommand("aws", [
    "iam",
    "create-open-id-connect-provider",
    "--url",
    deploymentConfig.awsGithubOidcProviderUrl,
    "--client-id-list",
    deploymentConfig.awsGithubOidcAudience,
    "--thumbprint-list",
    githubOidcThumbprint,
    "--output",
    "json",
  ]);
}

function applyAddOidcClientId(providerArn: string, clientId: string) {
  runCommand("aws", [
    "iam",
    "add-client-id-to-open-id-connect-provider",
    "--open-id-connect-provider-arn",
    providerArn,
    "--client-id",
    clientId,
  ]);
}

function loadManagedPolicyState(policyArn: string) {
  const policyResult = runCommand(
    "aws",
    ["iam", "get-policy", "--policy-arn", policyArn, "--output", "json"],
    { allowFailure: true },
  );

  if (policyResult.status !== 0) {
    if (!isMissingAwsResource(policyResult.stderr, policyResult.stdout)) {
      throw new Error(
        policyResult.stderr || policyResult.stdout || `Failed to inspect policy ${policyArn}.`,
      );
    }

    return null;
  }

  const response = JSON.parse(policyResult.stdout) as GetPolicyResponse;
  const policy = response.Policy;

  if (!policy) {
    return null;
  }

  const version = runJsonCommand<GetPolicyVersionResponse>("aws", [
    "iam",
    "get-policy-version",
    "--policy-arn",
    policyArn,
    "--version-id",
    policy.DefaultVersionId,
    "--output",
    "json",
  ]);
  const versions = runJsonCommand<ListPolicyVersionsResponse>("aws", [
    "iam",
    "list-policy-versions",
    "--policy-arn",
    policyArn,
    "--output",
    "json",
  ]);

  return {
    arn: policy.Arn,
    defaultVersionId: policy.DefaultVersionId,
    document: version.PolicyVersion?.Document ?? null,
    versions:
      versions.Versions?.map((versionRecord) => ({
        createdAt: versionRecord.CreateDate ?? "",
        isDefault: versionRecord.IsDefaultVersion === true,
        versionId: versionRecord.VersionId ?? "",
      })).sort((left, right) => left.createdAt.localeCompare(right.createdAt)) ?? [],
  };
}

function planManagedPolicy(
  currentState: ReturnType<typeof loadManagedPolicyState>,
  desiredPolicy: ReturnType<typeof buildAwsDeployPolicy>,
) {
  if (!currentState) {
    return {
      action: "create" as const,
    };
  }

  if (normalizePolicyDocument(currentState.document) === normalizePolicyDocument(desiredPolicy)) {
    return {
      action: "none" as const,
    };
  }

  const maybeVersionToDelete =
    currentState.versions.length >= 5
      ? currentState.versions.find(
          (versionRecord) => !versionRecord.isDefault && versionRecord.versionId,
        )
      : undefined;

  return {
    action: "update-version" as const,
    deleteVersionId: maybeVersionToDelete?.versionId,
  };
}

async function applyCreateManagedPolicy(
  policyArn: string,
  policyDocument: ReturnType<typeof buildAwsDeployPolicy>,
) {
  await withTempJsonFile("policy", policyDocument, (filePath) => {
    runCommand("aws", [
      "iam",
      "create-policy",
      "--policy-name",
      deploymentConfig.awsDeployPolicyName,
      "--policy-document",
      `file://${filePath}`,
      "--description",
      "GitHub Actions deploy policy for OpenLinks",
      "--output",
      "json",
    ]);
  });

  const finalState = loadManagedPolicyState(policyArn);
  if (!finalState) {
    throw new Error(`Expected managed policy ${policyArn} to exist after creation.`);
  }
}

async function applyUpdateManagedPolicy(
  policyArn: string,
  policyDocument: ReturnType<typeof buildAwsDeployPolicy>,
) {
  await withTempJsonFile("policy", policyDocument, (filePath) => {
    runCommand("aws", [
      "iam",
      "create-policy-version",
      "--policy-arn",
      policyArn,
      "--policy-document",
      `file://${filePath}`,
      "--set-as-default",
      "--output",
      "json",
    ]);
  });
}

function deleteManagedPolicyVersion(policyArn: string, versionId: string) {
  runCommand("aws", [
    "iam",
    "delete-policy-version",
    "--policy-arn",
    policyArn,
    "--version-id",
    versionId,
  ]);
}

function loadRoleState(roleArn: string) {
  const roleResult = runCommand(
    "aws",
    ["iam", "get-role", "--role-name", deploymentConfig.awsDeployRoleName, "--output", "json"],
    {
      allowFailure: true,
    },
  );

  if (roleResult.status !== 0) {
    if (!isMissingAwsResource(roleResult.stderr, roleResult.stdout)) {
      throw new Error(
        roleResult.stderr ||
          roleResult.stdout ||
          `Failed to inspect role ${deploymentConfig.awsDeployRoleName}.`,
      );
    }

    return null;
  }

  const response = JSON.parse(roleResult.stdout) as GetRoleResponse;
  const attachedPolicies = runJsonCommand<ListAttachedRolePoliciesResponse>("aws", [
    "iam",
    "list-attached-role-policies",
    "--role-name",
    deploymentConfig.awsDeployRoleName,
    "--output",
    "json",
  ]);

  return {
    arn: response.Role?.Arn ?? roleArn,
    attachedPolicyArns:
      attachedPolicies.AttachedPolicies?.map((policy) => policy.PolicyArn)
        .filter((policyArn): policyArn is string => Boolean(policyArn))
        .sort() ?? [],
    assumeRolePolicyDocument: response.Role?.AssumeRolePolicyDocument ?? null,
    roleName: response.Role?.RoleName ?? deploymentConfig.awsDeployRoleName,
  };
}

function planRole(
  currentState: ReturnType<typeof loadRoleState>,
  desiredTrustPolicy: ReturnType<typeof buildGithubOidcTrustPolicy>,
) {
  if (!currentState) {
    return {
      action: "create" as const,
    };
  }

  if (
    normalizePolicyDocument(currentState.assumeRolePolicyDocument) ===
    normalizePolicyDocument(desiredTrustPolicy)
  ) {
    return {
      action: "none" as const,
    };
  }

  return {
    action: "update-trust" as const,
  };
}

async function applyCreateRole(trustPolicy: ReturnType<typeof buildGithubOidcTrustPolicy>) {
  await withTempJsonFile("trust-policy", trustPolicy, (filePath) => {
    runCommand("aws", [
      "iam",
      "create-role",
      "--role-name",
      deploymentConfig.awsDeployRoleName,
      "--assume-role-policy-document",
      `file://${filePath}`,
      "--description",
      "GitHub Actions deployment role for OpenLinks",
      "--output",
      "json",
    ]);
  });
}

async function applyUpdateRoleTrustPolicy(
  trustPolicy: ReturnType<typeof buildGithubOidcTrustPolicy>,
) {
  await withTempJsonFile("trust-policy", trustPolicy, (filePath) => {
    runCommand("aws", [
      "iam",
      "update-assume-role-policy",
      "--role-name",
      deploymentConfig.awsDeployRoleName,
      "--policy-document",
      `file://${filePath}`,
    ]);
  });
}

function planRoleAttachment(
  currentState: ReturnType<typeof loadRoleState>,
  desiredPolicyArn: string,
) {
  if (!currentState || !currentState.attachedPolicyArns.includes(desiredPolicyArn)) {
    return {
      action: "attach" as const,
    };
  }

  return {
    action: "none" as const,
  };
}

function attachManagedPolicy(policyArn: string) {
  runCommand("aws", [
    "iam",
    "attach-role-policy",
    "--role-name",
    deploymentConfig.awsDeployRoleName,
    "--policy-arn",
    policyArn,
  ]);
}

async function withTempJsonFile(
  prefix: string,
  value: unknown,
  callback: (filePath: string) => void | Promise<void>,
) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), `open-links-${prefix}-`));
  const filePath = path.join(tempDirectory, `${prefix}.json`);

  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");

  try {
    await callback(filePath);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
}

function isMissingAwsResource(stderr: string, stdout: string) {
  return /(no such entity|nosuchentity|cannot find|cannot be found|not found|does not exist)/i.test(
    `${stderr}\n${stdout}`,
  );
}
