import path from "node:path";
import {
  assessOrphanedReviewStack,
  deleteStack,
  ensureAwsCliAvailable,
  loadAwsCallerIdentity,
  loadRecentStackFailureEvents,
  loadStackChangeSetSummaries,
  loadStackResourceSummaries,
  loadStackState,
  waitForStackDeletion,
  waitForStackReadiness,
} from "../lib/aws-deploy";
import { runCommand } from "../lib/command";
import {
  type DeployManifest,
  assertDeployArtifactIntegrity,
  diffDeployManifests,
  getCacheControlForArtifactPath,
  getInvalidationPaths,
  getS3ContentEncoding,
  getS3ContentType,
  readDeployManifest,
} from "../lib/deploy-artifact";
import {
  type DeployVerificationResult,
  createDeployRun,
  writeDeploySummary,
} from "../lib/deploy-log";
import { parseArgs, recordTimedAction } from "./shared";

const args = parseArgs(process.argv.slice(2));
const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
const maxWaitMs = resolveMaxWaitMs(args["max-wait-ms"], mode);
const artifactDir = path.resolve(args.artifact ?? ".artifacts/deploy/aws");
const manifestPath = path.join(artifactDir, "deploy-manifest.json");
const localManifest = await readDeployManifest(manifestPath);
const commandName = "deploy:aws:publish";
const run = await createDeployRun({
  command: commandName,
  mode,
  target: "aws",
});

if (localManifest.target !== "aws") {
  throw new Error(`Expected an AWS deploy manifest, received target ${localManifest.target}.`);
}

const appliedChanges: string[] = [];
const skippedReasons: string[] = [];
const verificationResults: DeployVerificationResult[] = [];
let plannedChanges: unknown = {};

await run.addBreadcrumb({
  detail: `Loaded AWS artifact manifest ${localManifest.artifactHash} from ${artifactDir}.`,
  status: "info",
  step: "initialize",
});
await recordTimedAction(
  run,
  {
    detail: `Verified deploy artifact integrity for ${artifactDir}.`,
    status: "passed",
    step: "artifact integrity",
  },
  () => assertDeployArtifactIntegrity(artifactDir, localManifest),
);
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
const initialStackState = await recordTimedAction(
  run,
  {
    data: (currentStackState: ReturnType<typeof loadStackState>) => ({
      exists: currentStackState.exists,
      stackId: currentStackState.stackId,
      stackStatus: currentStackState.stackStatus,
    }),
    detail: "Loaded the current CloudFormation stack outputs.",
    status: "passed",
    step: "stack state",
  },
  () => loadStackState(),
);

let mutableStackState = initialStackState;
let maybeRemoteManifest: DeployManifest | null = null;
let orphanedReviewStackAssessment: ReturnType<typeof assessOrphanedReviewStack> | undefined;
let orphanedReviewStackChangeSets: ReturnType<typeof loadStackChangeSetSummaries> | undefined;
let orphanedReviewStackResources: ReturnType<typeof loadStackResourceSummaries> | undefined;

