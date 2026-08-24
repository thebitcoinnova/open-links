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
  type buildAwsDeployPolicy,
  type buildGithubOidcTrustPolicy,
  githubOidcThumbprint,
  normalizePolicyDocument,
} from "../lib/deploy-setup";
import { deploymentConfig } from "../lib/effective-deployment-config";
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

export function allPlansAreNoOps(
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

export function loadGithubOidcProviderState() {
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

export function planOidcProvider(currentState: ReturnType<typeof loadGithubOidcProviderState>) {
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

export function applyCreateOidcProvider() {
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

export function applyAddOidcClientId(providerArn: string, clientId: string) {
  runCommand("aws", [
    "iam",
    "add-client-id-to-open-id-connect-provider",
    "--open-id-connect-provider-arn",
    providerArn,
    "--client-id",
    clientId,
  ]);
}

export function loadManagedPolicyState(policyArn: string) {
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

export function planManagedPolicy(
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

export async function applyCreateManagedPolicy(
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

export async function applyUpdateManagedPolicy(
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

export function deleteManagedPolicyVersion(policyArn: string, versionId: string) {
  runCommand("aws", [
    "iam",
    "delete-policy-version",
    "--policy-arn",
    policyArn,
    "--version-id",
    versionId,
  ]);
}

export function loadRoleState(roleArn: string) {
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

export function planRole(
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

export async function applyCreateRole(trustPolicy: ReturnType<typeof buildGithubOidcTrustPolicy>) {
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

export async function applyUpdateRoleTrustPolicy(
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

export function planRoleAttachment(
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

export function attachManagedPolicy(policyArn: string) {
  runCommand("aws", [
    "iam",
    "attach-role-policy",
    "--role-name",
    deploymentConfig.awsDeployRoleName,
    "--policy-arn",
    policyArn,
  ]);
}

export async function withTempJsonFile(
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

export function isMissingAwsResource(stderr: string, stdout: string) {
  return /(no such entity|nosuchentity|cannot find|cannot be found|not found|does not exist)/i.test(
    `${stderr}\n${stdout}`,
  );
}
