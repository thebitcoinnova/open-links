import type * as AwsDeploy from "./aws-deploy-contracts";
import { runCommand } from "./command";
import { deploymentConfig } from "./effective-deployment-config";

const mutableStackStatuses = new Set([
  "CREATE_COMPLETE",
  "IMPORT_COMPLETE",
  "UPDATE_COMPLETE",
  "UPDATE_ROLLBACK_COMPLETE",
]);

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

export class StackReadinessError extends Error {
  constructor(readonly assessment: AwsDeploy.StackReadinessAssessment) {
    super(formatStackReadinessMessage(assessment));
    this.name = "StackReadinessError";
  }
}

export class StackOperationError extends Error {
  constructor(
    readonly finalStackState: AwsDeploy.AwsStackState,
    readonly recentFailureEvents: AwsDeploy.StackFailureEvent[],
    message: string,
  ) {
    super(message);
    this.name = "StackOperationError";
  }
}

export function loadStackState(
  stackName: string = deploymentConfig.awsStackName,
): AwsDeploy.AwsStackState {
  const result = runCommand(
    "aws",
    [
      "cloudformation",
      "describe-stacks",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      stackName,
      "--output",
      "json",
    ],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    if (isMissingStackResponse(result.stdout, result.stderr)) {
      return {
        exists: false,
        outputs: {},
      };
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to load stack state for ${stackName}.`,
    );
  }

  const response = JSON.parse(result.stdout) as AwsDeploy.DescribeStacksResponse;
  const stack = response.Stacks?.[0];

  if (!stack) {
    return {
      exists: false,
      outputs: {},
    };
  }

  return {
    exists: true,
    outputs: Object.fromEntries(
      (stack.Outputs ?? [])
        .filter(
          (
            output,
          ): output is Required<Pick<AwsDeploy.StackOutputRecord, "OutputKey" | "OutputValue">> =>
            Boolean(output.OutputKey && output.OutputValue),
        )
        .map((output) => [output.OutputKey, output.OutputValue]),
    ),
    stackId: stack.StackId,
    stackName: stack.StackName,
    stackStatus: stack.StackStatus,
  };
}

export function loadRecentStackFailureEvents(
  stackName: string = deploymentConfig.awsStackName,
  maxItems = 10,
) {
  const result = runCommand(
    "aws",
    [
      "cloudformation",
      "describe-stack-events",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      stackName,
      "--max-items",
      String(maxItems),
      "--output",
      "json",
    ],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    if (isMissingStackResponse(result.stdout, result.stderr)) {
      return [];
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to load stack events for ${stackName}.`,
    );
  }

  const response = JSON.parse(result.stdout) as AwsDeploy.DescribeStackEventsResponse;

  return (response.StackEvents ?? [])
    .filter((event) => (event.ResourceStatus ?? "").includes("FAILED"))
    .map((event) => ({
      logicalResourceId: event.LogicalResourceId ?? "Unknown",
      resourceStatus: event.ResourceStatus ?? "UNKNOWN",
      resourceStatusReason: event.ResourceStatusReason,
      resourceType: event.ResourceType ?? "Unknown",
      timestamp: event.Timestamp ?? new Date(0).toISOString(),
    }))
    .slice(0, maxItems);
}

