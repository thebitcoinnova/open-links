import path from "node:path";
import { runCommand, runJsonCommand } from "./command";
import { deploymentConfig } from "./effective-deployment-config";

interface AwsCallerIdentity {
  Account: string;
  Arn: string;
  UserId: string;
}

interface HostedZoneRecord {
  Config?: {
    PrivateZone?: boolean;
  };
  Id: string;
  Name: string;
}

interface ListHostedZonesResponse {
  HostedZones: HostedZoneRecord[];
}

interface StackOutputRecord {
  OutputKey?: string;
  OutputValue?: string;
}

interface DescribeStacksResponse {
  Stacks?: Array<{
    Outputs?: StackOutputRecord[];
    StackId?: string;
    StackName?: string;
    StackStatus?: string;
  }>;
}

interface StackEventRecord {
  LogicalResourceId?: string;
  ResourceStatus?: string;
  ResourceStatusReason?: string;
  ResourceType?: string;
  Timestamp?: string;
}

interface DescribeStackEventsResponse {
  StackEvents?: StackEventRecord[];
}

interface ChangeSetResponse {
  Changes?: Array<{
    ResourceChange?: {
      Action?: string;
      LogicalResourceId?: string;
      Replacement?: string;
      ResourceType?: string;
    };
  }>;
  Status?: string;
  StatusReason?: string;
}

interface ListChangeSetsResponse {
  Summaries?: Array<{
    ChangeSetName?: string;
    ExecutionStatus?: string;
    Status?: string;
  }>;
}

interface ListStackResourcesResponse {
  StackResourceSummaries?: Array<{
    LogicalResourceId?: string;
    ResourceStatus?: string;
    ResourceType?: string;
  }>;
}

export type StackReadinessState = "blocked" | "ready" | "waiting";

export interface AwsStackState {
  exists: boolean;
  outputs: Record<string, string>;
  stackId?: string;
  stackName?: string;
  stackStatus?: string;
}

export interface HostedZoneReadinessEntry {
  domain: string;
  label: string;
  ready: boolean;
  blocker?: string;
  zoneId?: string;
}

export interface ResolvedHostedZoneEntry {
  domain: string;
  label: string;
  zoneId: string;
}

export interface ResolvedHostedZones {
  all: ResolvedHostedZoneEntry[];
  canonical: ResolvedHostedZoneEntry;
}

export interface DomainReadinessAssessment {
  all: HostedZoneReadinessEntry[];
  blockers: string[];
  canonical: HostedZoneReadinessEntry;
  ready: boolean;
}

export interface StackFailureEvent {
  logicalResourceId: string;
  resourceStatus: string;
  resourceStatusReason?: string;
  resourceType: string;
  timestamp: string;
}

export interface StackReadinessAssessment {
  detail: string;
  exists: boolean;
  recentFailureEvents: StackFailureEvent[];
  stackName: string;
  stackState: AwsStackState;
  stackStatus?: string;
  state: StackReadinessState;
  waitedMs: number;
}

export interface StackOperationCompletion {
  finalStackState: AwsStackState;
  recentFailureEvents: StackFailureEvent[];
  waitedMs: number;
}

export interface ChangeSetPlanChange {
  action: string;
  logicalResourceId: string;
  replacement: string;
  resourceType: string;
}

export interface ChangeSetRisk {
  action: string;
  logicalResourceId: string;
  reason: string;
  replacement: string;
  resourceType: string;
}

export interface ChangeSetRiskSummary {
  blockedRoute53Replacements: ChangeSetRisk[];
  hasBlockingRisk: boolean;
}

export interface ChangeSetPlan {
  changeSetName: string;
  changeSetType: "CREATE" | "UPDATE";
  changes: ChangeSetPlanChange[];
  isEmpty: boolean;
  rawStatus: string;
  rawStatusReason: string;
  riskSummary: ChangeSetRiskSummary;
}

export interface StackChangeSetSummary {
  changeSetName: string;
  executionStatus?: string;
  status?: string;
}

