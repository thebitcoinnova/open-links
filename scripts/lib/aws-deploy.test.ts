import assert from "node:assert/strict";
import test from "node:test";
import {
  type ResolvedHostedZones,
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
