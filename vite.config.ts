import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import profileData from "./data/profile.json";
import siteData from "./data/site.json";
import {
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "./src/lib/seo/resolve-seo-metadata";

const repositoryName =
  process.env.REPO_NAME_OVERRIDE?.trim() || process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
const baseModeRaw = process.env.PAGES_BASE_MODE?.trim().toLowerCase();
const explicitBasePath = process.env.BASE_PATH?.trim();

const normalizeBasePath = (value: string): string => {
  const prefixed = value.startsWith("/") ? value : `/${value}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
};

const projectBasePath = repositoryName ? `/${repositoryName}/` : "/";

const resolveBasePath = (): string => {
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
const buildTimestamp = process.env.OPENLINKS_BUILD_TIMESTAMP ?? new Date().toISOString();

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const buildSeoTokenMap = (): Record<string, string> => {
  const { metadata } = resolveSeoMetadata(siteData, profileData, {
    resolveImagePath: (candidate) =>
      resolveBaseAwareAssetPath(
        candidate,
        resolveBasePathFromUrl(siteData.quality?.seo?.canonicalBaseUrl ?? base),
      ),
  });

  return {
    __OPENLINKS_SEO_TITLE__: metadata.title,
    __OPENLINKS_SEO_DESCRIPTION__: metadata.description,
    __OPENLINKS_SEO_CANONICAL__: metadata.canonical,
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
  },
  base,
});
