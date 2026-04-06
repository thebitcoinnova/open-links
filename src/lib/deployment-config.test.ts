import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeploymentConfig,
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
  parseTrackedDeploymentConfig,
  resolveDeploymentState,
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

test("upstream defaults resolve to the open-links AWS reuse naming", () => {
  // Arrange / Act
  const state = resolveDeploymentState({
    repositorySlug: "pRizz/open-links",
  });
  const config = buildDeploymentConfig(state);

  // Assert
  assert.equal(state.awsResourcePrefix, "open-links");
  assert.equal(config.awsStackName, "open-links-site");
  assert.equal(config.bucketNamePrefix, "open-links");
  assert.equal(config.awsDeployRoleName, "open-links-github-deploy");
  assert.equal(config.awsDeployPolicyName, "open-links-github-deploy");
});

test("github pages public urls include the repository base path in the default topology", () => {
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

test("github pages public urls normalize mixed-case owners to lowercase hosts", () => {
  // Arrange / Act
  const mixedCasePagesUrl = buildGitHubPagesUrl("pRizz/open-links");
  const mixedCasePagesState = resolveDeploymentState({
    repositorySlug: "pRizz/open-links",
    trackedConfig: parseTrackedDeploymentConfig({
      enabledTargets: ["github-pages"],
      primaryTarget: "github-pages",
    }),
  });

  // Assert
  assert.equal(mixedCasePagesUrl, "https://prizz.github.io/open-links/");
  assert.equal(
    mixedCasePagesState.targets["github-pages"].publicOrigin,
    "https://prizz.github.io/open-links",
  );
});

test("module-level robots helpers follow the active effective topology", () => {
  // Arrange / Act / Assert
  assert.match(getRobotsTxt("aws"), /Disallow: \//u);
  assert.equal(getRobotsMetaContent("aws"), "noindex, nofollow");
  assert.match(getRobotsTxt("github-pages"), /Allow: \//u);
  assert.equal(getRobotsMetaContent("github-pages"), "index, follow");
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

test("explicit tracked configs still model upstream AWS-primary and fork Pages-primary topologies", () => {
  // Arrange / Act / Assert
  const upstreamAwsPrimary = parseTrackedDeploymentConfig({
    enabledTargets: ["aws", "github-pages"],
    primaryTarget: "aws",
    targets: {
      aws: {
        publicOrigin: "https://openlinks.us",
      },
    },
  });

  assert.equal(isUpstreamRepository("prizz/open-links"), true);
  assert.equal(isUpstreamRepository("someone/open-links-fork"), false);
  assert.equal(
    buildGitHubPagesUrl("someone/open-links-fork"),
    "https://someone.github.io/open-links-fork/",
  );
  assert.equal(
    resolvePrimaryCanonicalOrigin("prizz/open-links", undefined, upstreamAwsPrimary),
    "https://openlinks.us",
  );
  assert.equal(
    resolvePrimaryCanonicalOrigin(
      "someone/open-links-fork",
      undefined,
      parseTrackedDeploymentConfig({
        enabledTargets: ["github-pages"],
        primaryTarget: "github-pages",
      }),
    ),
    "https://someone.github.io/open-links-fork",
  );
});

test("explicit AWS-primary topologies drive indexing and mirrors for upstream and forks", () => {
  // Arrange
  const upstreamAwsPrimary = parseTrackedDeploymentConfig({
    enabledTargets: ["aws", "github-pages"],
    primaryTarget: "aws",
    targets: {
      aws: {
        publicOrigin: "https://openlinks.us",
      },
    },
  });
  const forkAwsPrimary = parseTrackedDeploymentConfig({
    enabledTargets: ["aws", "github-pages"],
    primaryTarget: "aws",
    targets: {
      aws: {
        publicOrigin: "https://links.example.com",
      },
    },
  });

  // Act
  const upstreamState = resolveDeploymentState({
    repositorySlug: "prizz/open-links",
    trackedConfig: upstreamAwsPrimary,
  });
  const forkState = resolveDeploymentState({
    repositorySlug: "someone/open-links-fork",
    trackedConfig: forkAwsPrimary,
  });

  // Assert
  assert.equal(upstreamState.primaryCanonicalOrigin, "https://openlinks.us");
  assert.equal(upstreamState.targets.aws.shouldIndex, true);
  assert.equal(upstreamState.targets["github-pages"].shouldIndex, false);
  assert.equal(
    upstreamState.targets["github-pages"].publicOrigin,
    "https://prizz.github.io/open-links",
  );
  assert.equal(forkState.primaryCanonicalOrigin, "https://links.example.com");
  assert.equal(forkState.targets.aws.shouldIndex, true);
  assert.equal(forkState.targets["github-pages"].shouldIndex, false);
  assert.equal(
    forkState.targets["github-pages"].publicOrigin,
    "https://someone.github.io/open-links-fork",
  );
});

test("aws resourcePrefix overrides slug-derived upstream resource naming", () => {
  // Arrange
  const trackedConfig = parseTrackedDeploymentConfig({
    enabledTargets: ["aws", "github-pages"],
    primaryTarget: "aws",
    targets: {
      aws: {
        publicOrigin: "https://openlinks.us",
        resourcePrefix: "open-links",
      },
    },
  });

  // Act
  const state = resolveDeploymentState({
    repositorySlug: "pRizz/open-links",
    trackedConfig,
  });
  const config = buildDeploymentConfig(state);

  // Assert
  assert.equal(state.awsResourcePrefix, "open-links");
  assert.equal(config.awsStackName, "open-links-site");
  assert.equal(config.bucketNamePrefix, "open-links");
  assert.equal(config.awsDeployRoleName, "open-links-github-deploy");
  assert.equal(config.awsDeployPolicyName, "open-links-github-deploy");
});

test("pages custom-domain overrides keep github pages on the root path without changing app code", () => {
  // Arrange
  const customDomainPages = parseTrackedDeploymentConfig({
    enabledTargets: ["github-pages"],
    primaryTarget: "github-pages",
    targets: {
      "github-pages": {
        publicOrigin: "https://links.example.com",
      },
    },
  });

  // Act
  const state = resolveDeploymentState({
    repositorySlug: "someone/open-links-fork",
    trackedConfig: customDomainPages,
  });

  // Assert
  assert.equal(state.primaryCanonicalOrigin, "https://links.example.com");
  assert.equal(state.targets["github-pages"].publicOrigin, "https://links.example.com");
  assert.equal(state.targets["github-pages"].basePath, "/");
  assert.equal(state.targets["github-pages"].shouldIndex, true);
  assert.equal(state.targets.aws.shouldIndex, false);
  assert.equal(
    buildGitHubPagesUrl("someone/open-links-fork", {
      trackedConfig: customDomainPages,
    }),
    "https://links.example.com/",
  );
});

test("indexability helpers stay correct for the default and explicit topologies", () => {
  // Arrange
  const explicitAwsPrimary = parseTrackedDeploymentConfig({
    enabledTargets: ["aws", "github-pages"],
    primaryTarget: "aws",
    targets: {
      aws: {
        publicOrigin: "https://links.example.com",
      },
    },
  });
  const pagesPrimaryConfig = parseTrackedDeploymentConfig({
    enabledTargets: ["github-pages"],
    primaryTarget: "github-pages",
  });
  const pagesPrimaryOrigin = resolvePrimaryCanonicalOrigin(
    "someone/open-links-fork",
    undefined,
    pagesPrimaryConfig,
  );
  const pagesPrimaryPagesOrigin = buildGitHubPagesUrl("someone/open-links-fork", {
    trackedConfig: pagesPrimaryConfig,
  });
  const awsPrimaryState = resolveDeploymentState({
    repositorySlug: "someone/open-links-fork",
    trackedConfig: explicitAwsPrimary,
  });

  // Act / Assert
  assert.equal(shouldIndexPublicOrigin(pagesPrimaryPagesOrigin, pagesPrimaryOrigin), true);
  assert.equal(
    getRobotsMetaContentForPublicOrigin(pagesPrimaryPagesOrigin, pagesPrimaryOrigin),
    "index, follow",
  );
  assert.equal(
    shouldIndexPublicOrigin(
      awsPrimaryState.targets["github-pages"].publicOrigin,
      awsPrimaryState.primaryCanonicalOrigin,
    ),
    false,
  );
  assert.equal(
    getRobotsMetaContentForPublicOrigin(
      awsPrimaryState.targets["github-pages"].publicOrigin,
      awsPrimaryState.primaryCanonicalOrigin,
    ),
    "noindex, nofollow",
  );
  assert.equal(
    getRobotsMetaContentForPublicOrigin(
      awsPrimaryState.targets.aws.publicOrigin,
      awsPrimaryState.primaryCanonicalOrigin,
    ),
    "index, follow",
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
