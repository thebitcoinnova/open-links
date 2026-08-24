import type * as AwsDeploy from "./aws-deploy-contracts";
import { getAwsTemplatePath } from "./aws-deploy-domain";
import {
  StackOperationError,
  formatFailureEventLines,
  loadRecentStackFailureEvents,
  loadStackState,
  waitForStackOperation,
} from "./aws-deploy-stack";
import { runCommand, runJsonCommand } from "./command";
import { deploymentConfig } from "./effective-deployment-config";

const blockedStackStatuses = new Set([
  "CREATE_FAILED",
  "DELETE_FAILED",
  "DELETE_IN_PROGRESS",
  "IMPORT_ROLLBACK_COMPLETE",
  "IMPORT_ROLLBACK_FAILED",
  "ROLLBACK_COMPLETE",
  "ROLLBACK_FAILED",
  "UPDATE_ROLLBACK_FAILED",
]);

export function buildAwsStackParameters(
  hostedZones: AwsDeploy.ResolvedHostedZones,
  bucketName: string,
) {
  return [
    formatCloudFormationParameter("SiteBucketName", bucketName),
    formatCloudFormationParameter("PrimaryDomain", hostedZones.canonical.domain),
    formatCloudFormationParameter("PrimaryHostedZoneId", hostedZones.canonical.zoneId),
    formatCloudFormationParameter("PriceClass", deploymentConfig.awsPriceClass),
  ];
}

export function createStackChangeSet(
  hostedZones: AwsDeploy.ResolvedHostedZones,
  bucketName: string,
  stackExists: boolean,
) {
  const changeSetType: "CREATE" | "UPDATE" = stackExists ? "UPDATE" : "CREATE";
  const changeSetName = `${deploymentConfig.awsStackName}-${Date.now()}`;
  const parameters = buildAwsStackParameters(hostedZones, bucketName);

  runCommand("aws", [
    "cloudformation",
    "create-change-set",
    "--region",
    deploymentConfig.awsRegion,
    "--stack-name",
    deploymentConfig.awsStackName,
    "--change-set-name",
    changeSetName,
    "--change-set-type",
    changeSetType,
    "--template-body",
    `file://${getAwsTemplatePath()}`,
    "--parameters",
    ...parameters,
    "--output",
    "json",
  ]);

  return {
    changeSetName,
    changeSetType,
  };
}

export function classifyChangeSetPlanRisks(changes: AwsDeploy.ChangeSetPlanChange[]) {
  const blockedRoute53Replacements = changes.flatMap((change) => {
    if (change.resourceType !== "AWS::Route53::RecordSet") {
      return [];
    }

    const shouldBlock =
      change.action === "Remove" ||
      (change.action !== "Add" && !["False", "Never"].includes(change.replacement));

    if (!shouldBlock) {
      return [];
    }

    return [
      {
        ...change,
        reason:
          "Route 53 record replacements are blocked in apply mode because they can collide with already-existing DNS records during create-before-delete updates.",
      } satisfies AwsDeploy.ChangeSetRisk,
    ];
  });

  const blockedCriticalReplacements = changes.flatMap((change) => {
    const criticalLogicalIds = new Set([
      "SiteBucket",
      "SiteDistribution",
      "SiteCertificate",
      "PrimaryDomainARecord",
      "PrimaryDomainAAAARecord",
    ]);

    if (!criticalLogicalIds.has(change.logicalResourceId)) {
      return [];
    }

    const shouldBlock =
      change.action === "Remove" ||
      (change.action !== "Add" && !["False", "Never"].includes(change.replacement));

    if (!shouldBlock) {
      return [];
    }

    return [
      {
        ...change,
        reason:
          "Replacing or removing this live AWS resource is blocked because upstream is expected to reuse the existing production stack without downtime.",
      } satisfies AwsDeploy.ChangeSetRisk,
    ];
  });

  return {
    blockedCriticalReplacements,
    blockedRoute53Replacements,
    hasBlockingRisk:
      blockedRoute53Replacements.length > 0 || blockedCriticalReplacements.length > 0,
  } satisfies AwsDeploy.ChangeSetRiskSummary;
}

