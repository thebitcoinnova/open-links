import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import profileData from "./data/profile.json";
import siteData from "./data/site.json";
import { resolveStableBuildTimestamp } from "./scripts/lib/build-timestamp";
import {
  deploymentConfig,
  getDeployTargetConfig,
  getRobotsMetaContent,
  parseDeployTarget,
} from "./src/lib/deployment-config";
import {
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
  normalizeGitHubRepositorySlug,
  resolveGitHubRepositoryRef,
  resolveGitHubRepositorySlug,
  trimToUndefined,
} from "./src/lib/github-repository";
import {
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "./src/lib/seo/resolve-seo-metadata";

const repositoryName =
  trimToUndefined(process.env.REPO_NAME_OVERRIDE) ||
  normalizeGitHubRepositorySlug(process.env.GITHUB_REPOSITORY)?.split("/")[1] ||
  "";
const repositorySlug = resolveGitHubRepositorySlug(
  process.env.GITHUB_REPOSITORY,
  DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
);
const repositoryDocsRef = resolveGitHubRepositoryRef(process.env.OPENLINKS_REPOSITORY_DOCS_REF);
const deployTargetRaw = process.env.OPENLINKS_DEPLOY_TARGET?.trim();
const baseModeRaw = process.env.PAGES_BASE_MODE?.trim().toLowerCase();
const explicitBasePath = process.env.BASE_PATH?.trim();

const normalizeBasePath = (value: string): string => {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
};

const projectBasePath = repositoryName ? `/${repositoryName}/` : "/";

const resolveBasePath = (): string => {
  if (deployTargetRaw) {
    return getDeployTargetConfig(parseDeployTarget(deployTargetRaw)).basePath;
  }

  if (explicitBasePath) {
    return normalizeBasePath(explicitBasePath);
  }

  switch (baseModeRaw) {
    case "root":
      return "/";
    case "auto":
      return process.env.GITHUB_ACTIONS ? projectBasePath : "/";
    default:
      return projectBasePath;
  }
};

const base = resolveBasePath();
const deployTarget = deployTargetRaw ? parseDeployTarget(deployTargetRaw) : null;
const buildTimestamp = resolveStableBuildTimestamp({
  explicitValue: process.env.OPENLINKS_BUILD_TIMESTAMP,
});

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildSeoTokenMap = (): Record<string, string> => {
  const canonicalBaseUrl = deployTarget
    ? `${deploymentConfig.primaryCanonicalOrigin}/`
    : (siteData.quality?.seo?.canonicalBaseUrl ?? base);
  const seoSite =
    deployTarget === null
      ? siteData
      : {
          ...siteData,
          quality: {
            ...siteData.quality,
            seo: {
              ...siteData.quality?.seo,
              canonicalBaseUrl,
            },
          },
        };
  const { metadata } = resolveSeoMetadata(seoSite, profileData, {
    fallbackOrigin: canonicalBaseUrl,
    resolveImagePath: (candidate) =>
      resolveBaseAwareAssetPath(candidate, resolveBasePathFromUrl(canonicalBaseUrl)),
  });

  return {
    __OPENLINKS_SEO_TITLE__: metadata.title,
    __OPENLINKS_SEO_DESCRIPTION__: metadata.description,
    __OPENLINKS_SEO_CANONICAL__: metadata.canonical,
    __OPENLINKS_SEO_ROBOTS__: deployTarget ? getRobotsMetaContent(deployTarget) : "index, follow",
    __OPENLINKS_SEO_OG_TITLE__: metadata.ogTitle,
    __OPENLINKS_SEO_OG_DESCRIPTION__: metadata.ogDescription,
    __OPENLINKS_SEO_OG_TYPE__: metadata.ogType,
    __OPENLINKS_SEO_OG_URL__: metadata.ogUrl,
    __OPENLINKS_SEO_OG_IMAGE__: metadata.ogImage,
    __OPENLINKS_SEO_TWITTER_CARD__: metadata.twitterCard,
    __OPENLINKS_SEO_TWITTER_TITLE__: metadata.twitterTitle,
    __OPENLINKS_SEO_TWITTER_DESCRIPTION__: metadata.twitterDescription,
    __OPENLINKS_SEO_TWITTER_IMAGE__: metadata.twitterImage,
  };
};

const replaceSeoTokens = (html: string): string => {
  let output = html;

  for (const [token, value] of Object.entries(buildSeoTokenMap())) {
    output = output.replaceAll(token, escapeHtml(value));
  }

  return output;
};

export default defineConfig({
  plugins: [
    {
      name: "openlinks-seo-html",
      transformIndexHtml(html) {
        return replaceSeoTokens(html);
      },
    },
    solidPlugin(),
  ],
  build: {
    target: "esnext",
  },
  define: {
    __OPENLINKS_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __OPENLINKS_CANONICAL_ORIGIN__: JSON.stringify(
      deployTarget
        ? deploymentConfig.primaryCanonicalOrigin
        : (siteData.quality?.seo?.canonicalBaseUrl ?? ""),
    ),
    __OPENLINKS_REPOSITORY_SLUG__: JSON.stringify(repositorySlug),
    __OPENLINKS_REPOSITORY_DOCS_REF__: JSON.stringify(repositoryDocsRef),
  },
  base,
});