export interface StackResourceSummary {
  logicalResourceId: string;
  resourceStatus?: string;
  resourceType: string;
}

export interface OrphanedReviewStackAssessment {
  canAutoDelete: boolean;
  changeSetNames: string[];
  detail: string;
  resourceSummaries: StackResourceSummary[];
  stackName: string;
  stackStatus?: string;
}

export interface RecoverableRollbackStackAssessment {
  canAutoDelete: boolean;
  detail: string;
  resourceSummaries: StackResourceSummary[];
  stackName: string;
  stackStatus?: string;
}

export class DomainReadinessError extends Error {
  constructor(readonly assessment: DomainReadinessAssessment) {
    super(formatDomainReadinessMessage(assessment));
    this.name = "DomainReadinessError";
  }
}

export class StackReadinessError extends Error {
  constructor(readonly assessment: StackReadinessAssessment) {
    super(formatStackReadinessMessage(assessment));
    this.name = "StackReadinessError";
  }
}

export class StackOperationError extends Error {
  constructor(
    readonly finalStackState: AwsStackState,
    readonly recentFailureEvents: StackFailureEvent[],
    message: string,
  ) {
    super(message);
    this.name = "StackOperationError";
  }
}

interface WaitForStackReadinessOptions {
  initialState?: AwsStackState;
  loadCurrentState?: () => AwsStackState;
  loadFailureEvents?: () => StackFailureEvent[];
  maxWaitMs?: number;
  pollIntervalMs?: number;
  sleepFn?: (milliseconds: number) => void;
  stackName?: string;
}

interface WaitForStackOperationOptions {
  loadCurrentState?: () => AwsStackState;
  loadFailureEvents?: () => StackFailureEvent[];
  maxWaitMs?: number;
  pollIntervalMs?: number;
  sleepFn?: (milliseconds: number) => void;
  stackName?: string;
}

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

export function ensureAwsCliAvailable() {
  runCommand("aws", ["--version"]);
}

export function getAwsTemplatePath() {
  return path.resolve("infra/aws/static-site.yaml");
}

export function loadAwsCallerIdentity() {
  return runJsonCommand<AwsCallerIdentity>("aws", [
    "sts",
    "get-caller-identity",
    "--output",
    "json",
  ]);
}

export function buildSiteBucketName(accountId: string) {
  return `${deploymentConfig.bucketNamePrefix}-${accountId.toLowerCase()}`;
}

export function assessAwsDomainReadiness() {
  const zone = maybeResolveHostedZone(deploymentConfig.primaryCanonicalDomain);
  const entries = [
    {
      domain: deploymentConfig.primaryCanonicalDomain,
      label: "primary canonical host",
      blocker: zone
        ? undefined
        : `No public Route 53 hosted zone covers ${deploymentConfig.primaryCanonicalDomain}. ACM validation and alias records for this host are still blocked until registration, delegation, or hosted-zone setup finishes.`,
      ready: zone !== null,
      zoneId: zone?.id,
    } satisfies HostedZoneReadinessEntry,
  ];

  return buildDomainReadinessAssessment(entries);
}

export function formatDomainReadinessMessage(assessment: DomainReadinessAssessment) {
  const blockerLines = assessment.blockers.map((blocker) => `- ${blocker}`);
  const domain = assessment.canonical.domain;

  return [
    `AWS domain readiness is still pending for ${domain}.`,
    ...blockerLines,
    "Check mode can still report the pending state, but apply mode must wait until the missing hosted zone exists.",
  ].join("\n");
}

export function buildDomainReadinessAssessment(entries: HostedZoneReadinessEntry[]) {
  const canonical = entries[0];
  if (!canonical) {
    throw new Error("Expected a primary canonical AWS host in the deployment config.");
  }

  return {
    all: entries,
    blockers: entries
      .filter((entry) => !entry.ready && entry.blocker)
      .map((entry) => entry.blocker as string),
    canonical,
    ready: entries.every((entry) => entry.ready),
  } satisfies DomainReadinessAssessment;
}