export function loadStackChangeSetSummaries(
  stackName: string = deploymentConfig.awsStackName,
): AwsDeploy.StackChangeSetSummary[] {
  const result = runCommand(
    "aws",
    [
      "cloudformation",
      "list-change-sets",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      stackName,
      "--output",
      "json",
    ],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    if (isMissingStackResponse(result.stdout, result.stderr)) {
      return [];
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to load change sets for ${stackName}.`,
    );
  }

  const response = JSON.parse(result.stdout) as AwsDeploy.ListChangeSetsResponse;
  return (response.Summaries ?? []).flatMap((summary) => {
    if (!summary.ChangeSetName) {
      return [];
    }

    return [
      {
        changeSetName: summary.ChangeSetName,
        executionStatus: summary.ExecutionStatus,
        status: summary.Status,
      } satisfies AwsDeploy.StackChangeSetSummary,
    ];
  });
}

export function loadStackResourceSummaries(
  stackName: string = deploymentConfig.awsStackName,
): AwsDeploy.StackResourceSummary[] {
  const result = runCommand(
    "aws",
    [
      "cloudformation",
      "list-stack-resources",
      "--region",
      deploymentConfig.awsRegion,
      "--stack-name",
      stackName,
      "--output",
      "json",
    ],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    if (isMissingStackResponse(result.stdout, result.stderr)) {
      return [];
    }

    throw new Error(
      result.stderr || result.stdout || `Failed to load stack resources for ${stackName}.`,
    );
  }

  const response = JSON.parse(result.stdout) as AwsDeploy.ListStackResourcesResponse;
  return (response.StackResourceSummaries ?? []).flatMap((resource) => {
    if (!resource.LogicalResourceId || !resource.ResourceType) {
      return [];
    }

    return [
      {
        logicalResourceId: resource.LogicalResourceId,
        resourceStatus: resource.ResourceStatus,
        resourceType: resource.ResourceType,
      } satisfies AwsDeploy.StackResourceSummary,
    ];
  });
}

export function assessOrphanedReviewStack(
  stackState: AwsDeploy.AwsStackState,
  changeSets: AwsDeploy.StackChangeSetSummary[] = [],
  resources: AwsDeploy.StackResourceSummary[] = [],
  stackName: string = deploymentConfig.awsStackName,
) {
  if (!stackState.exists || stackState.stackStatus !== "REVIEW_IN_PROGRESS") {
    return {
      canAutoDelete: false,
      changeSetNames: changeSets.map((changeSet) => changeSet.changeSetName),
      detail: `Stack ${stackName} is not an orphaned REVIEW_IN_PROGRESS shell.`,
      resourceSummaries: resources,
      stackName,
      stackStatus: stackState.stackStatus,
    } satisfies AwsDeploy.OrphanedReviewStackAssessment;
  }

  if (changeSets.length === 0 && resources.length === 0) {
    return {
      canAutoDelete: true,
      changeSetNames: [],
      detail: `Stack ${stackName} is stuck in REVIEW_IN_PROGRESS with no active change sets and no stack resources. This is an orphaned CloudFormation shell that can be safely deleted before retrying bootstrap.`,
      resourceSummaries: [],
      stackName,
      stackStatus: stackState.stackStatus,
    } satisfies AwsDeploy.OrphanedReviewStackAssessment;
  }

  const changeSetDetail =
    changeSets.length > 0
      ? `Active change sets: ${changeSets.map((changeSet) => changeSet.changeSetName).join(", ")}.`
      : "No active change sets were found.";
  const resourceDetail =
    resources.length > 0
      ? `Tracked stack resources: ${resources
          .map((resource) => `${resource.logicalResourceId} (${resource.resourceType})`)
          .join(", ")}.`
      : "No tracked stack resources were found.";

  return {
    canAutoDelete: false,
    changeSetNames: changeSets.map((changeSet) => changeSet.changeSetName),
    detail: `Stack ${stackName} is in REVIEW_IN_PROGRESS but does not qualify for automatic cleanup. ${changeSetDetail} ${resourceDetail}`,
    resourceSummaries: resources,
    stackName,
    stackStatus: stackState.stackStatus,
  } satisfies AwsDeploy.OrphanedReviewStackAssessment;
}

export function assessRecoverableRollbackStack(
  stackState: AwsDeploy.AwsStackState,
  resources: AwsDeploy.StackResourceSummary[] = [],
  stackName: string = deploymentConfig.awsStackName,
) {
  const rollbackTerminalStatuses = new Set(["ROLLBACK_COMPLETE", "ROLLBACK_FAILED"]);

  if (!stackState.exists || !rollbackTerminalStatuses.has(stackState.stackStatus ?? "")) {
    return {
      canAutoDelete: false,
      detail: `Stack ${stackName} is not a terminal rollback shell.`,
      resourceSummaries: resources,
      stackName,
      stackStatus: stackState.stackStatus,
    } satisfies AwsDeploy.RecoverableRollbackStackAssessment;
  }

  const outputKeys = Object.keys(stackState.outputs);
  const remainingResources = resources.filter(
    (resource) => resource.resourceStatus !== "DELETE_COMPLETE",
  );

  if (outputKeys.length === 0 && remainingResources.length === 0) {
    return {
      canAutoDelete: true,
      detail: `Stack ${stackName} is stuck in ${stackState.stackStatus} with no remaining live resources and no outputs. This rollback shell can be safely deleted before retrying bootstrap.`,
      resourceSummaries: resources,
      stackName,
      stackStatus: stackState.stackStatus,
    } satisfies AwsDeploy.RecoverableRollbackStackAssessment;
  }

  const outputDetail =
    outputKeys.length > 0
      ? `Stack outputs still present: ${outputKeys.join(", ")}.`
      : "No stack outputs remain.";
  const resourceDetail =
    remainingResources.length > 0
      ? `Remaining resources not fully deleted: ${remainingResources
          .map(
            (resource) =>
              `${resource.logicalResourceId} (${resource.resourceType}, status=${resource.resourceStatus ?? "UNKNOWN"})`,
          )
          .join(", ")}.`
      : "All tracked resources are already deleted.";

  return {
    canAutoDelete: false,
    detail: `Stack ${stackName} is in ${stackState.stackStatus} but does not qualify for automatic rollback-shell cleanup. ${outputDetail} ${resourceDetail}`,
    resourceSummaries: resources,
    stackName,
    stackStatus: stackState.stackStatus,
  } satisfies AwsDeploy.RecoverableRollbackStackAssessment;
}

export function assessStackReadiness(
  stackState: AwsDeploy.AwsStackState,
  recentFailureEvents: AwsDeploy.StackFailureEvent[] = [],
  stackName: string = deploymentConfig.awsStackName,
) {
  let state: AwsDeploy.StackReadinessState;
  let detail: string;

  if (!stackState.exists) {
    state = "ready";
    detail = `Stack ${stackName} does not exist yet. CloudFormation can create it.`;
  } else if (mutableStackStatuses.has(stackState.stackStatus ?? "")) {
    state = "ready";
    detail = `Stack ${stackName} is currently ${stackState.stackStatus} and can accept a new change set.`;
  } else if (isWaitingStackStatus(stackState.stackStatus)) {
    state = "waiting";
    detail = `Stack ${stackName} is currently ${stackState.stackStatus}. Waiting for the existing CloudFormation rollout to finish before continuing.`;
  } else {
    state = "blocked";
    detail = buildBlockedStackMessage(stackName, stackState.stackStatus, recentFailureEvents);
  }

  return {
    detail,
    exists: stackState.exists,
    recentFailureEvents,
    stackName,
    stackState,
    stackStatus: stackState.stackStatus,
    state,
    waitedMs: 0,
  } satisfies AwsDeploy.StackReadinessAssessment;
}

export function formatStackReadinessMessage(assessment: AwsDeploy.StackReadinessAssessment) {
  return assessment.detail;
}

export function waitForStackReadiness(options: AwsDeploy.WaitForStackReadinessOptions = {}) {
  const stackName = options.stackName ?? deploymentConfig.awsStackName;
  const loadCurrentState = options.loadCurrentState ?? (() => loadStackState(stackName));
  const loadFailureEvents =
    options.loadFailureEvents ?? (() => loadRecentStackFailureEvents(stackName));
  const maxWaitMs = options.maxWaitMs ?? 30 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const sleepFn = options.sleepFn ?? sleep;
  const startedAt = Date.now();
  let stackState = options.initialState ?? loadCurrentState();

  while (true) {
    const assessment = assessStackReadiness(stackState, [], stackName);
    const waitedMs = Date.now() - startedAt;

    if (assessment.state === "ready") {
      return {
        ...assessment,
        waitedMs,
      } satisfies AwsDeploy.StackReadinessAssessment;
    }

    if (assessment.state === "blocked") {
      const failures = stackState.exists ? loadFailureEvents() : [];
      throw new StackReadinessError({
        ...assessStackReadiness(stackState, failures, stackName),
        waitedMs,
      });
    }

    if (waitedMs >= maxWaitMs) {
      const failures = stackState.exists ? loadFailureEvents() : [];
      throw new StackReadinessError({
        ...assessStackReadiness(stackState, failures, stackName),
        detail: [
          `Timed out after ${formatDuration(maxWaitMs)} waiting for stack ${stackName} to leave ${stackState.stackStatus ?? "UNKNOWN"} and become mutable.`,
          ...(failures.length > 0
            ? ["Recent failed stack events:", ...formatFailureEventLines(failures)]
            : []),
        ].join("\n"),
        waitedMs,
      });
    }

    sleepFn(pollIntervalMs);
    stackState = loadCurrentState();
  }
}

export function deleteStack(stackName: string = deploymentConfig.awsStackName) {
  runCommand("aws", [
    "cloudformation",
    "delete-stack",
    "--region",
    deploymentConfig.awsRegion,
    "--stack-name",
    stackName,
  ]);
}

export function waitForStackDeletion(options: AwsDeploy.WaitForStackOperationOptions = {}) {
  const stackName = options.stackName ?? deploymentConfig.awsStackName;
  const loadCurrentState = options.loadCurrentState ?? (() => loadStackState(stackName));
  const loadFailureEvents =
    options.loadFailureEvents ?? (() => loadRecentStackFailureEvents(stackName));
  const maxWaitMs = options.maxWaitMs ?? 30 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const sleepFn = options.sleepFn ?? sleep;
  const startedAt = Date.now();

  while (true) {
    const stackState = loadCurrentState();
    const waitedMs = Date.now() - startedAt;

    if (!stackState.exists) {
      return {
        finalStackState: stackState,
        recentFailureEvents: [],
        waitedMs,
      } satisfies AwsDeploy.StackOperationCompletion;
    }

    const stackStatus = stackState.stackStatus ?? "UNKNOWN";

    if (stackStatus === "DELETE_FAILED") {
      const recentFailureEvents = loadFailureEvents();
      throw new StackOperationError(
        stackState,
        recentFailureEvents,
        [
          `Stack ${stackName} failed to delete and is currently ${stackStatus}.`,
          ...(recentFailureEvents.length > 0
            ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
            : []),
        ].join("\n"),
      );
    }

    if (stackStatus === "DELETE_IN_PROGRESS" || isWaitingStackStatus(stackStatus)) {
      if (waitedMs >= maxWaitMs) {
        const recentFailureEvents = loadFailureEvents();
        throw new StackOperationError(
          stackState,
          recentFailureEvents,
          [
            `Timed out after ${formatDuration(maxWaitMs)} waiting for stack ${stackName} to delete.`,
            `Current stack status: ${stackStatus}.`,
            ...(recentFailureEvents.length > 0
              ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
              : []),
          ].join("\n"),
        );
      }

      sleepFn(pollIntervalMs);
      continue;
    }

    const recentFailureEvents = loadFailureEvents();
    throw new StackOperationError(
      stackState,
      recentFailureEvents,
      [
        `Stack ${stackName} is still present in status ${stackStatus} after a delete request.`,
        ...(recentFailureEvents.length > 0
          ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
          : []),
      ].join("\n"),
    );
  }
}

export function waitForStackOperation(
  changeSetType: "CREATE" | "UPDATE",
  options: AwsDeploy.WaitForStackOperationOptions,
) {
  const stackName = options.stackName ?? deploymentConfig.awsStackName;
  const loadCurrentState = options.loadCurrentState ?? (() => loadStackState(stackName));
  const loadFailureEvents =
    options.loadFailureEvents ?? (() => loadRecentStackFailureEvents(stackName));
  const maxWaitMs = options.maxWaitMs ?? 30 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 10_000;
  const sleepFn = options.sleepFn ?? sleep;
  const startedAt = Date.now();
  const successStatuses = new Set(
    changeSetType === "CREATE" ? ["CREATE_COMPLETE"] : ["UPDATE_COMPLETE"],
  );

  while (true) {
    const stackState = loadCurrentState();
    const waitedMs = Date.now() - startedAt;
    const stackStatus = stackState.stackStatus ?? "UNKNOWN";

    if (successStatuses.has(stackStatus)) {
      return {
        finalStackState: stackState,
        recentFailureEvents: [],
        waitedMs,
      } satisfies AwsDeploy.StackOperationCompletion;
    }

    if (isWaitingStackStatus(stackStatus) || stackStatus === "REVIEW_IN_PROGRESS") {
      if (waitedMs >= maxWaitMs) {
        const recentFailureEvents = stackState.exists ? loadFailureEvents() : [];
        throw new StackOperationError(
          stackState,
          recentFailureEvents,
          [
            `Timed out after ${formatDuration(maxWaitMs)} waiting for stack ${stackName} to finish the ${changeSetType.toLowerCase()} change set.`,
            `Current stack status: ${stackStatus}.`,
            ...(recentFailureEvents.length > 0
              ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
              : []),
          ].join("\n"),
        );
      }

      sleepFn(pollIntervalMs);
      continue;
    }

    const recentFailureEvents = stackState.exists ? loadFailureEvents() : [];

    throw new StackOperationError(
      stackState,
      recentFailureEvents,
      [
        `Stack ${stackName} ended in ${stackStatus} while waiting for the ${changeSetType.toLowerCase()} change set to finish.`,
        ...(recentFailureEvents.length > 0
          ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
          : []),
      ].join("\n"),
    );
  }
}

function isMissingStackResponse(stdout: string, stderr: string) {
  const stackMissingPattern = /does not exist/i;
  return stackMissingPattern.test(stderr) || stackMissingPattern.test(stdout);
}

function isWaitingStackStatus(stackStatus?: string) {
  if (!stackStatus) {
    return false;
  }

  if (blockedStackStatuses.has(stackStatus)) {
    return false;
  }

  return (
    stackStatus === "REVIEW_IN_PROGRESS" ||
    stackStatus.endsWith("_IN_PROGRESS") ||
    stackStatus.endsWith("_CLEANUP_IN_PROGRESS")
  );
}

function buildBlockedStackMessage(
  stackName: string,
  stackStatus: string | undefined,
  recentFailureEvents: AwsDeploy.StackFailureEvent[],
) {
  return [
    `Stack ${stackName} is currently ${stackStatus ?? "UNKNOWN"}. Manual CloudFormation recovery is required before another deploy can continue.`,
    ...(recentFailureEvents.length > 0
      ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
      : []),
  ].join("\n");
}

export function formatFailureEventLines(events: AwsDeploy.StackFailureEvent[]) {
  return events.map((event) => {
    const reasonSuffix = event.resourceStatusReason ? `: ${event.resourceStatusReason}` : "";
    return `- ${event.timestamp} ${event.logicalResourceId} (${event.resourceType}) ${event.resourceStatus}${reasonSuffix}`;
  });
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