try {
  if (mutableStackState.exists && mutableStackState.stackStatus === "REVIEW_IN_PROGRESS") {
    orphanedReviewStackChangeSets = await recordTimedAction(
      run,
      {
        data: (changeSets: ReturnType<typeof loadStackChangeSetSummaries>) => ({
          count: changeSets.length,
          names: changeSets.map((changeSet) => changeSet.changeSetName),
        }),
        detail: "Loaded CloudFormation change sets for the REVIEW_IN_PROGRESS stack shell.",
        status: "passed",
        step: "review shell change sets",
      },
      () => loadStackChangeSetSummaries(),
    );
    orphanedReviewStackResources = await recordTimedAction(
      run,
      {
        data: (resources: ReturnType<typeof loadStackResourceSummaries>) => ({
          count: resources.length,
          resources,
        }),
        detail: "Loaded CloudFormation stack resources for the REVIEW_IN_PROGRESS stack shell.",
        status: "passed",
        step: "review shell resources",
      },
      () => loadStackResourceSummaries(),
    );
    orphanedReviewStackAssessment = assessOrphanedReviewStack(
      mutableStackState,
      orphanedReviewStackChangeSets,
      orphanedReviewStackResources,
    );

    await run.addBreadcrumb({
      data: orphanedReviewStackAssessment,
      detail: orphanedReviewStackAssessment.detail,
      status: orphanedReviewStackAssessment.canAutoDelete ? "planned" : "info",
      step: "review shell assessment",
    });

    if (orphanedReviewStackAssessment.canAutoDelete) {
      plannedChanges = {
        recovery: {
          action: "delete-orphaned-review-stack",
          stackName: mutableStackState.stackName,
        },
      };

      if (mode === "check") {
        skippedReasons.push(
          "Check mode detected an orphaned REVIEW_IN_PROGRESS stack shell. Run deploy:aws:bootstrap --apply to recover the stack before publishing content.",
        );
        verificationResults.push({
          detail: orphanedReviewStackAssessment.detail,
          name: "orphaned review stack",
          status: "skipped",
        });

        const { runDirectory } = await writeDeploySummary(
          {
            appliedChanges,
            artifactDir,
            artifactHash: localManifest.artifactHash,
            command: commandName,
            discoveredRemoteState: {
              identity,
              orphanedReviewStackAssessment,
              orphanedReviewStackChangeSets,
              orphanedReviewStackResources,
              stackState: mutableStackState,
            },
            mode,
            plannedChanges,
            resultingUrls: [localManifest.publicOrigin],
            skippedReasons,
            target: "aws",
            verificationResults,
          },
          { runDirectory: run.runDirectory },
        );

        console.log(`AWS publish ${mode} requires stack-shell recovery. Summary: ${runDirectory}`);
        process.exit(0);
      }

      await recordTimedAction(
        run,
        {
          data: (completion: Awaited<ReturnType<typeof waitForStackDeletion>>) => ({
            finalStackStatus: completion.finalStackState.stackStatus ?? null,
            waitedMs: completion.waitedMs,
          }),
          detail: `Deleted orphaned CloudFormation stack shell ${mutableStackState.stackName ?? "open-links-site"}.`,
          status: "passed",
          step: "review shell recovery",
        },
        () => {
          deleteStack();
          return waitForStackDeletion({ maxWaitMs });
        },
      );
      appliedChanges.push(
        `Deleted orphaned CloudFormation stack shell ${mutableStackState.stackName ?? "open-links-site"}.`,
      );
      verificationResults.push({
        detail:
          "Deleted the orphaned REVIEW_IN_PROGRESS stack shell. Run bootstrap before attempting another AWS content publish.",
        name: "orphaned review stack",
        status: "passed",
      });
      mutableStackState = loadStackState();
    }
  }

  const stackReadiness = await recordTimedAction(
    run,
    {
      data: (assessment: ReturnType<typeof waitForStackReadiness>) => ({
        maxWaitMs,
        stackStatus: assessment.stackStatus,
        state: assessment.state,
        waitedMs: assessment.waitedMs,
      }),
      detail: "Confirmed the CloudFormation stack is in a mutable state before publishing content.",
      status: "passed",
      step: "stack readiness",
    },
    () => waitForStackReadiness({ initialState: mutableStackState, maxWaitMs }),
  );
  mutableStackState = stackReadiness.stackState;

  if (!mutableStackState.exists) {
    throw new Error("AWS stack does not exist. Run deploy:aws:bootstrap before publishing.");
  }

  const bucketName = mutableStackState.outputs.SiteBucketName;
  const distributionId = mutableStackState.outputs.DistributionId;

  if (!bucketName || !distributionId) {
    throw new Error("AWS stack outputs did not include SiteBucketName and DistributionId.");
  }

  maybeRemoteManifest = await recordTimedAction(
    run,
    {
      data: (remoteManifest: Awaited<ReturnType<typeof loadRemoteManifest>>) => ({
        artifactHash: remoteManifest?.artifactHash ?? null,
        publicOrigin: remoteManifest?.publicOrigin ?? null,
      }),
      detail: `Loaded the remote deploy manifest from s3://${bucketName}/deploy-manifest.json.`,
      status: "passed",
      step: "remote manifest",
    },
    () => loadRemoteManifest(bucketName),
  );
  const diff = diffDeployManifests(localManifest, maybeRemoteManifest);
  const uploads = [...diff.uploads.map((file) => file.path)];

  if (diff.changed) {
    uploads.push("deploy-manifest.json");
  }

  const invalidationPaths = getInvalidationPaths(uploads.concat(diff.deletes));
  plannedChanges = {
    deletes: diff.deletes,
    invalidationPaths,
    uploads,
  };

  verificationResults.push({
    detail: `Using bucket ${bucketName} and distribution ${distributionId}.`,
    name: "stack outputs",
    status: "passed",
  });

  if (!diff.changed) {
    skippedReasons.push("The local deploy manifest matches the remote AWS deploy manifest.");
  } else if (mode === "check") {
    skippedReasons.push(
      "Check mode only. No S3 uploads, deletes, or CloudFront invalidations were executed.",
    );
  } else {
    for (const relativePath of uploads) {
      await uploadFile(bucketName, artifactDir, relativePath);
      appliedChanges.push(`Uploaded ${relativePath}`);
    }

    for (const relativePath of diff.deletes) {
      runCommand("aws", ["s3", "rm", `s3://${bucketName}/${relativePath}`, "--only-show-errors"]);
      appliedChanges.push(`Deleted ${relativePath}`);
    }

    if (invalidationPaths.length > 0) {
      runCommand("aws", [
        "cloudfront",
        "create-invalidation",
        "--distribution-id",
        distributionId,
        "--paths",
        ...invalidationPaths,
        "--output",
        "json",
      ]);
      appliedChanges.push(
        `Created CloudFront invalidation for ${invalidationPaths.length} path(s).`,
      );
    } else {
      skippedReasons.push(
        "Only immutable assets changed, so no CloudFront invalidation was required.",
      );
    }

    const maybeUpdatedRemoteManifest = await recordTimedAction(
      run,
      {
        data: (remoteManifest: Awaited<ReturnType<typeof loadRemoteManifest>>) => ({
          artifactHash: remoteManifest?.artifactHash ?? null,
          publicOrigin: remoteManifest?.publicOrigin ?? null,
        }),
        detail: `Reloaded the remote deploy manifest from s3://${bucketName}/deploy-manifest.json after publish.`,
        status: "passed",
        step: "remote manifest verify",
      },
      () => loadRemoteManifest(bucketName),
    );
    if (
      !maybeUpdatedRemoteManifest ||
      maybeUpdatedRemoteManifest.artifactHash !== localManifest.artifactHash
    ) {
      verificationResults.push({
        detail: "The uploaded deploy manifest does not match the local artifact hash.",
        name: "remote manifest",
        status: "failed",
      });
      throw new Error("Remote deploy manifest did not match the local artifact hash after upload.");
    }

    verificationResults.push({
      detail: `Remote deploy manifest hash ${maybeUpdatedRemoteManifest.artifactHash} matches the local artifact.`,
      name: "remote manifest",
      status: "passed",
    });
  }

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir,
      artifactHash: localManifest.artifactHash,
      command: commandName,
      discoveredRemoteState: {
        identity,
        maybeRemoteManifest,
        orphanedReviewStackAssessment,
        orphanedReviewStackChangeSets,
        orphanedReviewStackResources,
        stackState: mutableStackState,
      },
      mode,
      plannedChanges,
      resultingUrls: [localManifest.publicOrigin],
      skippedReasons,
      target: "aws",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`AWS publish ${mode} complete. Summary: ${runDirectory}`);
} catch (error) {
  const errorDetail = error instanceof Error ? error.message : String(error);
  const failureContext = loadFailureContext();

  verificationResults.push({
    detail: errorDetail,
    name: "publish",
    status: "failed",
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges,
      artifactDir,
      artifactHash: localManifest.artifactHash,
      command: commandName,
      discoveredRemoteState: {
        failureContext,
        identity,
        maybeRemoteManifest,
        orphanedReviewStackAssessment,
        orphanedReviewStackChangeSets,
        orphanedReviewStackResources,
        stackState: mutableStackState,
      },
      mode,
      plannedChanges,
      resultingUrls: [localManifest.publicOrigin],
      skippedReasons,
      target: "aws",
      verificationResults,
    },
    { runDirectory: run.runDirectory },
  );

  throw new Error(`${errorDetail}\nSee ${runDirectory}.`);
}

