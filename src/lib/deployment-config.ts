import deploymentDefaultsConfigJson from "../../config/deployment.defaults.json" with {
  type: "json",
};
import {
  DEFAULT_GITHUB_REPOSITORY_NAME,
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
  normalizeGitHubRepositorySlug,
  parseGitHubRepositorySlug,
  resolveGitHubRepositorySlug,
  trimToUndefined,
} from "./github-repository";

export type DeployTarget = "aws" | "github-pages" | "railway" | "render";
export type AwsPriceClass = "PriceClass_100" | "PriceClass_200" | "PriceClass_All";

export interface TrackedDeployTargetConfig {
  priceClass?: AwsPriceClass;
  publicOrigin?: string;
}

export interface TrackedDeploymentConfig {
  enabledTargets: DeployTarget[];
  primaryTarget: DeployTarget;
  targets: Partial<Record<DeployTarget, TrackedDeployTargetConfig>>;
}

export interface DeployTargetConfig {
  basePath: string;
  id: DeployTarget;
  label: string;
  publicOrigin: string;
  shouldIndex: boolean;
}

export interface DeploymentResolutionState {
  awsPriceClass: AwsPriceClass;
  awsResourcePrefix: string;
  defaultRepositorySlug: string;
  enabledTargets: DeployTarget[];
  githubPagesBasePath: string;
  githubPagesDefaultBasePath: string;
  githubPagesDefaultUrl: string;
  githubPagesOrigin: string;
  primaryCanonicalDomain: string;
  primaryCanonicalOrigin: string;
  primaryTarget: DeployTarget;
  repositorySlug: string;
  targets: Record<DeployTarget, DeployTargetConfig>;
  trackedConfig: TrackedDeploymentConfig;
  upstreamRepository: boolean;
}

interface DeploymentResolutionOptions {
  env?: Record<string, string | undefined>;
  repositorySlug?: string;
  trackedConfig?: TrackedDeploymentConfig;
}

interface GitHubRepositoryContext {
  defaultRepositorySlug: string;
  githubPagesOwner: string;
  githubPagesRepository: string;
  repositorySlug: string;
}

interface GitHubPagesUrlOptions {
  env?: Record<string, string | undefined>;
  publicOrigin?: string;
  trackedConfig?: TrackedDeploymentConfig;
}

const DEPLOY_TARGET_VALUES: DeployTarget[] = ["aws", "github-pages", "railway", "render"];
const DEFAULT_GITHUB_OWNER =
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG.split("/")[0]?.toLowerCase() ?? "prizz";
const AWS_PLACEHOLDER_ORIGIN = "https://aws.local";
const RAILWAY_PLACEHOLDER_ORIGIN = "https://railway.local";
const RENDER_PLACEHOLDER_ORIGIN = "https://render.local";
const DEFAULT_AWS_PRICE_CLASS: AwsPriceClass = "PriceClass_100";
const DEFAULT_PRIMARY_TARGET: DeployTarget = "github-pages";
const DEFAULT_DEPLOYMENT_RESOURCE_PREFIX = "open-links";
const MAX_AWS_RESOURCE_PREFIX_LENGTH = 48;

const trackedDeploymentConfig = parseTrackedDeploymentConfig(deploymentDefaultsConfigJson);
const deploymentState = resolveDeploymentState();

