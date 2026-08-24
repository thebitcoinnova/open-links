export interface AwsCallerIdentity {
  Account: string;
  Arn: string;
  UserId: string;
}

export interface HostedZoneRecord {
  Config?: {
    PrivateZone?: boolean;
  };
  Id: string;
  Name: string;
}

export interface ListHostedZonesResponse {
  HostedZones: HostedZoneRecord[];
}

export interface StackOutputRecord {
  OutputKey?: string;
  OutputValue?: string;
}

export interface DescribeStacksResponse {
  Stacks?: Array<{
    Outputs?: StackOutputRecord[];
    StackId?: string;
    StackName?: string;
    StackStatus?: string;
  }>;
}

export interface StackEventRecord {
  LogicalResourceId?: string;
  ResourceStatus?: string;
  ResourceStatusReason?: string;
  ResourceType?: string;
  Timestamp?: string;
}

export interface DescribeStackEventsResponse {
  StackEvents?: StackEventRecord[];
}

export interface ChangeSetResponse {
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

export interface ListChangeSetsResponse {
  Summaries?: Array<{
    ChangeSetName?: string;
    ExecutionStatus?: string;
    Status?: string;
  }>;
}

export interface ListStackResourcesResponse {
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
  blockedCriticalReplacements: ChangeSetRisk[];
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

export interface WaitForStackReadinessOptions {
  initialState?: AwsStackState;
  loadCurrentState?: () => AwsStackState;
  loadFailureEvents?: () => StackFailureEvent[];
  maxWaitMs?: number;
  pollIntervalMs?: number;
  sleepFn?: (milliseconds: number) => void;
  stackName?: string;
}

export interface WaitForStackOperationOptions {
  loadCurrentState?: () => AwsStackState;
  loadFailureEvents?: () => StackFailureEvent[];
  maxWaitMs?: number;
  pollIntervalMs?: number;
  sleepFn?: (milliseconds: number) => void;
  stackName?: string;
}
