import assert from "node:assert/strict";
import test from "node:test";
import { deploymentConfig } from "../../src/lib/deployment-config";
import { buildDomainReadinessAssessment, formatDomainReadinessMessage } from "./aws-deploy";
import {
  awsDeployCloudFormationActions,
  buildAwsDeployPolicy,
  buildAwsDeployRoleArn,
  buildGithubOidcTrustPolicy,
  classifyGitHubSetupAccessFailure,
  formatGitHubSetupAccessFailure,
  normalizePolicyDocument,
  planGitHubPagesSite,
  resolveAwsDeployRoleArn,
} from "./deploy-setup";
import { parseGitHubRepositorySlug } from "./github-repository";

test("parseGitHubRepositorySlug supports ssh, https, and bare owner/repo formats", () => {
  // Arrange / Act / Assert
  assert.equal(
    parseGitHubRepositorySlug("git@github.com:pRizz/open-links.git"),
    "pRizz/open-links",
  );
  assert.equal(
    parseGitHubRepositorySlug("https://github.com/pRizz/open-links.git"),
    "pRizz/open-links",
  );
  assert.equal(
    parseGitHubRepositorySlug("https://x-access-token:token@github.com/pRizz/open-links.git"),
    "pRizz/open-links",
  );
  assert.equal(parseGitHubRepositorySlug("pRizz/open-links"), "pRizz/open-links");
});

test("parseGitHubRepositorySlug trims valid input and rejects non-GitHub formats", () => {
  // Arrange / Act / Assert
  assert.equal(
    parseGitHubRepositorySlug("  https://github.com/pRizz/open-links.git  "),
    "pRizz/open-links",
  );
  assert.throws(
    () => parseGitHubRepositorySlug("https://example.com/pRizz/open-links.git"),
    /Could not parse a GitHub repository slug/u,
  );
  assert.throws(
    () => parseGitHubRepositorySlug("https://github.com/pRizz/open-links/tree/main"),
    /Could not parse a GitHub repository slug/u,
  );
});

test("buildGithubOidcTrustPolicy scopes the role to the production environment subject", () => {
  // Arrange
  const policy = buildGithubOidcTrustPolicy("123456789012", "pRizz/open-links");

  // Assert
  assert.equal(
    policy.Statement[0]?.Principal.Federated,
    "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
  );
  assert.equal(
    policy.Statement[0]?.Condition.StringEquals["token.actions.githubusercontent.com:sub"],
    "repo:pRizz/open-links:environment:production",
  );
});

test("buildAwsDeployPolicy scopes route53 and s3 resources to the deployment account", () => {
  // Arrange
  const policy = buildAwsDeployPolicy("123456789012", {
    all: [
      {
        domain: "openlinks.us",
        label: "primary canonical host",
        zoneId: "ZOPENLINKS",
      },
    ],
    canonical: {
      domain: "openlinks.us",
      label: "primary canonical host",
      zoneId: "ZOPENLINKS",
    },
  });

  // Act
  const cloudFormationStatement = policy.Statement.find(
    (statement) => statement.Sid === "CloudFormationControlPlane",
  );
  const cloudFrontStatement = policy.Statement.find(
    (statement) => statement.Sid === "CloudFrontManagement",
  );
  const route53Statement = policy.Statement.find(
    (statement) => statement.Sid === "Route53RecordChanges",
  );
  const bucketStatement = policy.Statement.find(
    (statement) => statement.Sid === "S3BucketManagement",
  );
  const s3Statement = policy.Statement.find((statement) => statement.Sid === "S3ObjectManagement");

  // Assert
  assert.deepEqual(cloudFormationStatement?.Action, [...awsDeployCloudFormationActions]);
  assert.ok(cloudFrontStatement?.Action.includes("cloudfront:TagResource"));
  assert.ok(cloudFrontStatement?.Action.includes("cloudfront:UntagResource"));
  assert.deepEqual(route53Statement?.Resource, ["arn:aws:route53:::hostedzone/ZOPENLINKS"]);
  assert.ok(bucketStatement?.Action.includes("s3:DeleteBucket"));
  assert.equal(
    bucketStatement?.Resource,
    `arn:aws:s3:::${deploymentConfig.bucketNamePrefix}-123456789012`,
  );
  assert.equal(
    s3Statement?.Resource,
    `arn:aws:s3:::${deploymentConfig.bucketNamePrefix}-123456789012/*`,
  );
});

test("resolveAwsDeployRoleArn defaults to the config-derived deploy role ARN", () => {
  // Arrange / Act
  const resolvedRoleArn = resolveAwsDeployRoleArn({
    accountId: "123456789012",
  });

  // Assert
  assert.equal(resolvedRoleArn.resolvedRoleArn, buildAwsDeployRoleArn("123456789012"));
  assert.equal(resolvedRoleArn.source, "config-derived");
  assert.equal(resolvedRoleArn.mismatchDetail, undefined);
});