export function buildDeploymentConfig(state: DeploymentResolutionState) {
  return {
    awsDeployPolicyName: `${state.awsResourcePrefix}-github-deploy`,
    awsDeployRoleName: `${state.awsResourcePrefix}-github-deploy`,
    awsGithubOidcAudience: "sts.amazonaws.com",
    awsGithubOidcProviderUrl: "https://token.actions.githubusercontent.com",
    awsPriceClass: state.awsPriceClass,
    awsRegion: "us-east-1",
    awsResourcePrefix: state.awsResourcePrefix,
    awsStackName: `${state.awsResourcePrefix}-site`,
    bucketNamePrefix: state.awsResourcePrefix,
    enabledTargets: [...state.enabledTargets],
    githubApiVersion: "2022-11-28",
    githubAwsDeployEnabledVariableName: "OPENLINKS_ENABLE_AWS_DEPLOY",
    githubPagesBasePath: state.githubPagesBasePath,
    githubPagesDefaultBasePath: state.githubPagesDefaultBasePath,
    githubPagesDefaultUrl: state.githubPagesDefaultUrl,
    githubPagesEnvironmentName: "github-pages",
    githubPagesOrigin: state.githubPagesOrigin,
    githubProductionEnvironmentName: "production",
    githubRoleArnDigestVariableName: "AWS_DEPLOY_ROLE_ARN_SHA256",
    githubRoleArnSecretName: "AWS_DEPLOY_ROLE_ARN",
    githubWorkflowFileName: "deploy-production.yml",
    htmlCacheControl: "no-cache, no-store, must-revalidate",
    immutableCacheControl: "public, max-age=31536000, immutable",
    metadataCacheControl: "no-cache",
    mutableAssetCacheControl: "public, max-age=300",
    primaryCanonicalDomain: state.primaryCanonicalDomain,
    primaryCanonicalOrigin: state.primaryCanonicalOrigin,
    primaryTarget: state.primaryTarget,
    repositorySlug: state.repositorySlug,
    upstreamRepository: state.upstreamRepository,
  } as const;
}

export const deploymentConfig = buildDeploymentConfig(deploymentState);

export const deployTargets: Record<DeployTarget, DeployTargetConfig> = deploymentState.targets;
export const enabledDeployTargets: DeployTarget[] = [...deploymentState.enabledTargets];

export function parseTrackedDeploymentConfig(input: unknown): TrackedDeploymentConfig {
  const rawConfig =
    input && typeof input === "object" ? (input as Record<string, unknown>) : Object.create(null);
  const primaryTarget = parseDeployTarget(
    typeof rawConfig.primaryTarget === "string" ? rawConfig.primaryTarget : DEFAULT_PRIMARY_TARGET,
  );
  const enabledTargets = normalizeEnabledTargets(rawConfig.enabledTargets, primaryTarget);
  const rawTargets =
    rawConfig.targets && typeof rawConfig.targets === "object"
      ? (rawConfig.targets as Record<string, unknown>)
      : Object.create(null);
  const targets: Partial<Record<DeployTarget, TrackedDeployTargetConfig>> = {};

  for (const target of DEPLOY_TARGET_VALUES) {
    targets[target] = parseTrackedDeployTargetConfig(target, rawTargets[target]);
  }

  return {
    enabledTargets,
    primaryTarget,
    targets,
  };
}

export function getTrackedDeploymentConfig() {
  return cloneTrackedDeploymentConfig(trackedDeploymentConfig);
}

export function getDeploymentState() {
  return resolveDeploymentState();
}