async function loadRemoteManifest(bucketName: string) {
  const result = runCommand(
    "aws",
    ["s3", "cp", `s3://${bucketName}/deploy-manifest.json`, "-", "--only-show-errors"],
    { allowFailure: true },
  );

  if (result.status !== 0) {
    const missingManifestPattern = /404|NoSuchKey|Not Found/i;
    if (missingManifestPattern.test(result.stderr) || missingManifestPattern.test(result.stdout)) {
      return null;
    }

    throw new Error(
      result.stderr ||
        result.stdout ||
        `Failed to load remote deploy manifest from s3://${bucketName}/deploy-manifest.json.`,
    );
  }

  const content = result.stdout.trim();
  if (!content) {
    return null;
  }

  return JSON.parse(content) as DeployManifest;
}

async function uploadFile(bucketName: string, rootDirectory: string, relativePath: string) {
  const filePath = path.join(rootDirectory, relativePath);
  const args = ["s3", "cp", filePath, `s3://${bucketName}/${relativePath}`, "--only-show-errors"];
  const cacheControl = getCacheControlForArtifactPath(relativePath);
  const contentType = getS3ContentType(relativePath);
  const contentEncoding = getS3ContentEncoding(relativePath);

  if (cacheControl) {
    args.push("--cache-control", cacheControl);
  }

  if (contentType) {
    args.push("--content-type", contentType);
  }

  if (contentEncoding) {
    args.push("--content-encoding", contentEncoding);
  }

  runCommand("aws", args);
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
