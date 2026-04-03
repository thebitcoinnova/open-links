import { createHash } from "node:crypto";
import { type ResolvedHostedZones, buildSiteBucketName } from "./aws-deploy";
import { deploymentConfig } from "./effective-deployment-config";

export interface GitHubPagesSiteState {
  buildType: string | null;
  exists: boolean;
  htmlUrl?: string;
  sourceBranch?: string | null;
  sourcePath?: string | null;
}

export interface ResolvedAwsDeployRoleArn {
  configDerivedRoleArn: string;
  mismatchDetail?: string;
  resolvedRoleArn: string;
  source: "config-derived" | "explicit-override";
}

export interface GitHubSetupAccessFailure {
  repositorySlug: string;
  settingsUrls: string[];
  surface: string;
}

export const githubOidcThumbprint = "6938fd4d98bab03faadb97b34396831e3780aea1";
export const awsDeployCloudFormationActions = [
  "cloudformation:CreateChangeSet",
  "cloudformation:DeleteChangeSet",
  "cloudformation:DeleteStack",
  "cloudformation:DescribeChangeSet",
  "cloudformation:DescribeStackEvents",
  "cloudformation:DescribeStacks",
  "cloudformation:ExecuteChangeSet",
  "cloudformation:ListChangeSets",
  "cloudformation:ListStackResources",
  "cloudformation:ValidateTemplate",
] as const;

export function buildGithubOidcTrustPolicy(
  accountId: string,
  repositorySlug: string,
  environmentName = deploymentConfig.githubProductionEnvironmentName,
) {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "GitHubActionsProductionEnvironment",
        Effect: "Allow",
        Principal: {
          Federated: `arn:aws:iam::${accountId}:oidc-provider/${deploymentConfig.awsGithubOidcProviderUrl.replace("https://", "")}`,
        },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": deploymentConfig.awsGithubOidcAudience,
            "token.actions.githubusercontent.com:sub": `repo:${repositorySlug}:environment:${environmentName}`,
          },
        },
      },
    ],
  };
}

export function buildAwsDeployPolicy(accountId: string, hostedZones: ResolvedHostedZones) {
  const bucketName = buildSiteBucketName(accountId);
  const hostedZoneArns = hostedZones.all.map(
    (hostedZone) => `arn:aws:route53:::hostedzone/${hostedZone.zoneId}`,
  );

  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "CloudFormationControlPlane",
        Effect: "Allow",
        Action: [...awsDeployCloudFormationActions],
        Resource: "*",
      },
      {
        Sid: "Route53ZoneDiscovery",
        Effect: "Allow",
        Action: ["route53:ListHostedZonesByName", "route53:GetHostedZone"],
        Resource: "*",
      },
      {
        Sid: "Route53RecordChanges",
        Effect: "Allow",
        Action: ["route53:ChangeResourceRecordSets"],
        Resource: hostedZoneArns,
      },
      {
        Sid: "AcmCertificateManagement",
        Effect: "Allow",
        Action: [
          "acm:AddTagsToCertificate",
          "acm:DeleteCertificate",
          "acm:DescribeCertificate",
          "acm:ListTagsForCertificate",
          "acm:RemoveTagsFromCertificate",
          "acm:RequestCertificate",
        ],
        Resource: `arn:aws:acm:${deploymentConfig.awsRegion}:${accountId}:certificate/*`,
      },
      {
        Sid: "CloudFrontManagement",
        Effect: "Allow",
        Action: [
          "cloudfront:CreateDistribution",
          "cloudfront:CreateFunction",
          "cloudfront:CreateInvalidation",
          "cloudfront:CreateOriginAccessControl",
          "cloudfront:DeleteFunction",
          "cloudfront:DeleteOriginAccessControl",
          "cloudfront:DescribeFunction",
          "cloudfront:GetDistribution",
          "cloudfront:GetDistributionConfig",
          "cloudfront:GetFunction",
          "cloudfront:GetOriginAccessControl",
          "cloudfront:ListFunctions",
          "cloudfront:ListOriginAccessControls",
          "cloudfront:PublishFunction",
          "cloudfront:UpdateDistribution",
          "cloudfront:UpdateFunction",
          "cloudfront:UpdateOriginAccessControl",
        ],
        Resource: "*",
      },
      {
        Sid: "S3BucketManagement",
        Effect: "Allow",
        Action: [
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:GetBucketLocation",
          "s3:GetBucketOwnershipControls",
          "s3:GetBucketPolicy",
          "s3:GetBucketPublicAccessBlock",
          "s3:GetBucketVersioning",
          "s3:ListBucket",
          "s3:PutBucketOwnershipControls",
          "s3:PutBucketPolicy",
          "s3:PutBucketPublicAccessBlock",
          "s3:PutBucketVersioning",
        ],
        Resource: `arn:aws:s3:::${bucketName}`,
      },
      {
        Sid: "S3ObjectManagement",
        Effect: "Allow",
        Action: ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
        Resource: `arn:aws:s3:::${bucketName}/*`,
      },
      {
        Sid: "StsReadIdentity",
        Effect: "Allow",
        Action: ["sts:GetCallerIdentity"],
        Resource: "*",
      },
    ],
  };
}

