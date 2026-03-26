import {
  DEFAULT_GITHUB_REPOSITORY_NAME,
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
  normalizeGitHubRepositorySlug,
  resolveGitHubRepositorySlug,
} from "./github-repository";

export type DeployTarget = "aws" | "github-pages" | "railway" | "render";

export interface DeployTargetConfig {
  id: DeployTarget;
  label: string;
  basePath: string;
  publicOrigin: string;
  shouldIndex: boolean;
}

const DEFAULT_GITHUB_OWNER =
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG.split("/")[0]?.toLowerCase() ?? "prizz";
const DEFAULT_GITHUB_REPOSITORY = DEFAULT_GITHUB_REPOSITORY_NAME;
const PRIMARY_CANONICAL_DOMAIN = "openlinks.us";
const RAILWAY_PLACEHOLDER_ORIGIN = "https://railway.local";
const RENDER_PLACEHOLDER_ORIGIN = "https://render.local";

const githubRepositorySlug = normalizeGitHubRepositorySlug(process.env.GITHUB_REPOSITORY);

const githubPagesOwner =
  process.env.GITHUB_REPOSITORY_OWNER?.trim() || githubRepositorySlug?.split("/")[0] || "";
const githubPagesRepository =
  process.env.REPO_NAME_OVERRIDE?.trim() ||
  githubRepositorySlug?.split("/")[1] ||
  DEFAULT_GITHUB_REPOSITORY;
const githubPagesOrigin = `https://${githubPagesOwner || DEFAULT_GITHUB_OWNER}.github.io`;
const githubPagesBasePath = normalizeBasePath(githubPagesRepository);
const defaultRepositorySlug = resolveGitHubRepositorySlug(
  `${githubPagesOwner || DEFAULT_GITHUB_OWNER}/${githubPagesRepository}`,
  `${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPOSITORY}`,
);
const githubPagesUrl = buildGitHubPagesUrl(defaultRepositorySlug);
const repositorySlug = resolveGitHubRepositorySlug(
  process.env.GITHUB_REPOSITORY,
  defaultRepositorySlug,
);
const primaryCanonicalOrigin = resolvePrimaryCanonicalOrigin(repositorySlug);
const githubPagesIsMirror =
  normalizeOrigin(githubPagesUrl) !== normalizeOrigin(primaryCanonicalOrigin);
const renderPublicOrigin = resolveRenderPublicOrigin();
const railwayPublicOrigin = resolveRailwayPublicOrigin();

export const deploymentConfig = {
  awsRegion: "us-east-1",
  bucketNamePrefix: "open-links-site",
  awsStackName: "open-links-site",
  awsDeployPolicyName: "open-links-github-deploy",
  awsDeployRoleName: "open-links-github-deploy",
  awsGithubOidcAudience: "sts.amazonaws.com",
  awsGithubOidcProviderUrl: "https://token.actions.githubusercontent.com",
  primaryCanonicalDomain: new URL(primaryCanonicalOrigin).hostname,
  primaryCanonicalOrigin,
  githubApiVersion: "2022-11-28",
  githubAwsDeployEnabledVariableName: "OPENLINKS_ENABLE_AWS_DEPLOY",
  githubPagesBasePath,
  githubPagesEnvironmentName: "github-pages",
  githubPagesOrigin,
  githubProductionEnvironmentName: "production",
  githubRoleArnDigestVariableName: "AWS_DEPLOY_ROLE_ARN_SHA256",
  githubRoleArnSecretName: "AWS_DEPLOY_ROLE_ARN",
  githubWorkflowFileName: "deploy-pages.yml",
  htmlCacheControl: "no-cache, no-store, must-revalidate",
  immutableCacheControl: "public, max-age=31536000, immutable",
  metadataCacheControl: "no-cache",
  mutableAssetCacheControl: "public, max-age=300",
} as const;

