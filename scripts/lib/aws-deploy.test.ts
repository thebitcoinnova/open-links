import assert from "node:assert/strict";
import test from "node:test";
import {
  type ResolvedHostedZones,
  assessOrphanedReviewStack,
  assessRecoverableRollbackStack,
  assessStackReadiness,
  buildAwsStackParameters,
  classifyChangeSetPlanRisks,
  waitForStackReadiness,
} from "./aws-deploy";

function createHostedZones(): ResolvedHostedZones {
  return {
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
  };
}

test("buildAwsStackParameters maps the canonical domain and hosted zone", () => {
  // Arrange
  const hostedZones = createHostedZones();

  // Act
  const parameters = buildAwsStackParameters(hostedZones, "open-links-site-123456789012");

  // Assert
  assert.deepEqual(parameters, [
    "ParameterKey=SiteBucketName,ParameterValue=open-links-site-123456789012",
    "ParameterKey=PrimaryDomain,ParameterValue=openlinks.us",
    "ParameterKey=PrimaryHostedZoneId,ParameterValue=ZOPENLINKS",
    "ParameterKey=PriceClass,ParameterValue=PriceClass_100",
  ]);
});

test("assessStackReadiness treats UPDATE_ROLLBACK_COMPLETE as mutable and UPDATE_ROLLBACK_FAILED as blocked", () => {
  // Arrange
  const mutableState = {
    exists: true,
    outputs: {},
    stackStatus: "UPDATE_ROLLBACK_COMPLETE",
  };
  const blockedState = {
    exists: true,
    outputs: {},
    stackStatus: "UPDATE_ROLLBACK_FAILED",
  };
  const failureEvents = [
    {
      logicalResourceId: "PrimaryDomainARecord",
      resourceStatus: "UPDATE_FAILED",
      resourceStatusReason: "already exists",
      resourceType: "AWS::Route53::RecordSet",
      timestamp: "2026-03-16T16:24:41.423Z",
    },
  ];

  // Act
  const mutableAssessment = assessStackReadiness(mutableState);
  const blockedAssessment = assessStackReadiness(blockedState, failureEvents);

  // Assert
  assert.equal(mutableAssessment.state, "ready");
  assert.equal(blockedAssessment.state, "blocked");
  assert.match(blockedAssessment.detail, /Manual CloudFormation recovery is required/u);
  assert.match(blockedAssessment.detail, /PrimaryDomainARecord/u);
});

test("assessStackReadiness keeps ROLLBACK_COMPLETE blocked for explicit bootstrap recovery", () => {
  // Arrange
  const rollbackShellState = {
    exists: true,
    outputs: {},
    stackStatus: "ROLLBACK_COMPLETE",
  };

  // Act
  const assessment = assessStackReadiness(rollbackShellState);

  // Assert
  assert.equal(assessment.state, "blocked");
  assert.match(assessment.detail, /Manual CloudFormation recovery is required/u);
});

test("waitForStackReadiness waits through in-progress states until the stack is mutable", () => {
  // Arrange
  const states = [
    {
      exists: true,
      outputs: {},
      stackStatus: "UPDATE_IN_PROGRESS",
    },
    {
      exists: true,
      outputs: {},
      stackStatus: "UPDATE_COMPLETE",
    },
  ];
  let loadCount = 0;

  // Act
  const assessment = waitForStackReadiness({
    loadCurrentState: () => {
      const state = states[Math.min(loadCount, states.length - 1)];
      loadCount += 1;

      if (!state) {
        throw new Error("Expected a stack state in the test sequence.");
      }

      return state;
    },
    maxWaitMs: 5_000,
    pollIntervalMs: 1,
    sleepFn: () => {},
    stackName: "open-links-site",
  });

  // Assert
  assert.equal(assessment.state, "ready");
  assert.equal(assessment.stackStatus, "UPDATE_COMPLETE");
  assert.equal(loadCount, 2);
});

