import {
  assessAwsDomainReadiness,
  buildSiteBucketName,
  ensureAwsCliAvailable,
  loadAwsCallerIdentity,
  loadRecentStackFailureEvents,
  loadStackState,
  validateAwsTemplate,
} from "../lib/aws-deploy";
import { type DeployVerificationResult, createDeployRun } from "../lib/deploy-log";
import { deploymentConfig } from "../lib/effective-deployment-config";
import { recordTimedAction } from "./shared";

export const buildAwsResultingUrls = (stackState: ReturnType<typeof loadStackState>) => [
  deploymentConfig.primaryCanonicalOrigin,
  ...(stackState.outputs.DistributionDomainName
    ? [`https://${stackState.outputs.DistributionDomainName}`]
    : []),
];

export const resolveMaxWaitMs = (maybeValue: string | undefined, mode: "apply" | "check") => {
  if (!maybeValue) return mode === "check" ? 15_000 : 30 * 60 * 1000;
  const parsed = Number(maybeValue);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`Expected --max-wait-ms to be a positive number, received: ${maybeValue}`);
  return Math.round(parsed);
};

export const initializeAwsBootstrap = async (args: Record<string, string>) => {
  const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
  const maxWaitMs = resolveMaxWaitMs(args["max-wait-ms"], mode);
  const commandName = "deploy:aws:bootstrap";
  const run = await createDeployRun({ command: commandName, mode, target: "aws" });
  const appliedChanges: string[] = [];
  const skippedReasons: string[] = [];
  const verificationResults: DeployVerificationResult[] = [];
  await run.addBreadcrumb({
    detail: "Validating AWS CLI access and current stack prerequisites.",
    status: "info",
    step: "initialize",
  });
  await recordTimedAction(
    run,
    { detail: "Validated AWS CLI access.", status: "passed", step: "aws cli" },
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
  const resultingUrls = buildAwsResultingUrls(initialStackState);
  return {
    appliedChanges,
    bucketName,
    commandName,
    domainReadiness,
    identity,
    initialStackState,
    maxWaitMs,
    mode,
    resultingUrls,
    run,
    skippedReasons,
    templateValidation,
    verificationResults,
  };
};

export const loadAwsBootstrapFailureContext = () => {
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
};
