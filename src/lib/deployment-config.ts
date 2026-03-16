export type DeployTarget = "aws" | "github-pages";

export interface DeployTargetConfig {
  id: DeployTarget;
  label: string;
  basePath: string;
  publicOrigin: string;
  shouldIndex: boolean;
}

const DEFAULT_GITHUB_OWNER = "prizz";
const DEFAULT_GITHUB_REPOSITORY = "open-links";
const DEFAULT_UPSTREAM_REPOSITORY_SLUG = `${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPOSITORY}`;
const PRIMARY_CANONICAL_DOMAIN = "openlinks.us";

const githubPagesOwner =
  process.env.GITHUB_REPOSITORY_OWNER?.trim() || process.env.GITHUB_REPOSITORY?.split("/")[0] || "";
const githubPagesRepository =
  process.env.REPO_NAME_OVERRIDE?.trim() ||
  process.env.GITHUB_REPOSITORY?.split("/")[1] ||
  DEFAULT_GITHUB_REPOSITORY;
const githubPagesOrigin = `https://${githubPagesOwner || DEFAULT_GITHUB_OWNER}.github.io`;
const githubPagesBasePath = normalizeBasePath(githubPagesRepository);
const defaultRepositorySlug = `${githubPagesOwner || DEFAULT_GITHUB_OWNER}/${githubPagesRepository}`;
const githubPagesUrl = buildGitHubPagesUrl(defaultRepositorySlug);
const repositorySlug = process.env.GITHUB_REPOSITORY?.trim() || defaultRepositorySlug;
const primaryCanonicalOrigin = resolvePrimaryCanonicalOrigin(repositorySlug);
const githubPagesIsMirror =
  normalizeOrigin(githubPagesUrl) !== normalizeOrigin(primaryCanonicalOrigin);

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
  aws: {
    id: "aws",
    label: "AWS canonical site",
    basePath: "/",
    publicOrigin: deploymentConfig.primaryCanonicalOrigin,
    shouldIndex: true,
  },
  "github-pages": {
    id: "github-pages",
    label: githubPagesIsMirror ? "GitHub Pages mirror" : "GitHub Pages site",
    basePath: deploymentConfig.githubPagesBasePath,
    publicOrigin: githubPagesUrl,
    shouldIndex: !githubPagesIsMirror,
  },
};

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

export function normalizeRoutePath(input: string) {
  const withLeadingSlash = input.startsWith("/") ? input : `/${input}`;
  return withLeadingSlash === "/" ? "/" : withLeadingSlash.replace(/\/$/, "");
}

export function parseDeployTarget(input?: string): DeployTarget {
  return input === "github-pages" ? "github-pages" : "aws";
}

export function isUpstreamRepository(input: string) {
  return input.trim().toLowerCase() === DEFAULT_UPSTREAM_REPOSITORY_SLUG.toLowerCase();
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
  return target === "aws" ? deploymentConfig.githubPagesBasePath : "/assets/";
}

export function joinOriginAndRoute(origin: string, route: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const normalizedRoute = normalizeRoutePath(route);

  return normalizedRoute === "/" ? `${normalizedOrigin}/` : `${normalizedOrigin}${normalizedRoute}`;
}
