import assert from "node:assert/strict";
import test from "node:test";
import { buildDomainReadinessAssessment, formatDomainReadinessMessage } from "./aws-deploy";
import {
  buildAwsDeployPolicy,
  buildGithubOidcTrustPolicy,
  normalizePolicyDocument,
  planGitHubPagesSite,
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
  const route53Statement = policy.Statement.find(
    (statement) => statement.Sid === "Route53RecordChanges",
  );
  const s3Statement = policy.Statement.find((statement) => statement.Sid === "S3ObjectManagement");

  // Assert
  assert.deepEqual(route53Statement?.Resource, ["arn:aws:route53:::hostedzone/ZOPENLINKS"]);
  assert.equal(s3Statement?.Resource, "arn:aws:s3:::open-links-site-123456789012/*");
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
    /AWS domain readiness is still pending for the openlinks\.us rollout\./u,
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