test("assessOrphanedReviewStack marks an empty REVIEW_IN_PROGRESS shell as recoverable", () => {
  // Arrange
  const stackState = {
    exists: true,
    outputs: {},
    stackStatus: "REVIEW_IN_PROGRESS",
  };

  // Act
  const assessment = assessOrphanedReviewStack(stackState, [], [], "open-links-site");

  // Assert
  assert.equal(assessment.canAutoDelete, true);
  assert.match(assessment.detail, /orphaned CloudFormation shell/u);
});

test("assessOrphanedReviewStack blocks auto-delete when the review stack still has resources", () => {
  // Arrange
  const stackState = {
    exists: true,
    outputs: {},
    stackStatus: "REVIEW_IN_PROGRESS",
  };
  const resources = [
    {
      logicalResourceId: "SiteBucket",
      resourceStatus: "CREATE_COMPLETE",
      resourceType: "AWS::S3::Bucket",
    },
  ];

  // Act
  const assessment = assessOrphanedReviewStack(stackState, [], resources, "open-links-site");

  // Assert
  assert.equal(assessment.canAutoDelete, false);
  assert.match(assessment.detail, /does not qualify for automatic cleanup/u);
  assert.match(assessment.detail, /SiteBucket/u);
});

test("assessRecoverableRollbackStack marks an empty ROLLBACK_COMPLETE shell as recoverable", () => {
  // Arrange
  const stackState = {
    exists: true,
    outputs: {},
    stackStatus: "ROLLBACK_COMPLETE",
  };

  // Act
  const assessment = assessRecoverableRollbackStack(stackState, [], "open-links-site");

  // Assert
  assert.equal(assessment.canAutoDelete, true);
  assert.match(assessment.detail, /safely deleted before retrying bootstrap/u);
});

test("assessRecoverableRollbackStack marks a fully deleted ROLLBACK_FAILED shell as recoverable", () => {
  // Arrange
  const stackState = {
    exists: true,
    outputs: {},
    stackStatus: "ROLLBACK_FAILED",
  };
  const resources = [
    {
      logicalResourceId: "SiteBucket",
      resourceStatus: "DELETE_COMPLETE",
      resourceType: "AWS::S3::Bucket",
    },
  ];

  // Act
  const assessment = assessRecoverableRollbackStack(stackState, resources, "open-links-site");

  // Assert
  assert.equal(assessment.canAutoDelete, true);
  assert.match(assessment.detail, /ROLLBACK_FAILED/u);
});

test("assessRecoverableRollbackStack blocks auto-delete when rollback shell still has live resources", () => {
  // Arrange
  const stackState = {
    exists: true,
    outputs: {},
    stackStatus: "ROLLBACK_COMPLETE",
  };
  const resources = [
    {
      logicalResourceId: "SiteDistribution",
      resourceStatus: "CREATE_COMPLETE",
      resourceType: "AWS::CloudFront::Distribution",
    },
  ];

  // Act
  const assessment = assessRecoverableRollbackStack(stackState, resources, "open-links-site");

  // Assert
  assert.equal(assessment.canAutoDelete, false);
  assert.match(assessment.detail, /does not qualify for automatic rollback-shell cleanup/u);
  assert.match(assessment.detail, /SiteDistribution/u);
});

test("classifyChangeSetPlanRisks blocks replacement of route53 records", () => {
  // Arrange
  const riskSummary = classifyChangeSetPlanRisks([
    {
      action: "Modify",
      logicalResourceId: "PrimaryDomainARecord",
      replacement: "True",
      resourceType: "AWS::Route53::RecordSet",
    },
    {
      action: "Add",
      logicalResourceId: "SiteCertificate",
      replacement: "False",
      resourceType: "AWS::CertificateManager::Certificate",
    },
  ]);

  // Act / Assert
  assert.equal(riskSummary.hasBlockingRisk, true);
  assert.equal(riskSummary.blockedRoute53Replacements.length, 1);
  assert.equal(
    riskSummary.blockedRoute53Replacements[0]?.logicalResourceId,
    "PrimaryDomainARecord",
  );
});