export function formatChangeSetRiskMessage(riskSummary: AwsDeploy.ChangeSetRiskSummary) {
  if (!riskSummary.hasBlockingRisk) {
    return "The CloudFormation change set does not contain blocked Route 53 record replacements.";
  }

  return [
    "Blocked CloudFormation change set because it would replace or remove protected live resources:",
    ...riskSummary.blockedCriticalReplacements.map(
      (risk) =>
        `- ${risk.logicalResourceId} (${risk.resourceType}, action=${risk.action}, replacement=${risk.replacement}): ${risk.reason}`,
    ),
    ...riskSummary.blockedRoute53Replacements
      .filter(
        (route53Risk) =>
          !riskSummary.blockedCriticalReplacements.some(
            (criticalRisk) =>
              criticalRisk.logicalResourceId === route53Risk.logicalResourceId &&
              criticalRisk.resourceType === route53Risk.resourceType,
          ),
      )
      .map(
        (risk) =>
          `- ${risk.logicalResourceId} (${risk.resourceType}, action=${risk.action}, replacement=${risk.replacement}): ${risk.reason}`,
      ),
  ].join("\n");
}

export function waitForChangeSet(changeSetName: string, changeSetType: "CREATE" | "UPDATE") {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10 * 60 * 1000) {
    const stackState = loadStackState();
    const stackStatus = stackState.stackStatus ?? "";

    if (
      changeSetType === "CREATE" &&
      stackState.exists &&
      blockedStackStatuses.has(stackStatus) &&
      stackStatus.startsWith("ROLLBACK")
    ) {
      const recentFailureEvents = loadRecentStackFailureEvents();
      throw new Error(
        [
          `Stack ${deploymentConfig.awsStackName} ended in ${stackStatus} while waiting for the create change set to finish.`,
          ...(recentFailureEvents.length > 0
            ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
            : []),
        ].join("\n"),
      );
    }

    const response = runJsonCommand<AwsDeploy.ChangeSetResponse>("aws", [
      "cloudformation",
      "describe-change-set",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      deploymentConfig.awsStackName,
      "--change-set-name",
      changeSetName,
      "--output",
      "json",
    ]);

    const status = response.Status ?? "";
    const statusReason = response.StatusReason ?? "";
    const changes =
      response.Changes?.map((change) => ({
        action: change.ResourceChange?.Action ?? "Unknown",
        logicalResourceId: change.ResourceChange?.LogicalResourceId ?? "Unknown",
        replacement: change.ResourceChange?.Replacement ?? "Unknown",
        resourceType: change.ResourceChange?.ResourceType ?? "Unknown",
      })) ?? [];

    if (status === "CREATE_COMPLETE") {
      return {
        changeSetName,
        changeSetType,
        changes,
        isEmpty: false,
        rawStatus: status,
        rawStatusReason: statusReason,
        riskSummary: classifyChangeSetPlanRisks(changes),
      } satisfies AwsDeploy.ChangeSetPlan;
    }

    if (status === "FAILED") {
      const noChangePatterns = [/didn'?t contain changes/i, /no updates are to be performed/i];
      const isEmpty = noChangePatterns.some((pattern) => pattern.test(statusReason));

      if (!isEmpty) {
        throw new Error(`Change set ${changeSetName} failed: ${statusReason}`);
      }

      return {
        changeSetName,
        changeSetType,
        changes: [],
        isEmpty,
        rawStatus: status,
        rawStatusReason: statusReason,
        riskSummary: classifyChangeSetPlanRisks([]),
      } satisfies AwsDeploy.ChangeSetPlan;
    }

    sleep(5_000);
  }

  throw new Error(`Timed out waiting for change set ${changeSetName}.`);
}

export function executeChangeSet(
  changeSetName: string,
  changeSetType: "CREATE" | "UPDATE",
  options: AwsDeploy.WaitForStackOperationOptions = {},
) {
  runCommand("aws", [
    "cloudformation",
    "execute-change-set",
    "--region",
    deploymentConfig.awsRegion,
    "--stack-name",
    deploymentConfig.awsStackName,
    "--change-set-name",
    changeSetName,
  ]);

  return waitForStackOperation(changeSetType, options);
}

export function deleteChangeSet(changeSetName: string) {
  runCommand(
    "aws",
    [
      "cloudformation",
      "delete-change-set",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      deploymentConfig.awsStackName,
      "--change-set-name",
      changeSetName,
    ],
    { allowFailure: true },
  );
}

function formatCloudFormationParameter(key: string, value: string) {
  return `ParameterKey=${key},ParameterValue=${value}`;
}

function formatDuration(milliseconds: number) {
  const roundedMilliseconds = Math.max(0, Math.round(milliseconds));
  if (roundedMilliseconds < 60_000) {
    return `${Math.round(roundedMilliseconds / 1_000)}s`;
  }

  const wholeMinutes = Math.floor(roundedMilliseconds / 60_000);
  const wholeSeconds = Math.round((roundedMilliseconds % 60_000) / 1_000);
  return wholeSeconds === 0 ? `${wholeMinutes}m` : `${wholeMinutes}m ${wholeSeconds}s`;
}

function sleep(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
