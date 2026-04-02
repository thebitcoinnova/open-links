import fs from "node:fs";
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

export const DEFAULT_DEPLOYMENT_DEFAULTS_PATH = path.resolve("config/deployment.defaults.json");
export const DEFAULT_DEPLOYMENT_OVERLAY_PATH = path.resolve("config/deployment.json");

const readJsonIfExists = (absolutePath: string) => {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as Record<string, unknown>;
};

const mergeDeploymentConfigInputs = (
  defaultsInput: Record<string, unknown>,
  maybeOverlayInput: Record<string, unknown> | null,
) => {
  if (!maybeOverlayInput) {
    return defaultsInput;
  }

  return {
    ...defaultsInput,
    ...maybeOverlayInput,
    targets: {
      ...(defaultsInput.targets as Record<string, unknown> | undefined),
      ...(maybeOverlayInput.targets as Record<string, unknown> | undefined),
      aws: {
        ...((defaultsInput.targets as Record<string, Record<string, unknown>> | undefined)?.aws ??
          {}),
        ...((maybeOverlayInput.targets as Record<string, Record<string, unknown>> | undefined)
          ?.aws ?? {}),
      },
      "github-pages": {
        ...((defaultsInput.targets as Record<string, Record<string, unknown>> | undefined)?.[
          "github-pages"
        ] ?? {}),
        ...((maybeOverlayInput.targets as Record<string, Record<string, unknown>> | undefined)?.[
          "github-pages"
        ] ?? {}),
      },
      render: {
        ...((defaultsInput.targets as Record<string, Record<string, unknown>> | undefined)
          ?.render ?? {}),
        ...((maybeOverlayInput.targets as Record<string, Record<string, unknown>> | undefined)
          ?.render ?? {}),
      },
      railway: {
        ...((defaultsInput.targets as Record<string, Record<string, unknown>> | undefined)
          ?.railway ?? {}),
        ...((maybeOverlayInput.targets as Record<string, Record<string, unknown>> | undefined)
          ?.railway ?? {}),
      },
    },
  };
};

export async function readDeploymentDefaultsConfig(configPath = DEFAULT_DEPLOYMENT_DEFAULTS_PATH) {
  const content = await readFile(configPath, "utf8");
  return parseTrackedDeploymentConfig(JSON.parse(content));
}

export async function readDeploymentOverlayConfig(configPath = DEFAULT_DEPLOYMENT_OVERLAY_PATH) {
  const maybeOverlay = readJsonIfExists(configPath);
  return maybeOverlay ? parseTrackedDeploymentConfig(maybeOverlay) : null;
}

export async function readEffectiveTrackedDeploymentConfig(
  defaultsPath = DEFAULT_DEPLOYMENT_DEFAULTS_PATH,
  overlayPath = DEFAULT_DEPLOYMENT_OVERLAY_PATH,
) {
  const defaultsInput = JSON.parse(await readFile(defaultsPath, "utf8")) as Record<string, unknown>;
  const maybeOverlayInput = readJsonIfExists(overlayPath);
  return parseTrackedDeploymentConfig(
    mergeDeploymentConfigInputs(defaultsInput, maybeOverlayInput),
  );
}

export async function writeDeploymentOverlayConfig(
  config: TrackedDeploymentConfig,
  configPath = DEFAULT_DEPLOYMENT_OVERLAY_PATH,
) {
  await writeFile(configPath, serializeDeploymentConfig(config), "utf8");
}

export function serializeDeploymentConfig(config: TrackedDeploymentConfig) {
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