export function resolveDeploymentState(
  options: DeploymentResolutionOptions = {},
): DeploymentResolutionState {
  const env = options.env ?? process.env;
  const nextTrackedConfig = cloneTrackedDeploymentConfig(
    options.trackedConfig ?? trackedDeploymentConfig,
  );
  const repositoryContext = resolveRepositoryContext(env, options.repositorySlug);
  const upstreamRepository = isUpstreamRepository(repositoryContext.repositorySlug);
  const githubPagesDefaultUrl = normalizeOrigin(
    buildDefaultGitHubPagesUrl(repositoryContext.repositorySlug, { env }),
  );
  const githubPagesBasePath = resolveGitHubPagesBasePath(
    nextTrackedConfig,
    repositoryContext.repositorySlug,
    { env },
  );
  const githubPagesPublicOrigin = normalizeOrigin(
    buildGitHubPagesUrl(repositoryContext.repositorySlug, {
      env,
      trackedConfig: nextTrackedConfig,
    }),
  );
  const awsPublicOrigin = resolveAwsPublicOrigin(
    nextTrackedConfig.targets.aws?.publicOrigin,
    env.OPENLINKS_AWS_PUBLIC_ORIGIN ??
      (env.OPENLINKS_DEPLOY_TARGET === "aws" ? env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN : undefined),
  );
  const renderPublicOrigin = resolveRenderPublicOrigin(
    nextTrackedConfig.targets.render?.publicOrigin,
    env.OPENLINKS_DEPLOY_TARGET === "render" ? env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN : undefined,
    env.RENDER_EXTERNAL_URL,
  );
  const railwayPublicOrigin = resolveRailwayPublicOrigin(
    nextTrackedConfig.targets.railway?.publicOrigin,
    env.OPENLINKS_DEPLOY_TARGET === "railway" ? env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN : undefined,
    env.RAILWAY_PUBLIC_DOMAIN,
  );
  const publicOrigins: Record<DeployTarget, string> = {
    aws: normalizeOrigin(awsPublicOrigin),
    "github-pages": githubPagesPublicOrigin,
    railway: normalizeOrigin(railwayPublicOrigin),
    render: normalizeOrigin(renderPublicOrigin),
  };
  const primaryCanonicalOrigin =
    normalizeDeployPublicOrigin(env.OPENLINKS_PRIMARY_CANONICAL_ORIGIN) ??
    publicOrigins[nextTrackedConfig.primaryTarget];
  const awsResourcePrefix = buildAwsResourcePrefix(repositoryContext.repositorySlug);
  const targets = {
    aws: buildDeployTargetConfig(
      {
        basePath: "/",
        id: "aws",
        label: buildDeployTargetLabel("aws", publicOrigins.aws, primaryCanonicalOrigin),
        publicOrigin: publicOrigins.aws,
      },
      primaryCanonicalOrigin,
    ),
    "github-pages": buildDeployTargetConfig(
      {
        basePath: githubPagesBasePath,
        id: "github-pages",
        label: buildDeployTargetLabel(
          "github-pages",
          publicOrigins["github-pages"],
          primaryCanonicalOrigin,
        ),
        publicOrigin: publicOrigins["github-pages"],
      },
      primaryCanonicalOrigin,
    ),
    railway: buildDeployTargetConfig(
      {
        basePath: "/",
        id: "railway",
        label: buildDeployTargetLabel("railway", publicOrigins.railway, primaryCanonicalOrigin),
        publicOrigin: publicOrigins.railway,
      },
      primaryCanonicalOrigin,
    ),
    render: buildDeployTargetConfig(
      {
        basePath: "/",
        id: "render",
        label: buildDeployTargetLabel("render", publicOrigins.render, primaryCanonicalOrigin),
        publicOrigin: publicOrigins.render,
      },
      primaryCanonicalOrigin,
    ),
  } satisfies Record<DeployTarget, DeployTargetConfig>;

  return {
    awsPriceClass: nextTrackedConfig.targets.aws?.priceClass ?? DEFAULT_AWS_PRICE_CLASS,
    awsResourcePrefix,
    defaultRepositorySlug: repositoryContext.defaultRepositorySlug,
    enabledTargets: [...nextTrackedConfig.enabledTargets],
    githubPagesBasePath,
    githubPagesDefaultBasePath: normalizeBasePath(repositoryContext.githubPagesRepository),
    githubPagesDefaultUrl,
    githubPagesOrigin: new URL(publicOrigins["github-pages"]).origin,
    primaryCanonicalDomain: new URL(primaryCanonicalOrigin).hostname,
    primaryCanonicalOrigin,
    primaryTarget: nextTrackedConfig.primaryTarget,
    repositorySlug: repositoryContext.repositorySlug,
    targets,
    trackedConfig: nextTrackedConfig,
    upstreamRepository,
  };
}

export function isDeployTargetEnabled(
  target: DeployTarget,
  maybeTrackedConfig: TrackedDeploymentConfig = trackedDeploymentConfig,
) {
  return maybeTrackedConfig.enabledTargets.includes(target);
}

export function getEnabledDeployTargets() {
  return [...enabledDeployTargets];
}

export function getTrackedDeployTargetConfig(
  target: DeployTarget,
  maybeTrackedConfig: TrackedDeploymentConfig = trackedDeploymentConfig,
) {
  return { ...(maybeTrackedConfig.targets[target] ?? {}) };
}

