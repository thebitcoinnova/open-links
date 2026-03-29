import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubPagesUrl,
  deploymentConfig,
  getCanonicalUrl,
  getDeployTargetConfig,
  getPublicUrl,
  getRobotsMetaContent,
  getRobotsMetaContentForPublicOrigin,
  getRobotsTxt,
  isUpstreamRepository,
  normalizeBasePath,
  normalizeDeployPublicOrigin,
  parseDeployTarget,
  resolvePrimaryCanonicalOrigin,
  resolveRailwayPublicOrigin,
  resolveRenderPublicOrigin,
  shouldIndexPublicOrigin,
} from "./deployment-config";

test("canonical urls follow the resolved primary origin for the active repository", () => {
  // Arrange / Act
  const homeUrl = getCanonicalUrl("/");
  const aboutUrl = getCanonicalUrl("/about");

  // Assert
  assert.equal(homeUrl, `${deploymentConfig.primaryCanonicalOrigin}/`);
  assert.equal(aboutUrl, `${deploymentConfig.primaryCanonicalOrigin}/about`);
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
  assert.equal(getRobotsMetaContent("aws"), "index, follow");

  const githubPagesShouldIndex = getDeployTargetConfig("github-pages").shouldIndex;
  assert.match(
    getRobotsTxt("github-pages"),
    githubPagesShouldIndex ? /Allow: \//u : /Disallow: \//u,
  );
  assert.equal(
    getRobotsMetaContent("github-pages"),
    githubPagesShouldIndex ? "index, follow" : "noindex, nofollow",
  );
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
  assert.equal(resolvePrimaryCanonicalOrigin("prizz/open-links"), "https://openlinks.us");
  assert.equal(
    resolvePrimaryCanonicalOrigin("someone/open-links-fork"),
    "https://someone.github.io/open-links-fork",
  );
  assert.equal(getCanonicalUrl("/"), `${deploymentConfig.primaryCanonicalOrigin}/`);
});

test("indexability helpers stay correct for both upstream and fork repository origins", () => {
  // Arrange
  const scenarios = [
    {
      expectedGithubPagesRobots: "noindex, nofollow",
      expectedGithubPagesShouldIndex: false,
      repositorySlug: "prizz/open-links",
    },
    {
      expectedGithubPagesRobots: "index, follow",
      expectedGithubPagesShouldIndex: true,
      repositorySlug: "someone/open-links-fork",
    },
  ] as const;

  for (const scenario of scenarios) {
    // Act
    const primaryCanonicalOrigin = resolvePrimaryCanonicalOrigin(scenario.repositorySlug);
    const githubPagesOrigin = buildGitHubPagesUrl(scenario.repositorySlug);

    // Assert
    assert.equal(
      shouldIndexPublicOrigin(githubPagesOrigin, primaryCanonicalOrigin),
      scenario.expectedGithubPagesShouldIndex,
    );
    assert.equal(
      getRobotsMetaContentForPublicOrigin(githubPagesOrigin, primaryCanonicalOrigin),
      scenario.expectedGithubPagesRobots,
    );
    assert.equal(
      getRobotsMetaContentForPublicOrigin(
        "https://open-links.onrender.com",
        primaryCanonicalOrigin,
      ),
      "noindex, nofollow",
    );
    assert.equal(
      getRobotsMetaContentForPublicOrigin(
        "https://open-links-production.up.railway.app",
        primaryCanonicalOrigin,
      ),
      "noindex, nofollow",
    );
  }
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
