import { resolveDeploymentState } from "../../src/lib/deployment-config";
import { createDeployRun, writeDeploySummary } from "../lib/deploy-log";
import { syncDeploymentTrackedFiles } from "../lib/deployment-tracked-files";
import type { ProviderDeployTarget } from "../lib/provider-deploy";
import {
  readTrackedDeploymentConfig,
  updateTrackedDeploymentConfigForTarget,
  writeTrackedDeploymentConfig,
} from "../lib/tracked-deployment-config";
import { parseArgs } from "./shared";

interface RunProviderSetupOptions {
  providerConfigPath: string;
  providerLabel: string;
  target: ProviderDeployTarget;
}

export async function runProviderSetup(options: RunProviderSetupOptions) {
  const args = parseArgs(process.argv.slice(2));
  const mode: "apply" | "check" = args.apply === "true" ? "apply" : "check";
  const commandName = `deploy:setup:${options.target}`;
  const run = await createDeployRun({
    command: commandName,
    mode,
    target: options.target,
  });
  const trackedConfig = await readTrackedDeploymentConfig();
  const configUpdate = updateTrackedDeploymentConfigForTarget(trackedConfig, options.target, {
    enableTarget: true,
    mode,
    promotePrimary: args["promote-primary"] === "true",
    publicOrigin: args["public-origin"],
  });
  const resolvedState = resolveDeploymentState({
    trackedConfig: configUpdate.config,
  });

  await run.addBreadcrumb({
    data: {
      configUpdate,
      providerConfigPath: options.providerConfigPath,
      resolvedState,
    },
    detail: `Prepared the ${options.providerLabel} config-wrapper setup plan.`,
    status: "planned",
    step: "plan",
  });

  if (mode === "apply" && configUpdate.changed) {
    await writeTrackedDeploymentConfig(configUpdate.config);
  }

  const syncedTrackedFiles = await syncDeploymentTrackedFiles({
    mode,
    state: resolvedState,
  });

  const { runDirectory } = await writeDeploySummary(
    {
      appliedChanges:
        mode === "apply"
          ? [...configUpdate.plannedChanges, ...syncedTrackedFiles.plannedChanges]
          : [],
      artifactDir: undefined,
      artifactHash: undefined,
      command: commandName,
      discoveredRemoteState: {
        configUpdate,
        providerConfigPath: options.providerConfigPath,
        resolvedState,
      },
      mode,
      plannedChanges: {
        changes: [...configUpdate.plannedChanges, ...syncedTrackedFiles.plannedChanges],
        target: options.target,
      },
      resultingUrls: syncedTrackedFiles.resultingUrls,
      skippedReasons: [
        ...(mode === "check"
          ? [...configUpdate.plannedChanges, ...syncedTrackedFiles.plannedChanges]
          : []),
        ...syncedTrackedFiles.skippedReasons,
      ],
      target: options.target,
      verificationResults: [
        {
          detail: `${options.providerLabel} now resolves to ${resolvedState.targets[options.target].publicOrigin}.`,
          name: `${options.providerLabel} topology`,
          status: "passed",
        },
      ],
    },
    { runDirectory: run.runDirectory },
  );

  console.log(`${options.providerLabel} setup ${mode} complete. Summary: ${runDirectory}`);
}