export function normalizeBasePath(value?: string) {
  if (!value || value.trim().length === 0) {
    return "/";
  }

  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = prefixed.replace(/\/+/g, "/");

  return normalized === "/" ? "/" : `${normalized.replace(/^\/+|\/+$/g, "")}/`.replace(/^/, "/");
}

export function normalizeOrigin(input: string) {
  return input.replace(/\/$/, "");
}

export function normalizeDeployPublicOrigin(input?: string) {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return normalizeOrigin(url.origin);
  } catch {
    return undefined;
  }
}

export function isPlaceholderDeployPublicOrigin(input: string) {
  try {
    const hostname = new URL(normalizeOrigin(input)).hostname.toLowerCase();
    return hostname === "localhost" || hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function normalizeRoutePath(input: string) {
  const withLeadingSlash = input.startsWith("/") ? input : `/${input}`;
  return withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/$/, "");
}

export function parseDeployTarget(input?: string): DeployTarget {
  switch (input?.trim()) {
    case "github-pages":
      return "github-pages";
    case "railway":
      return "railway";
    case "render":
      return "render";
    default:
      return "aws";
  }
}

export function isUpstreamRepository(input: string) {
  return input.trim().toLowerCase() === DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG.toLowerCase();
}

export function buildGitHubPagesUrl(
  maybeRepositorySlug = deploymentState.repositorySlug,
  options: GitHubPagesUrlOptions = {},
) {
  const override =
    normalizeDeployPublicOrigin(options.publicOrigin) ??
    normalizeDeployPublicOrigin(options.trackedConfig?.targets["github-pages"]?.publicOrigin);
  if (override) {
    return `${normalizeOrigin(override)}/`;
  }

  return buildDefaultGitHubPagesUrl(maybeRepositorySlug, options);
}

export function resolvePrimaryCanonicalOrigin(
  maybeRepositorySlug = deploymentState.repositorySlug,
  maybeOverride = process.env.OPENLINKS_PRIMARY_CANONICAL_ORIGIN?.trim(),
  maybeTrackedConfig: TrackedDeploymentConfig = trackedDeploymentConfig,
) {
  const env = {
    ...process.env,
    OPENLINKS_PRIMARY_CANONICAL_ORIGIN: maybeOverride,
  };

  return resolveDeploymentState({
    env,
    repositorySlug: maybeRepositorySlug,
    trackedConfig: maybeTrackedConfig,
  }).primaryCanonicalOrigin;
}

export function getDeployTargetConfig(target: DeployTarget) {
  return deployTargets[target];
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
  const directives = getRobotsTxtDirectivesForPublicOrigin(
    getDeployTargetConfig(target).publicOrigin,
  );

  return ["User-agent: *", ...directives, `Sitemap: ${getCanonicalUrl("/sitemap.xml")}`, ""].join(
    "\n",
  );
}

export function shouldIndexPublicOrigin(
  publicOrigin: string,
  primaryCanonicalOrigin = deploymentConfig.primaryCanonicalOrigin,
) {
  return normalizeOrigin(primaryCanonicalOrigin) === normalizeOrigin(publicOrigin);
}

export function getRobotsMetaContentForPublicOrigin(
  publicOrigin: string,
  primaryCanonicalOrigin = deploymentConfig.primaryCanonicalOrigin,
) {
  return shouldIndexPublicOrigin(publicOrigin, primaryCanonicalOrigin)
    ? "index, follow"
    : "noindex, nofollow";
}

export function getRobotsTxtDirectivesForPublicOrigin(
  publicOrigin: string,
  primaryCanonicalOrigin = deploymentConfig.primaryCanonicalOrigin,
) {
  return shouldIndexPublicOrigin(publicOrigin, primaryCanonicalOrigin)
    ? ["Allow: /"]
    : ["Disallow: /"];
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

export function joinOriginAndRoute(origin: string, route: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedRoute = normalizeRoutePath(route);

  return normalizedRoute === "/" ? `${normalizedOrigin}/` : `${normalizedOrigin}${normalizedRoute}`;
}

export function resolveRenderPublicOrigin(
  maybeTrackedPublicOrigin = trackedDeploymentConfig.targets.render?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRenderExternalUrl = process.env.RENDER_EXTERNAL_URL,
) {
  return (
    normalizeDeployPublicOrigin(maybeTrackedPublicOrigin) ??
    normalizeDeployPublicOrigin(maybeOverride) ??
    normalizeDeployPublicOrigin(maybeRenderExternalUrl) ??
    RENDER_PLACEHOLDER_ORIGIN
  );
}

export function resolveRailwayPublicOrigin(
  maybeTrackedPublicOrigin = trackedDeploymentConfig.targets.railway?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRailwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN,
) {
  return (
    normalizeDeployPublicOrigin(maybeTrackedPublicOrigin) ??
    normalizeDeployPublicOrigin(maybeOverride) ??
    normalizeDeployPublicOrigin(maybeRailwayPublicDomain) ??
    RAILWAY_PLACEHOLDER_ORIGIN
  );
}

export function resolveAwsPublicOrigin(
  maybeTrackedPublicOrigin = trackedDeploymentConfig.targets.aws?.publicOrigin,
  maybeOverride = process.env.OPENLINKS_AWS_PUBLIC_ORIGIN,
) {
  return (
    normalizeDeployPublicOrigin(maybeTrackedPublicOrigin) ??
    normalizeDeployPublicOrigin(maybeOverride) ??
    AWS_PLACEHOLDER_ORIGIN
  );
}

function cloneTrackedDeploymentConfig(input: TrackedDeploymentConfig): TrackedDeploymentConfig {
  return {
    enabledTargets: [...input.enabledTargets],
    primaryTarget: input.primaryTarget,
    targets: Object.fromEntries(
      DEPLOY_TARGET_VALUES.map((target) => [target, { ...(input.targets[target] ?? {}) }]),
    ) as Partial<Record<DeployTarget, TrackedDeployTargetConfig>>,
  };
}

function parseTrackedDeployTargetConfig(
  target: DeployTarget,
  input: unknown,
): TrackedDeployTargetConfig {
  const rawTarget =
    input && typeof input === "object" ? (input as Record<string, unknown>) : Object.create(null);
  const nextTargetConfig: TrackedDeployTargetConfig = {};
  const publicOrigin = normalizeDeployPublicOrigin(
    typeof rawTarget.publicOrigin === "string" ? rawTarget.publicOrigin : undefined,
  );

  if (publicOrigin) {
    nextTargetConfig.publicOrigin = publicOrigin;
  }

  if (target === "aws" && isAwsPriceClass(rawTarget.priceClass)) {
    nextTargetConfig.priceClass = rawTarget.priceClass;
  }

  return nextTargetConfig;
}

function normalizeEnabledTargets(input: unknown, primaryTarget: DeployTarget): DeployTarget[] {
  const rawEntries = Array.isArray(input) ? input : [primaryTarget];
  const normalizedTargets = rawEntries
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => parseDeployTarget(entry));
  const uniqueTargets = Array.from(new Set(normalizedTargets));

  if (!uniqueTargets.includes(primaryTarget)) {
    uniqueTargets.unshift(primaryTarget);
  }

  return uniqueTargets.length > 0 ? uniqueTargets : [primaryTarget];
}

function buildDeployTargetConfig(
  input: Omit<DeployTargetConfig, "shouldIndex">,
  primaryCanonicalOrigin: string,
): DeployTargetConfig {
  const publicOrigin = normalizeOrigin(input.publicOrigin);
  return {
    ...input,
    publicOrigin,
    shouldIndex: shouldIndexPublicOrigin(publicOrigin, primaryCanonicalOrigin),
  };
}

function resolveRepositoryContext(
  env: Record<string, string | undefined> = process.env,
  maybeRepositorySlug?: string,
): GitHubRepositoryContext {
  const githubRepositorySlug =
    normalizeGitHubRepositorySlug(env.GITHUB_REPOSITORY) ?? maybeResolveRepositorySlugFromGit();
  const maybeRepositoryOwner =
    trimToUndefined(env.GITHUB_REPOSITORY_OWNER) || githubRepositorySlug?.split("/")[0] || "";
  const maybeRepositoryName =
    trimToUndefined(env.REPO_NAME_OVERRIDE) ||
    githubRepositorySlug?.split("/")[1] ||
    DEFAULT_GITHUB_REPOSITORY_NAME;
  const defaultRepositorySlug = resolveGitHubRepositorySlug(
    `${maybeRepositoryOwner || DEFAULT_GITHUB_OWNER}/${maybeRepositoryName}`,
    `${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPOSITORY_NAME}`,
  );
  const repositorySlug = resolveGitHubRepositorySlug(
    maybeRepositorySlug ?? env.GITHUB_REPOSITORY,
    defaultRepositorySlug,
  );
  const [maybeResolvedOwner, maybeResolvedRepository] = repositorySlug.split("/");

  return {
    defaultRepositorySlug,
    githubPagesOwner: maybeResolvedOwner?.trim() || maybeRepositoryOwner || DEFAULT_GITHUB_OWNER,
    githubPagesRepository: maybeResolvedRepository?.trim() || maybeRepositoryName,
    repositorySlug,
  };
}

function maybeResolveRepositorySlugFromGit() {
  const maybeBun = (globalThis as { Bun?: { spawnSync: (...args: unknown[]) => unknown } }).Bun;
  if (!maybeBun?.spawnSync) {
    return undefined;
  }

  try {
    const result = maybeBun.spawnSync(["git", "remote", "get-url", "origin"], {
      stderr: "pipe",
      stdout: "pipe",
    }) as {
      exitCode?: number;
      stdout?: Uint8Array | string;
    };
    if (result.exitCode !== 0) {
      return undefined;
    }

    const stdout =
      typeof result.stdout === "string"
        ? result.stdout
        : new TextDecoder().decode(result.stdout ?? new Uint8Array());
    return parseGitHubRepositorySlug(stdout.trim());
  } catch {
    return undefined;
  }
}

function buildDefaultGitHubPagesUrl(
  maybeRepositorySlug = deploymentState.repositorySlug,
  options: { env?: Record<string, string | undefined> } = {},
) {
  const repositoryContext = resolveRepositoryContext(
    options.env ?? process.env,
    maybeRepositorySlug,
  );
  const githubPagesHostOwner = repositoryContext.githubPagesOwner.toLowerCase();

  return `https://${githubPagesHostOwner}.github.io${normalizeBasePath(
    repositoryContext.githubPagesRepository,
  )}`;
}

function resolveGitHubPagesBasePath(
  trackedConfig: TrackedDeploymentConfig,
  repositorySlug: string,
  options: { env?: Record<string, string | undefined> } = {},
) {
  if (trackedConfig.targets["github-pages"]?.publicOrigin) {
    return "/";
  }

  const repositoryContext = resolveRepositoryContext(options.env ?? process.env, repositorySlug);
  return normalizeBasePath(repositoryContext.githubPagesRepository);
}

function buildDeployTargetLabel(
  target: DeployTarget,
  publicOrigin: string,
  primaryCanonicalOrigin: string,
) {
  const isPrimary = shouldIndexPublicOrigin(publicOrigin, primaryCanonicalOrigin);

  switch (target) {
    case "aws":
      return isPrimary ? "AWS primary site" : "AWS mirror";
    case "github-pages":
      return isPrimary ? "GitHub Pages primary site" : "GitHub Pages mirror";
    case "railway":
      return isPrimary ? "Railway primary site" : "Railway mirror";
    case "render":
      return isPrimary ? "Render primary site" : "Render mirror";
  }
}

function buildAwsResourcePrefix(repositorySlug: string) {
  const slugToken = repositorySlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const candidate = `${DEFAULT_DEPLOYMENT_RESOURCE_PREFIX}-${slugToken}`;
  return candidate.slice(0, MAX_AWS_RESOURCE_PREFIX_LENGTH).replace(/-+$/g, "");
}

function isAwsPriceClass(value: unknown): value is AwsPriceClass {
  return value === "PriceClass_100" || value === "PriceClass_200" || value === "PriceClass_All";
}