export function resolveHostedZones() {
  const readiness = assessAwsDomainReadiness();

  if (!readiness.ready || !readiness.canonical.zoneId) {
    throw new DomainReadinessError(readiness);
  }

  const canonical = {
    domain: readiness.canonical.domain,
    label: readiness.canonical.label,
    zoneId: readiness.canonical.zoneId,
  } satisfies ResolvedHostedZoneEntry;

  return {
    all: [canonical],
    canonical,
  } satisfies ResolvedHostedZones;
}

export function validateAwsTemplate(templatePath = getAwsTemplatePath()) {
  return runJsonCommand<Record<string, unknown>>("aws", [
    "cloudformation",
    "validate-template",
    "--region",
    deploymentConfig.awsRegion,
    "--template-body",
    `file://${templatePath}`,
    "--output",
    "json",
  ]);
}

export function loadStackState(stackName: string = deploymentConfig.awsStackName): AwsStackState {
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

  const response = JSON.parse(result.stdout) as DescribeStacksResponse;
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
          (output): output is Required<Pick<StackOutputRecord, "OutputKey" | "OutputValue">> =>
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

  const response = JSON.parse(result.stdout) as DescribeStackEventsResponse;

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
): StackChangeSetSummary[] {
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

  const response = JSON.parse(result.stdout) as ListChangeSetsResponse;
  return (response.Summaries ?? []).flatMap((summary) => {
    if (!summary.ChangeSetName) {
      return [];
    }

    return [
      {
        changeSetName: summary.ChangeSetName,
        executionStatus: summary.ExecutionStatus,
        status: summary.Status,
      } satisfies StackChangeSetSummary,
    ];
  });
}

export function loadStackResourceSummaries(
  stackName: string = deploymentConfig.awsStackName,
): StackResourceSummary[] {
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

  const response = JSON.parse(result.stdout) as ListStackResourcesResponse;
  return (response.StackResourceSummaries ?? []).flatMap((resource) => {
    if (!resource.LogicalResourceId || !resource.ResourceType) {
      return [];
    }

    return [
      {
        logicalResourceId: resource.LogicalResourceId,
        resourceStatus: resource.ResourceStatus,
        resourceType: resource.ResourceType,
      } satisfies StackResourceSummary,
    ];
  });
}

export function assessOrphanedReviewStack(
  stackState: AwsStackState,
  changeSets: StackChangeSetSummary[] = [],
  resources: StackResourceSummary[] = [],
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
    } satisfies OrphanedReviewStackAssessment;
  }

  if (changeSets.length === 0 && resources.length === 0) {
    return {
      canAutoDelete: true,
      changeSetNames: [],
      detail: `Stack ${stackName} is stuck in REVIEW_IN_PROGRESS with no active change sets and no stack resources. This is an orphaned CloudFormation shell that can be safely deleted before retrying bootstrap.`,
      resourceSummaries: [],
      stackName,
      stackStatus: stackState.stackStatus,
    } satisfies OrphanedReviewStackAssessment;
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
  } satisfies OrphanedReviewStackAssessment;
}

export function assessRecoverableRollbackStack(
  stackState: AwsStackState,
  resources: StackResourceSummary[] = [],
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
    } satisfies RecoverableRollbackStackAssessment;
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
    } satisfies RecoverableRollbackStackAssessment;
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
  } satisfies RecoverableRollbackStackAssessment;
}

export function assessStackReadiness(
  stackState: AwsStackState,
  recentFailureEvents: StackFailureEvent[] = [],
  stackName: string = deploymentConfig.awsStackName,
) {
  let state: StackReadinessState;
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
  } satisfies StackReadinessAssessment;
}

export function formatStackReadinessMessage(assessment: StackReadinessAssessment) {
  return assessment.detail;
}

export function waitForStackReadiness(options: WaitForStackReadinessOptions = {}) {
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
      } satisfies StackReadinessAssessment;
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

