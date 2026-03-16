import { deploymentConfig } from "../../src/lib/deployment-config";
import {
  assessAwsDomainReadiness,
  buildSiteBucketName,
  createStackChangeSet,
  deleteChangeSet,
  ensureAwsCliAvailable,
  executeChangeSet,
  formatChangeSetRiskMessage,
  formatDomainReadinessMessage,
  loadAwsCallerIdentity,
  loadRecentStackFailureEvents,
  loadStackState,
  resolveHostedZones,
  validateAwsTemplate,
  waitForChangeSet,
  waitForStackReadiness,
} from "../lib/aws-deploy";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import { parseArgs, recordTimedAction } from "./shared";

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const maxWaitMs = resolveMaxWaitMs(args["max-wait-ms"], mode);
const commandName = "deploy:aws:bootstrap";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "aws",
});

const appliedChanges: string[] = [];
const skippedReasons: string[] = [];
const verificationResults: DeployVerificationResult[] = [];
let plannedChanges: unknown = {};
let resultingUrls: string[] = [deploymentConfig.primaryCanonicalOrigin];

await run.addBreadcrumb({
  detail: "Validating AWS CLI access and current stack prerequisites.",
  status: "info",
  step: "initialize",
});
await recordTimedAction(
  run,
  {
    detail: "Validated AWS CLI access.",
    status: "passed",
    step: "aws cli",
  },
  () => ensureAwsCliAvailable(),
);

const identity = await recordTimedAction(
  run,
  {
    data: (currentIdentity: ReturnType<typeof loadAwsCallerIdentity>) => ({
      accountId: currentIdentity.Account,
      arn: currentIdentity.Arn,
      userId: currentIdentity.UserId,
    }),
    detail: "Loaded the active AWS caller identity.",
    status: "passed",
    step: "caller identity",
  },
  () => loadAwsCallerIdentity(),
);
const domainReadiness = await recordTimedAction(
  run,
  {
    data: (assessment: ReturnType<typeof assessAwsDomainReadiness>) => assessment,
    detail: "Loaded AWS domain readiness for the canonical host.",
    status: "passed",
    step: "domain readiness",
  },
  () => assessAwsDomainReadiness(),
);
const bucketName = buildSiteBucketName(identity.Account);
const templateValidation = await recordTimedAction(
  run,
  {
    detail: `Validated CloudFormation template ${deploymentConfig.awsStackName}.`,
    status: "passed",
    step: "template validation",
  },
  () => validateAwsTemplate(),
);
const initialStackState = await recordTimedAction(
  run,
  {
    data: (stackState: ReturnType<typeof loadStackState>) => ({
      exists: stackState.exists,
      stackId: stackState.stackId,
      stackStatus: stackState.stackStatus,
    }),
    detail: "Loaded the current CloudFormation stack state.",
    status: "passed",
    step: "stack state",
  },
  () => loadStackState(),
);

resultingUrls = [
  deploymentConfig.primaryCanonicalOrigin,
  ...(initialStackState.outputs.DistributionDomainName
    ? [`https://${initialStackState.outputs.DistributionDomainName}`]
    : []),
];

