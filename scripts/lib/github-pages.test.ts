import { test } from "bun:test";
import assert from "node:assert/strict";
import {
  classifyPagesDeploymentStatus,
  loadCreatePagesDeploymentEnv,
  loadWaitForPagesDeploymentEnv,
  waitForPagesDeployment,
} from "./github-pages";

const jsonResponse = (value: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(value), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });

test("loadCreatePagesDeploymentEnv prefers explicit pages build version when provided", () => {
  // Arrange
  const env = {
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "token",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.example.com",
    ARTIFACT_ID: "42",
    GITHUB_OUTPUT: "/tmp/github-output",
    GITHUB_REPOSITORY: "someone/open-links",
    GITHUB_SHA: "workflow-sha",
    GITHUB_TOKEN: "github-token",
    PAGES_BUILD_VERSION: "artifact-sha",
  };

  // Act
  const result = loadCreatePagesDeploymentEnv(env);

  // Assert
  assert.equal(result.pagesBuildVersion, "artifact-sha");
});

test("loadCreatePagesDeploymentEnv falls back to workflow GITHUB_SHA when no override is provided", () => {
  // Arrange
  const env = {
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "token",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.example.com",
    ARTIFACT_ID: "42",
    GITHUB_OUTPUT: "/tmp/github-output",
    GITHUB_REPOSITORY: "someone/open-links",
    GITHUB_SHA: "workflow-sha",
    GITHUB_TOKEN: "github-token",
  };

  // Act
  const result = loadCreatePagesDeploymentEnv(env);

  // Assert
  assert.equal(result.pagesBuildVersion, "workflow-sha");
});

test("loadWaitForPagesDeploymentEnv captures optional public readiness inputs", () => {
  // Arrange
  const env = {
    DEPLOYMENT_ID: "123",
    EXPECTED_COMMIT_SHA: "abc123",
    EXPECTED_PUBLIC_URL: "https://someone.github.io/open-links",
    GITHUB_REPOSITORY: "someone/open-links",
    GITHUB_TOKEN: "github-token",
  };

  // Act
  const result = loadWaitForPagesDeploymentEnv(env);

  // Assert
  assert.deepEqual(result, {
    deploymentId: "123",
    githubRepository: "someone/open-links",
    githubToken: "github-token",
    maybeExpectedCommitSha: "abc123",
    maybeExpectedPublicUrl: "https://someone.github.io/open-links",
  });
});

test("classifyPagesDeploymentStatus reports success, failure, and pending states", () => {
  // Arrange / Act / Assert
  assert.equal(classifyPagesDeploymentStatus("succeed"), "success");
  assert.equal(classifyPagesDeploymentStatus("deployment_content_failed"), "failure");
  assert.equal(classifyPagesDeploymentStatus("queued"), "pending");
});

test("waitForPagesDeployment retries stale public build-info until the expected commit is live", async () => {
  // Arrange
  let currentTime = 0;
  let callCount = 0;
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    callCount += 1;

    if (callCount === 1) {
      assert.match(url, /pages\/deployments\/123$/u);
      return jsonResponse({ status: "building" });
    }

    if (callCount === 2) {
      assert.match(url, /pages\/deployments\/123$/u);
      return jsonResponse({ status: "succeed" });
    }

    if (callCount === 3) {
      assert.equal(url, "https://someone.github.io/open-links/build-info.json");
      return jsonResponse({ commitSha: "old-sha" });
    }

    if (callCount === 4) {
      assert.equal(url, "https://someone.github.io/open-links/build-info.json");
      return jsonResponse({ commitSha: "expected-sha" });
    }

    throw new Error(`Unexpected fetch call ${callCount} for ${url}`);
  };

  // Act
  await waitForPagesDeployment(
    {
      deploymentId: "123",
      githubRepository: "someone/open-links",
      githubToken: "github-token",
      maybeExpectedCommitSha: "expected-sha",
      maybeExpectedPublicUrl: "https://someone.github.io/open-links",
      deploymentTimeoutMs: 100,
      pollIntervalMs: 5,
      publicReadinessTimeoutMs: 100,
    },
    {
      fetchImpl,
      now: () => currentTime,
      sleep: async (milliseconds) => {
        currentTime += milliseconds;
      },
    },
  );

  // Assert
  assert.equal(callCount, 4);
});

test("waitForPagesDeployment fails with stale-vs-expected detail when public build-info never catches up", async () => {
  // Arrange
  let currentTime = 0;
  let callCount = 0;
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    callCount += 1;

    if (callCount === 1) {
      assert.match(url, /pages\/deployments\/123$/u);
      return jsonResponse({ status: "succeed" });
    }

    assert.equal(url, "https://someone.github.io/open-links/build-info.json");
    return jsonResponse({ commitSha: "stale-sha" });
  };

  // Act / Assert
  await assert.rejects(
    () =>
      waitForPagesDeployment(
        {
          deploymentId: "123",
          githubRepository: "someone/open-links",
          githubToken: "github-token",
          maybeExpectedCommitSha: "expected-sha",
          maybeExpectedPublicUrl: "https://someone.github.io/open-links",
          deploymentTimeoutMs: 20,
          pollIntervalMs: 5,
          publicReadinessTimeoutMs: 10,
        },
        {
          fetchImpl,
          now: () => currentTime,
          sleep: async (milliseconds) => {
            currentTime += milliseconds;
          },
        },
      ),
    /Timed out waiting for https:\/\/someone\.github\.io\/open-links\/build-info\.json to report commit expected-sha\..*received 'stale-sha'.*Last observed commit: 'stale-sha'/u,
  );
});

test("waitForPagesDeployment fails immediately when the Pages deployment enters a terminal failure state", async () => {
  // Arrange
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    assert.match(url, /pages\/deployments\/123$/u);
    return jsonResponse({ status: "deployment_failed" });
  };

  // Act / Assert
  await assert.rejects(
    () =>
      waitForPagesDeployment(
        {
          deploymentId: "123",
          githubRepository: "someone/open-links",
          githubToken: "github-token",
        },
        {
          fetchImpl,
        },
      ),
    /Pages deployment 123 failed/u,
  );
});