test("resolveAwsDeployRoleArn allows an explicit role ARN override", () => {
  // Arrange
  const explicitRoleArn = "arn:aws:iam::123456789012:role/open-links-fork-github-deploy";

  // Act
  const resolvedRoleArn = resolveAwsDeployRoleArn({
    accountId: "123456789012",
    maybeAmbientRoleArn: "arn:aws:iam::123456789012:role/open-links-github-deploy",
    maybeExplicitRoleArn: explicitRoleArn,
  });

  // Assert
  assert.equal(resolvedRoleArn.resolvedRoleArn, explicitRoleArn);
  assert.equal(resolvedRoleArn.source, "explicit-override");
  assert.equal(resolvedRoleArn.mismatchDetail, undefined);
});

test("resolveAwsDeployRoleArn flags stale ambient role overrides", () => {
  // Arrange / Act
  const resolvedRoleArn = resolveAwsDeployRoleArn({
    accountId: "123456789012",
    maybeAmbientRoleArn: "arn:aws:iam::123456789012:role/open-links-fork-github-deploy",
  });

  // Assert
  assert.equal(resolvedRoleArn.resolvedRoleArn, buildAwsDeployRoleArn("123456789012"));
  assert.equal(resolvedRoleArn.source, "config-derived");
  assert.match(
    resolvedRoleArn.mismatchDetail ?? "",
    /Unset AWS_DEPLOY_ROLE_ARN or pass --role-arn explicitly\./u,
  );
});

test("domain readiness messaging explains missing route53 blockers for pending hosts", () => {
  // Arrange
  const assessment = buildDomainReadinessAssessment([
    {
      blocker:
        "No public Route 53 hosted zone covers openlinks.us. ACM validation and alias records for this host are still blocked until registration, delegation, or hosted-zone setup finishes.",
      domain: "openlinks.us",
      label: "primary canonical host",
      ready: false,
    },
  ]);

  // Act / Assert
  assert.equal(assessment.ready, false);
  assert.equal(assessment.blockers.length, 1);
  assert.match(
    formatDomainReadinessMessage(assessment),
    /AWS domain readiness is still pending for openlinks\.us\./u,
  );
  assert.match(
    formatDomainReadinessMessage(assessment),
    /No public Route 53 hosted zone covers openlinks\.us\./u,
  );
});

test("normalizePolicyDocument treats encoded and unordered json policy documents as equal", () => {
  // Arrange
  const left = normalizePolicyDocument({
    Statement: [
      {
        Action: ["b", "a"],
        Effect: "Allow",
      },
    ],
    Version: "2012-10-17",
  });
  const right = normalizePolicyDocument(
    encodeURIComponent(
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["b", "a"],
          },
        ],
      }),
    ),
  );

  // Act / Assert
  assert.equal(left, right);
});

test("planGitHubPagesSite distinguishes missing, legacy, and workflow configurations", () => {
  // Arrange / Act / Assert
  assert.deepEqual(
    planGitHubPagesSite({
      buildType: null,
      exists: false,
    }),
    {
      action: "create",
      reason: "GitHub Pages is not enabled for the repository yet.",
    },
  );
  assert.deepEqual(
    planGitHubPagesSite({
      buildType: "legacy",
      exists: true,
    }),
    {
      action: "update",
      reason: "GitHub Pages is configured with build_type=legacy.",
    },
  );
  assert.deepEqual(
    planGitHubPagesSite({
      buildType: "workflow",
      exists: true,
    }),
    {
      action: "none",
      reason: "GitHub Pages is already configured for GitHub Actions workflow deployments.",
    },
  );
});

test("classifyGitHubSetupAccessFailure detects repository admin denial responses", () => {
  // Arrange / Act
  const failure = classifyGitHubSetupAccessFailure({
    errorMessage:
      "Command failed (1): gh variable list --repo pRizz/open-links --env production --json name,value\nfailed to get variables: HTTP 403: Must have admin rights to Repository.",
    repositorySlug: "pRizz/open-links",
    settingsUrls: ["https://github.com/pRizz/open-links/settings/environments"],
    surface: "production environment digest variable",
  });

  // Assert
  assert.deepEqual(failure, {
    repositorySlug: "pRizz/open-links",
    settingsUrls: ["https://github.com/pRizz/open-links/settings/environments"],
    surface: "production environment digest variable",
  });
});

test("classifyGitHubSetupAccessFailure ignores missing-resource responses", () => {
  // Arrange / Act / Assert
  assert.equal(
    classifyGitHubSetupAccessFailure({
      errorMessage:
        "Command failed (1): gh api --method GET repos/pRizz/open-links/environments/production\nHTTP 404: Not Found",
      repositorySlug: "pRizz/open-links",
      settingsUrls: [],
      surface: "production environment",
    }),
    null,
  );
});

test("formatGitHubSetupAccessFailure includes repo-admin remediation and aws-only fallback", () => {
  // Arrange
  const message = formatGitHubSetupAccessFailure({
    repositorySlug: "pRizz/open-links",
    settingsUrls: [
      "https://github.com/pRizz/open-links/settings/environments",
      "https://github.com/pRizz/open-links/settings/variables/actions",
    ],
    surface: "production environment digest variable",
  });

  // Act / Assert
  assert.match(message, /repository admin access/u);
  assert.match(message, /deploy:setup -- --apply/u);
  assert.match(message, /deploy:setup:aws -- --apply/u);
  assert.match(message, /deploy:setup:github -- --apply/u);
  assert.match(message, /settings\/environments/u);
  assert.match(message, /settings\/variables\/actions/u);
});