export function buildAwsStackParameters(hostedZones: ResolvedHostedZones, bucketName: string) {
  return [
    formatCloudFormationParameter("SiteBucketName", bucketName),
    formatCloudFormationParameter("PrimaryDomain", hostedZones.canonical.domain),
    formatCloudFormationParameter("PrimaryHostedZoneId", hostedZones.canonical.zoneId),
    formatCloudFormationParameter("PriceClass", deploymentConfig.awsPriceClass),
  ];
}

export function createStackChangeSet(
  hostedZones: ResolvedHostedZones,
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

export function classifyChangeSetPlanRisks(changes: ChangeSetPlanChange[]) {
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
      } satisfies ChangeSetRisk,
    ];
  });

  return {
    blockedRoute53Replacements,
    hasBlockingRisk: blockedRoute53Replacements.length > 0,
  } satisfies ChangeSetRiskSummary;
}

export function formatChangeSetRiskMessage(riskSummary: ChangeSetRiskSummary) {
  if (!riskSummary.hasBlockingRisk) {
    return "The CloudFormation change set does not contain blocked Route 53 record replacements.";
  }

  return [
    "Blocked CloudFormation change set because it would replace or remove Route 53 records:",
    ...riskSummary.blockedRoute53Replacements.map(
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

    const response = runJsonCommand<ChangeSetResponse>("aws", [
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
      } satisfies ChangeSetPlan;
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
      } satisfies ChangeSetPlan;
    }

    sleep(5_000);
  }

  throw new Error(`Timed out waiting for change set ${changeSetName}.`);
}

export function executeChangeSet(
  changeSetName: string,
  changeSetType: "CREATE" | "UPDATE",
  options: WaitForStackOperationOptions = {},
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

export function waitForStackDeletion(options: WaitForStackOperationOptions = {}) {
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
      } satisfies StackOperationCompletion;
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

function waitForStackOperation(
  changeSetType: "CREATE" | "UPDATE",
  options: WaitForStackOperationOptions,
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
      } satisfies StackOperationCompletion;
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

function maybeResolveHostedZone(domain: string) {
  const candidates = buildHostedZoneCandidates(domain);

  for (const candidate of candidates) {
    const zone = maybeResolveHostedZoneByName(candidate);
    if (zone) {
      return zone;
    }
  }

  return null;
}

function maybeResolveHostedZoneByName(domain: string) {
  const response = runJsonCommand<ListHostedZonesResponse>("aws", [
    "route53",
    "list-hosted-zones-by-name",
    "--dns-name",
    domain,
    "--max-items",
    "10",
    "--output",
    "json",
  ]);

  const expectedZoneName = `${domain}.`;
  const maybeZone = response.HostedZones.find(
    (zone) => zone.Name === expectedZoneName && zone.Config?.PrivateZone !== true,
  );

  return maybeZone
    ? {
        id: maybeZone.Id.replace("/hostedzone/", ""),
        name: maybeZone.Name,
      }
    : null;
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
  recentFailureEvents: StackFailureEvent[],
) {
  return [
    `Stack ${stackName} is currently ${stackStatus ?? "UNKNOWN"}. Manual CloudFormation recovery is required before another deploy can continue.`,
    ...(recentFailureEvents.length > 0
      ? ["Recent failed stack events:", ...formatFailureEventLines(recentFailureEvents)]
      : []),
  ].join("\n");
}

function formatFailureEventLines(events: StackFailureEvent[]) {
  return events.map((event) => {
    const reasonSuffix = event.resourceStatusReason ? `: ${event.resourceStatusReason}` : "";
    return `- ${event.timestamp} ${event.logicalResourceId} (${event.resourceType}) ${event.resourceStatus}${reasonSuffix}`;
  });
}

function buildHostedZoneCandidates(domain: string) {
  const labels = domain.split(".");
  const candidates: string[] = [];

  for (let index = 0; index < labels.length - 1; index += 1) {
    candidates.push(labels.slice(index).join("."));
  }

  return candidates;
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
