import fs from "node:fs";
import path from "node:path";
import {
  type DeployTarget,
  type DeployTargetConfig,
  type DeploymentResolutionState,
  type TrackedDeploymentConfig,
  buildDeploymentConfig,
  buildEffectiveTrackedDeploymentConfig,
  getRobotsMetaContentForPublicOrigin,
  isPlaceholderDeployPublicOrigin,
  joinOriginAndRoute,
  normalizeBasePath,
  normalizeOrigin,
  parseDeployTarget,
  parseTrackedDeploymentConfig,
  resolveAwsPublicOrigin as resolveAwsPublicOriginFromDefaults,
  resolveDeploymentState as resolveBaseDeploymentState,
  resolveRailwayPublicOrigin as resolveRailwayPublicOriginFromDefaults,
  resolveRenderPublicOrigin as resolveRenderPublicOriginFromDefaults,
  shouldIndexPublicOrigin,
} from "../../src/lib/deployment-config";

export type {
  DeployTarget,
  DeployTargetConfig,
  DeploymentResolutionState,
  TrackedDeploymentConfig,
} from "../../src/lib/deployment-config";

const DEFAULT_DEPLOYMENT_DEFAULTS_PATH = path.resolve("config/deployment.defaults.json");
const DEFAULT_DEPLOYMENT_OVERLAY_PATH = path.resolve("config/deployment.json");

const readJsonFileIfExists = (absolutePath: string) => {
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as Record<string, unknown>;
};

export const readDeploymentDefaultsConfig = (
  defaultsPath = DEFAULT_DEPLOYMENT_DEFAULTS_PATH,
): TrackedDeploymentConfig => {
  const defaultsInput = JSON.parse(fs.readFileSync(defaultsPath, "utf8")) as Record<
    string,
    unknown
  >;
  return parseTrackedDeploymentConfig(defaultsInput);
};

export const readDeploymentOverlayConfig = (
  overlayPath = DEFAULT_DEPLOYMENT_OVERLAY_PATH,
): TrackedDeploymentConfig | null => {
  const maybeOverlay = readJsonFileIfExists(overlayPath);
  return maybeOverlay ? parseTrackedDeploymentConfig(maybeOverlay) : null;
};

export const readEffectiveTrackedDeploymentConfig = (
  defaultsPath = DEFAULT_DEPLOYMENT_DEFAULTS_PATH,
  overlayPath = DEFAULT_DEPLOYMENT_OVERLAY_PATH,
): TrackedDeploymentConfig => {
  const defaultsInput = JSON.parse(fs.readFileSync(defaultsPath, "utf8")) as Record<
    string,
    unknown
  >;
  const maybeOverlayInput = readJsonFileIfExists(overlayPath);
  return buildEffectiveTrackedDeploymentConfig(defaultsInput, maybeOverlayInput);
};

const effectiveTrackedDeploymentConfig = readEffectiveTrackedDeploymentConfig();
const deploymentState = resolveBaseDeploymentState({
  trackedConfig: effectiveTrackedDeploymentConfig,
});

export const deploymentConfig = buildDeploymentConfig(deploymentState);
export const deployTargets: Record<DeployTarget, DeployTargetConfig> = deploymentState.targets;
export const enabledDeployTargets: DeployTarget[] = [...deploymentState.enabledTargets];

export function getDeploymentState() {
  return resolveBaseDeploymentState({
    trackedConfig: readEffectiveTrackedDeploymentConfig(),
  });
}

export function resolveDeploymentState(input?: {
  trackedConfig?: TrackedDeploymentConfig;
  repositorySlug?: string;
  env?: Record<string, string | undefined>;
}) {
  return resolveBaseDeploymentState({
    env: input?.env,
    repositorySlug: input?.repositorySlug,
    trackedConfig: input?.trackedConfig ?? readEffectiveTrackedDeploymentConfig(),
  });
}

export function getDeployTargetConfig(target: DeployTarget) {
  return getDeploymentState().targets[target];
}

export function getCanonicalUrl(route: string) {
  return joinOriginAndRoute(deploymentConfig.primaryCanonicalOrigin, route);
}

export function getPublicUrl(target: DeployTarget, route: string) {
  return joinOriginAndRoute(getDeployTargetConfig(target).publicOrigin, route);
}

export function getRobotsMetaContent(target: DeployTarget) {
  return getRobotsMetaContentForPublicOrigin(getDeployTargetConfig(target).publicOrigin);
}

export function getRobotsTxt(target: DeployTarget) {
  const targetConfig = getDeployTargetConfig(target);
  const directives = shouldIndexPublicOrigin(
    targetConfig.publicOrigin,
    deploymentConfig.primaryCanonicalOrigin,
  )
    ? ["Allow: /"]
    : ["Disallow: /"];

  return ["User-agent: *", ...directives, `Sitemap: ${getCanonicalUrl("/sitemap.xml")}`, ""].join(
    "\n",
  );
}

export function getExpectedAssetPrefix(target: DeployTarget) {
  const basePath = getDeployTargetConfig(target).basePath;
  return basePath === "/" ? "/assets/" : `${basePath}assets/`;
}

export function getUnexpectedTargetPrefix(target: DeployTarget) {
  return getDeployTargetConfig(target).basePath === "/"
    ? deploymentConfig.githubPagesDefaultBasePath
    : "/assets/";
}

export {
  getRobotsMetaContentForPublicOrigin,
  isPlaceholderDeployPublicOrigin,
  joinOriginAndRoute,
  normalizeBasePath,
  normalizeOrigin,
  parseDeployTarget,
};

export function resolveRenderPublicOrigin(
  maybeTrackedPublicOrigin = effectiveTrackedDeploymentConfig.targets.render?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRenderExternalUrl = process.env.RENDER_EXTERNAL_URL,
) {
  return resolveRenderPublicOriginFromDefaults(
    maybeTrackedPublicOrigin,
    maybeOverride,
    maybeRenderExternalUrl,
  );
}

export function resolveRailwayPublicOrigin(
  maybeTrackedPublicOrigin = effectiveTrackedDeploymentConfig.targets.railway?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRailwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN,
) {
  return resolveRailwayPublicOriginFromDefaults(
    maybeTrackedPublicOrigin,
    maybeOverride,
    maybeRailwayPublicDomain,
  );
}

export function resolveAwsPublicOrigin(
  maybeTrackedPublicOrigin = effectiveTrackedDeploymentConfig.targets.aws?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_AWS_PUBLIC_ORIGIN,
) {
  return resolveAwsPublicOriginFromDefaults(maybeTrackedPublicOrigin, maybeOverride);
}
