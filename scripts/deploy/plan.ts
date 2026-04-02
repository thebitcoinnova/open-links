import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import {
  enabledDeployTargets,
  getDeploymentState,
  isPlaceholderDeployPublicOrigin,
} from "../lib/effective-deployment-config";

const state = getDeploymentState();
const commandName = "deploy:plan";
const run = await createDeployRun({
  command: commandName,
  mode: "check",
  target: state.enabledTargets.join(","),
});

await run.addBreadcrumb({
  data: {
    enabledTargets: state.enabledTargets,
    primaryTarget: state.primaryTarget,
    repositorySlug: state.repositorySlug,
  },
  detail: "Resolved deployment topology from deployment defaults plus optional fork overlay.",
  status: "planned",
  step: "topology",
});

const skippedReasons = state.enabledTargets
  .filter((target) => isPlaceholderDeployPublicOrigin(state.targets[target].publicOrigin))
  .map(
    (target) =>
      `${target} does not yet have a tracked public origin and will stay out of README/live verification until configured.`,
  );

const verificationResults = state.enabledTargets.map((target) => ({
  detail: `${target} resolves to ${state.targets[target].publicOrigin} with basePath ${state.targets[target].basePath}.`,
  name: target,
  status: "passed" as const,
}));

const { runDirectory } = await writeDeploySummary(
  {
    appliedChanges: [],
    artifactDir: undefined,
    artifactHash: undefined,
    command: commandName,
    discoveredRemoteState: {
      enabledTargets: enabledDeployTargets,
      primaryCanonicalOrigin: state.primaryCanonicalOrigin,
      primaryTarget: state.primaryTarget,
      repositorySlug: state.repositorySlug,
    },
    mode: "check",
    plannedChanges: {
      configPath: "config/deployment.defaults.json + optional config/deployment.json",
      enabledTargets: state.enabledTargets,
      primaryTarget: state.primaryTarget,
    },
    resultingUrls: state.enabledTargets.map((target) => state.targets[target].publicOrigin),
    skippedReasons,
    target: state.enabledTargets.join(","),
    verificationResults,
  },
  { runDirectory: run.runDirectory },
);

console.log(
  JSON.stringify(
    {
      configPath: "config/deployment.defaults.json + optional config/deployment.json",
      enabledTargets: state.enabledTargets,
      primaryCanonicalOrigin: state.primaryCanonicalOrigin,
      primaryTarget: state.primaryTarget,
      repositorySlug: state.repositorySlug,
      runDirectory,
      targets: Object.fromEntries(
        state.enabledTargets.map((target) => [
          target,
          {
            basePath: state.targets[target].basePath,
            label: state.targets[target].label,
            publicOrigin: state.targets[target].publicOrigin,
            shouldIndex: state.targets[target].shouldIndex,
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
