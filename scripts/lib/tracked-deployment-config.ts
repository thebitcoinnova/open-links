import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type DeployTarget,
  type TrackedDeploymentConfig,
  normalizeDeployPublicOrigin,
  parseTrackedDeploymentConfig,
} from "../../src/lib/deployment-config";

export interface UpdateTrackedDeploymentConfigOptions {
  enableTarget?: boolean;
  mode: "apply" | "check";
  promotePrimary?: boolean;
  publicOrigin?: string;
}

const DEFAULT_DEPLOYMENT_CONFIG_PATH = path.resolve("config/deployment.json");

export async function readTrackedDeploymentConfig(configPath = DEFAULT_DEPLOYMENT_CONFIG_PATH) {
  const content = await readFile(configPath, "utf8");
  return parseTrackedDeploymentConfig(JSON.parse(content));
}

export async function writeTrackedDeploymentConfig(
  config: TrackedDeploymentConfig,
  configPath = DEFAULT_DEPLOYMENT_CONFIG_PATH,
) {
  await writeFile(configPath, serializeTrackedDeploymentConfig(config), "utf8");
}

export function serializeTrackedDeploymentConfig(config: TrackedDeploymentConfig) {
  const normalizedTargets = Object.fromEntries(
    Object.entries(config.targets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([target, targetConfig]) => {
        const nextConfig: Record<string, string> = {};
        if (targetConfig?.publicOrigin) {
          nextConfig.publicOrigin = targetConfig.publicOrigin;
        }

        if (target === "aws" && targetConfig?.priceClass) {
          nextConfig.priceClass = targetConfig.priceClass;
        }

        return [target, nextConfig];
      }),
  );

  return `${JSON.stringify(
    {
      $schema: "../schema/deployment.schema.json",
      enabledTargets: [...config.enabledTargets],
      primaryTarget: config.primaryTarget,
      targets: normalizedTargets,
    },
    null,
    2,
  )}\n`;
}

export function updateTrackedDeploymentConfigForTarget(
  config: TrackedDeploymentConfig,
  target: DeployTarget,
  options: UpdateTrackedDeploymentConfigOptions,
) {
  const nextConfig: TrackedDeploymentConfig = {
    enabledTargets: [...config.enabledTargets],
    primaryTarget: config.primaryTarget,
    targets: Object.fromEntries(
      Object.entries(config.targets).map(([key, value]) => [key, { ...(value ?? {}) }]),
    ) as TrackedDeploymentConfig["targets"],
  };
  const nextTarget = {
    ...(nextConfig.targets[target] ?? {}),
  };
  const normalizedPublicOrigin = normalizeDeployPublicOrigin(options.publicOrigin);
  const plannedChanges: string[] = [];

  if (normalizedPublicOrigin && nextTarget.publicOrigin !== normalizedPublicOrigin) {
    nextTarget.publicOrigin = normalizedPublicOrigin;
    plannedChanges.push(`Set ${target} public origin to ${normalizedPublicOrigin}.`);
  }

  if (options.enableTarget !== false && !nextConfig.enabledTargets.includes(target)) {
    nextConfig.enabledTargets.push(target);
    plannedChanges.push(`Enabled deployment target ${target}.`);
  }

  if (options.promotePrimary && nextConfig.primaryTarget !== target) {
    nextConfig.primaryTarget = target;
    plannedChanges.push(`Promoted ${target} to the primary deployment target.`);
  }

  nextConfig.targets[target] = nextTarget;

  return {
    changed: plannedChanges.length > 0,
    config: nextConfig,
    plannedChanges,
  };
}