export const deployTargets: Record<DeployTarget, DeployTargetConfig> = {
  aws: buildDeployTargetConfig({
    basePath: "/",
    id: "aws",
    label: "AWS canonical site",
    publicOrigin: deploymentConfig.primaryCanonicalOrigin,
  }),
  "github-pages": buildDeployTargetConfig({
    basePath: deploymentConfig.githubPagesBasePath,
    id: "github-pages",
    label: githubPagesIsMirror ? "GitHub Pages mirror" : "GitHub Pages site",
    publicOrigin: githubPagesUrl,
  }),
  railway: buildDeployTargetConfig({
    basePath: "/",
    id: "railway",
    label:
      normalizeOrigin(railwayPublicOrigin) ===
      normalizeOrigin(deploymentConfig.primaryCanonicalOrigin)
        ? "Railway primary site"
        : "Railway mirror",
    publicOrigin: railwayPublicOrigin,
  }),
  render: buildDeployTargetConfig({
    basePath: "/",
    id: "render",
    label:
      normalizeOrigin(renderPublicOrigin) ===
      normalizeOrigin(deploymentConfig.primaryCanonicalOrigin)
        ? "Render primary site"
        : "Render mirror",
    publicOrigin: renderPublicOrigin,
  }),
};

function buildDeployTargetConfig(
  input: Omit<DeployTargetConfig, "shouldIndex">,
): DeployTargetConfig {
  const publicOrigin = normalizeOrigin(input.publicOrigin);
  return {
    ...input,
    publicOrigin,
    shouldIndex:
      normalizeOrigin(deploymentConfig.primaryCanonicalOrigin) === normalizeOrigin(publicOrigin),
  };
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

export function buildGitHubPagesUrl(maybeRepositorySlug = defaultRepositorySlug) {
  const [maybeOwner, maybeRepository] = maybeRepositorySlug.split("/");
  const owner = maybeOwner?.trim() || githubPagesOwner || DEFAULT_GITHUB_OWNER;
  const repository = maybeRepository?.trim() || githubPagesRepository;
  return `https://${owner}.github.io${normalizeBasePath(repository)}`;
}

export function resolvePrimaryCanonicalOrigin(
  maybeRepositorySlug = defaultRepositorySlug,
  maybeOverride = process.env.OPENLINKS_PRIMARY_CANONICAL_ORIGIN?.trim(),
) {
  if (maybeOverride) {
    return normalizeOrigin(maybeOverride);
  }

  if (isUpstreamRepository(maybeRepositorySlug)) {
    return `https://${PRIMARY_CANONICAL_DOMAIN}`;
  }

  return normalizeOrigin(buildGitHubPagesUrl(maybeRepositorySlug));
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
  return getDeployTargetConfig(target).shouldIndex ? "index, follow" : "noindex, nofollow";
}

export function getRobotsTxt(target: DeployTarget) {
  const directives = getDeployTargetConfig(target).shouldIndex ? ["Allow: /"] : ["Disallow: /"];

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
    ? deploymentConfig.githubPagesBasePath
    : "/assets/";
}

export function joinOriginAndRoute(origin: string, route: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedRoute = normalizeRoutePath(route);

  return normalizedRoute === "/" ? `${normalizedOrigin}/` : `${normalizedOrigin}${normalizedRoute}`;
}

export function resolveRenderPublicOrigin(
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRenderExternalUrl = process.env.RENDER_EXTERNAL_URL,
) {
  return (
    normalizeDeployPublicOrigin(maybeOverride) ??
    normalizeDeployPublicOrigin(maybeRenderExternalUrl) ??
    RENDER_PLACEHOLDER_ORIGIN
  );
}

export function resolveRailwayPublicOrigin(
  maybeOverride = process.env.OPENLINKS_DEPLOY_PUBLIC_ORIGIN,
  maybeRailwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN,
) {
  return (
    normalizeDeployPublicOrigin(maybeOverride) ??
    normalizeDeployPublicOrigin(maybeRailwayPublicDomain) ??
    RAILWAY_PLACEHOLDER_ORIGIN
  );
}