export function buildAwsDeployRoleArn(accountId: string) {
  return `arn:aws:iam::${accountId}:role/${deploymentConfig.awsDeployRoleName}`;
}

export function classifyGitHubSetupAccessFailure(input: {
  errorMessage: string;
  repositorySlug: string;
  settingsUrls: string[];
  surface: string;
}) {
  const normalizedMessage = input.errorMessage.toLowerCase();
  const isAdminDenied =
    normalizedMessage.includes("http 403") &&
    normalizedMessage.includes("must have admin rights to repository");

  if (!isAdminDenied) {
    return null;
  }

  return {
    repositorySlug: input.repositorySlug,
    settingsUrls: input.settingsUrls,
    surface: input.surface,
  } satisfies GitHubSetupAccessFailure;
}

export function formatGitHubSetupAccessFailure(failure: GitHubSetupAccessFailure) {
  const guidance = [
    `GitHub setup needs repository admin access to inspect ${failure.surface} for ${failure.repositorySlug}.`,
    "Authenticate `gh` as a repository admin and rerun `bun run deploy:setup -- --apply`.",
    "If you only need IAM reconciliation right now, run `bun run deploy:setup:aws -- --apply` and rerun `bun run deploy:setup:github -- --apply` later with repo-admin access.",
  ];

  if (failure.settingsUrls.length === 0) {
    return guidance.join("\n");
  }

  return [...guidance, "Relevant settings:", ...failure.settingsUrls.map((url) => `- ${url}`)].join(
    "\n",
  );
}

export function resolveAwsDeployRoleArn(input: {
  accountId: string;
  maybeAmbientRoleArn?: string;
  maybeExplicitRoleArn?: string;
}): ResolvedAwsDeployRoleArn {
  const configDerivedRoleArn = buildAwsDeployRoleArn(input.accountId);
  const explicitRoleArn = input.maybeExplicitRoleArn?.trim();

  if (explicitRoleArn) {
    return {
      configDerivedRoleArn,
      resolvedRoleArn: explicitRoleArn,
      source: "explicit-override",
    };
  }

  const ambientRoleArn = input.maybeAmbientRoleArn?.trim();
  if (ambientRoleArn && ambientRoleArn !== configDerivedRoleArn) {
    return {
      configDerivedRoleArn,
      mismatchDetail: `Ambient AWS_DEPLOY_ROLE_ARN (${ambientRoleArn}) does not match the config-derived deploy role ARN (${configDerivedRoleArn}). Unset AWS_DEPLOY_ROLE_ARN or pass --role-arn explicitly.`,
      resolvedRoleArn: configDerivedRoleArn,
      source: "config-derived",
    };
  }

  return {
    configDerivedRoleArn,
    resolvedRoleArn: configDerivedRoleArn,
    source: "config-derived",
  };
}

export function computeDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizePolicyDocument(policyDocument: unknown): string {
  let normalizedPolicyDocument = policyDocument;

  if (typeof normalizedPolicyDocument === "string") {
    const maybeDecodedValue = maybeDecodeURIComponent(normalizedPolicyDocument);

    try {
      normalizedPolicyDocument = JSON.parse(maybeDecodedValue);
    } catch {
      normalizedPolicyDocument = maybeDecodedValue;
    }
  }

  return stableJsonStringify(normalizedPolicyDocument);
}

export function planGitHubPagesSite(state: GitHubPagesSiteState) {
  if (!state.exists) {
    return {
      action: "create" as const,
      reason: "GitHub Pages is not enabled for the repository yet.",
    };
  }

  if (state.buildType !== "workflow") {
    return {
      action: "update" as const,
      reason: `GitHub Pages is configured with build_type=${state.buildType ?? "unknown"}.`,
    };
  }

  return {
    action: "none" as const,
    reason: "GitHub Pages is already configured for GitHub Actions workflow deployments.",
  };
}

function maybeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value
      .map((item) => stableJsonStringify(item))
      .sort((left, right) => left.localeCompare(right))
      .join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJsonStringify(item)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}