if (!domainReadiness.ready) {
  const blockerDetail = formatDomainReadinessMessage(domainReadiness);
  const skippedVerificationStatus = mode === "check" ? "skipped" : "failed";

  verificationResults.push({
    detail: `Validated ${deploymentConfig.awsStackName} CloudFormation template.`,
    name: "template",
    status: "passed",
  });
  verificationResults.push({
    detail: blockerDetail,
    name: "domain readiness",
    status: skippedVerificationStatus,
  });

  skippedReasons.push(
    mode === "check"
      ? blockerDetail
      : "Apply mode stopped before CloudFormation mutations because openlinks.us is not fully ready in Route 53 yet.",
  );

  await run.addBreadcrumb({
    detail: blockerDetail,
    status: skippedVerificationStatus,
    step: "plan",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        currentStackState: initialStackState,
        domainReadiness,
        identity,
        templateValidation,
      },
      mode,
      plannedChanges: {
        blockedBy: "domain readiness",
      },
      resultingUrls,
      skippedReasons,
      target: "aws",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  if (mode === "check") {
    console.log(`AWS bootstrap ${mode} blocked by domain readiness. Summary: ${runDirectory}`);
    process.exit(0);
  }

  throw new Error(`AWS bootstrap apply blocked until openlinks.us is ready. See ${runDirectory}.`);
}

let mutableStackState = initialStackState;
let hostedZones: ReturnType<typeof resolveHostedZones> | undefined;
let changeSetPlan: ReturnType<typeof waitForChangeSet> | undefined;

try {
  const stackReadiness = await recordTimedAction(
    run,
    {
      data: (assessment: ReturnType<typeof waitForStackReadiness>) => ({
        maxWaitMs,
        stackStatus: assessment.stackStatus,
        state: assessment.state,
        waitedMs: assessment.waitedMs,
      }),
      detail: "Confirmed the CloudFormation stack is in a mutable state before planning changes.",
      status: "passed",
      step: "stack readiness",
    },
    () => waitForStackReadiness({ initialState: initialStackState, maxWaitMs }),
  );
  mutableStackState = stackReadiness.stackState;

  const resolvedHostedZones = await recordTimedAction(
    run,
    {
      data: (resolvedHostedZones: ReturnType<typeof resolveHostedZones>) => resolvedHostedZones,
      detail: "Resolved the canonical Route 53 hosted zone.",
      status: "passed",
      step: "hosted zones",
    },
    () => resolveHostedZones(),
  );
  hostedZones = resolvedHostedZones;

  const changeSet = await recordTimedAction(
    run,
    {
      data: (createdChangeSet: ReturnType<typeof createStackChangeSet>) => ({
        bucketName,
        changeSetName: createdChangeSet.changeSetName,
        changeSetType: createdChangeSet.changeSetType,
        stackExists: mutableStackState.exists,
      }),
      detail: "Created the CloudFormation change set.",
      status: "planned",
      step: "change set create",
    },
    () => createStackChangeSet(resolvedHostedZones, bucketName, mutableStackState.exists),
  );
  const plannedChangeSetName = changeSet.changeSetName;
  const plannedChangeSetType = changeSet.changeSetType;

  changeSetPlan = await recordTimedAction(
    run,
    {
      data: (plan: ReturnType<typeof waitForChangeSet>) => ({
        blockedRoute53Replacements: plan.riskSummary.blockedRoute53Replacements,
        changeCount: plan.changes.length,
        hasBlockingRisk: plan.riskSummary.hasBlockingRisk,
        isEmpty: plan.isEmpty,
        rawStatus: plan.rawStatus,
        rawStatusReason: plan.rawStatusReason,
      }),
      detail: "Waited for the CloudFormation change set to reach a terminal state.",
      status: "planned",
      step: "change set wait",
    },
    () => waitForChangeSet(plannedChangeSetName, plannedChangeSetType),
  );
  plannedChanges = changeSetPlan;

  verificationResults.push({
    detail: `Validated ${deploymentConfig.awsStackName} CloudFormation template.`,
    name: "template",
    status: "passed",
  });

  if (changeSetPlan.riskSummary.hasBlockingRisk) {
    const riskDetail = formatChangeSetRiskMessage(changeSetPlan.riskSummary);
    skippedReasons.push(riskDetail);
    verificationResults.push({
      detail: riskDetail,
      name: "change set safety",
      status: "failed",
    });

    if (mode === "apply") {
      throw new Error(riskDetail);
    }
  } else {
    verificationResults.push({
      detail:
        "The CloudFormation change set only plans safe in-place updates or additive resources.",
      name: "change set safety",
      status: "passed",
    });
  }

  try {
    if (changeSetPlan.isEmpty) {
      skippedReasons.push(
        `CloudFormation reported no infrastructure changes: ${changeSetPlan.rawStatusReason}`,
      );
    } else if (changeSetPlan.riskSummary.hasBlockingRisk) {
      skippedReasons.push("Skipped change-set execution because the safety check blocked it.");
    } else if (mode === "check") {
      skippedReasons.push(`Check mode only. Change set ${plannedChangeSetName} was not executed.`);
    } else {
      await recordTimedAction(
        run,
        {
          data: (completion: Awaited<ReturnType<typeof executeChangeSet>>) => ({
            finalStackStatus: completion.finalStackState.stackStatus,
            waitedMs: completion.waitedMs,
          }),
          detail: `Executed ${plannedChangeSetType.toLowerCase()} change set ${plannedChangeSetName}.`,
          status: "passed",
          step: "apply",
        },
        () => executeChangeSet(plannedChangeSetName, plannedChangeSetType),
      );
      appliedChanges.push(
        `Executed ${plannedChangeSetType.toLowerCase()} change set ${plannedChangeSetName}.`,
      );
      verificationResults.push({
        detail: `Stack ${deploymentConfig.awsStackName} reached a complete state after executing ${plannedChangeSetType.toLowerCase()}.`,
        name: "stack",
        status: "passed",
      });
    }
  } finally {
    await recordTimedAction(
      run,
      {
        detail: `Deleted CloudFormation change set ${plannedChangeSetName}.`,
        status: "passed",
        step: "cleanup",
      },
      () => deleteChangeSet(plannedChangeSetName),
    );
  }

  const finalStackState = await recordTimedAction(
    run,
    {
      data: (stackState: ReturnType<typeof loadStackState>) => ({
        exists: stackState.exists,
        stackId: stackState.stackId,
        stackStatus: stackState.stackStatus,
      }),
      detail: "Loaded the final CloudFormation stack state after the run.",
      status: "passed",
      step: "final stack state",
    },
    () => loadStackState(),
  );

  resultingUrls = [
    deploymentConfig.primaryCanonicalOrigin,
    ...(finalStackState.outputs.DistributionDomainName
      ? [`https://${finalStackState.outputs.DistributionDomainName}`]
      : []),
  ];

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        currentStackState: initialStackState,
        finalStackState,
        hostedZones,
        identity,
        mutableStackState,
        templateValidation,
      },
      mode,
      plannedChanges,
      resultingUrls,
      skippedReasons,
      target: "aws",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`AWS bootstrap ${mode} complete. Summary: ${runDirectory}`);
} catch (error) {
  const errorDetail = error instanceof Error ? error.message : String(error);
  const failureContext = loadFailureContext();
  resultingUrls = [
    deploymentConfig.primaryCanonicalOrigin,
    ...(failureContext.currentStackState?.outputs.DistributionDomainName
      ? [`https://${failureContext.currentStackState.outputs.DistributionDomainName}`]
      : []),
  ];

  verificationResults.push({
    detail: errorDetail,
    name: "bootstrap",
    status: "failed",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        currentStackState: initialStackState,
        failureContext,
        hostedZones,
        identity,
        mutableStackState,
        templateValidation,
      },
      mode,
      plannedChanges,
      resultingUrls,
      skippedReasons,
      target: "aws",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  throw new Error(`${errorDetail}\nSee ${runDirectory}.`);
}

function resolveMaxWaitMs(maybeValue: string | undefined, mode: "apply" | "check") {
  if (!maybeValue) {
    return mode === "check" ? 15_000 : 30 * 60 * 1000;
  }

  const parsed = Number(maybeValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected --max-wait-ms to be a positive number, received: ${maybeValue}`);
  }

  return Math.round(parsed);
}

function loadFailureContext() {
  try {
    const currentStackState = loadStackState();
    return {
      currentStackState,
      recentFailureEvents: currentStackState.exists ? loadRecentStackFailureEvents() : [],
    };
  } catch (failureContextError) {
    return {
      failureContextError:
        failureContextError instanceof Error
          ? failureContextError.message
          : String(failureContextError),
    };
  }
}
