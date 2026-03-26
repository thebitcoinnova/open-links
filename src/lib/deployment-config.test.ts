import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubPagesUrl,
  deploymentConfig,
  getCanonicalUrl,
  getDeployTargetConfig,
  getPublicUrl,
  getRobotsMetaContent,
  getRobotsTxt,
  isUpstreamRepository,
  normalizeBasePath,
  normalizeDeployPublicOrigin,
  parseDeployTarget,
  resolvePrimaryCanonicalOrigin,
  resolveRailwayPublicOrigin,
  resolveRenderPublicOrigin,
} from "./deployment-config";

test("canonical urls always point at the primary openlinks.us host", () => {
  // Arrange / Act
  const homeUrl = getCanonicalUrl("/");
  const aboutUrl = getCanonicalUrl("/about");

  // Assert
  assert.equal(homeUrl, "https://openlinks.us/");
  assert.equal(aboutUrl, "https://openlinks.us/about");
});

test("github pages public urls include the repository base path", () => {
  // Arrange / Act
  const homeUrl = getPublicUrl("github-pages", "/");
  const routeUrl = getPublicUrl("github-pages", "/links");

  // Assert
  assert.equal(
    homeUrl,
    `${deploymentConfig.githubPagesOrigin}${deploymentConfig.githubPagesBasePath}`,
  );
  assert.equal(
    routeUrl,
    `${deploymentConfig.githubPagesOrigin}${deploymentConfig.githubPagesBasePath}links`,
  );
});

test("robots helpers distinguish the indexable canonical site from the pages mirror", () => {
  // Arrange / Act / Assert
  assert.match(getRobotsTxt("aws"), /Allow: \//u);
  assert.match(getRobotsTxt("github-pages"), /Disallow: \//u);
  assert.equal(getRobotsMetaContent("aws"), "index, follow");
  assert.equal(getRobotsMetaContent("github-pages"), "noindex, nofollow");
});

test("base path normalization and target parsing stay stable for deploy scripts", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeBasePath("open-links"), "/open-links/");
  assert.equal(normalizeBasePath("/open-links/"), "/open-links/");
  assert.equal(normalizeBasePath(""), "/");
  assert.equal(parseDeployTarget("github-pages"), "github-pages");
  assert.equal(parseDeployTarget("render"), "render");
  assert.equal(parseDeployTarget("railway"), "railway");
  assert.equal(parseDeployTarget("unexpected"), "aws");
});

test("fork repositories default canonical origin to their pages url until aws is configured", () => {
  // Arrange / Act / Assert
  assert.equal(isUpstreamRepository("prizz/open-links"), true);
  assert.equal(isUpstreamRepository("someone/open-links-fork"), false);
  assert.equal(
    buildGitHubPagesUrl("someone/open-links-fork"),
    "https://someone.github.io/open-links-fork/",
  );
  assert.equal(
    resolvePrimaryCanonicalOrigin("someone/open-links-fork"),
    "https://someone.github.io/open-links-fork",
  );
});

test("provider public-origin helpers normalize overrides and provider variables", () => {
  // Arrange / Act / Assert
  assert.equal(normalizeDeployPublicOrigin("railway.example.com"), "https://railway.example.com");
  assert.equal(
    resolveRenderPublicOrigin(undefined, "https://open-links.onrender.com"),
    "https://open-links.onrender.com",
  );
  assert.equal(
    resolveRailwayPublicOrigin(undefined, "open-links-production.up.railway.app"),
    "https://open-links-production.up.railway.app",
  );
  assert.equal(
    resolveRenderPublicOrigin("https://custom.example.com", "https://ignored.onrender.com"),
    "https://custom.example.com",
  );
});

test("root-path provider targets stay mirrors until their public url matches the primary canonical origin", () => {
  // Arrange / Act
  const renderTarget = getDeployTargetConfig("render");
  const railwayTarget = getDeployTargetConfig("railway");

  // Assert
  assert.equal(renderTarget.basePath, "/");
  assert.equal(railwayTarget.basePath, "/");
  assert.equal(renderTarget.shouldIndex, false);
  assert.equal(railwayTarget.shouldIndex, false);
  assert.equal(getRobotsMetaContent("render"), "noindex, nofollow");
  assert.equal(getRobotsMetaContent("railway"), "noindex, nofollow");
});
