import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  analyzeNightlyAudienceHealth,
  formatNightlyAudienceHealthReport,
} from "./nightly-follower-history-health";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/nightly-follower-history.yml");
const PUBLIC_RICH_SYNC_PATH = path.join(ROOT, "scripts/public-rich-sync.ts");
const FOLLOWER_HISTORY_SYNC_PATH = path.join(ROOT, "scripts/sync-follower-history.ts");

const requireLine = (workflowSource: string, needle: string) => {
  const index = workflowSource.indexOf(needle);
  assert.notEqual(index, -1, `Expected workflow to contain '${needle}'.`);
  return index;
};

test("nightly follower history runs under production and commits before building or pushing", () => {
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  assert.match(
    workflowSource,
    /sync-and-deploy:\n\s+name: Sync Follower History and Deploy\n\s+runs-on: ubuntu-latest\n\s+environment:\n\s+name: production/u,
  );

  const commitIndex = requireLine(workflowSource, "- name: Commit follower-history artifacts");
  const buildIndex = requireLine(workflowSource, "- name: Build deploy artifacts");
  const pushIndex = requireLine(workflowSource, "- name: Push follower-history artifacts");
  const awsCredentialsIndex = requireLine(workflowSource, "- name: Configure AWS credentials");
  const verifyIndex = requireLine(workflowSource, "- name: Verify enabled deployment targets");

  assert.ok(commitIndex < buildIndex, "Expected commit step to run before build.");
  assert.ok(buildIndex < pushIndex, "Expected build step to run before push.");
  assert.ok(pushIndex < awsCredentialsIndex, "Expected push step to run before AWS deploy.");
  assert.ok(pushIndex < verifyIndex, "Expected push step to run before deploy verification.");

  assert.match(
    workflowSource,
    /- name: Build deploy artifacts\n\s+if: steps\.commit\.outputs\.commit_result == 'committed'\n\s+run: bun run deploy:build/u,
  );
  assert.match(
    workflowSource,
    /- name: Push follower-history artifacts\n\s+if: steps\.commit\.outputs\.commit_result == 'committed'/u,
  );
  assert.match(
    workflowSource,
    /- name: Verify enabled deployment targets\n\s+if: steps\.push\.outputs\.push_result == 'pushed' && steps\.aws_opt_in\.outputs\.enabled == 'true'\n\s+run: bun run deploy:verify/u,
  );
});

test("nightly follower history passes the committed SHA into the shared Pages deployment helpers", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act / Assert
  assert.match(
    workflowSource,
    /- name: Create Pages deployment\n\s+if: steps\.push\.outputs\.push_result == 'pushed' && steps\.pages_plan\.outputs\.pages_changed == 'true'\n\s+id: deployment\n\s+env:\n\s+ARTIFACT_ID: \$\{\{ steps\.upload_pages_artifact\.outputs\.artifact-id \}\}\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}\n\s+PAGES_BUILD_VERSION: \$\{\{ steps\.commit\.outputs\.commit_sha \}\}\n\s+run: bun run scripts\/ci\/create-pages-deployment\.ts/u,
  );
  assert.match(
    workflowSource,
    /- name: Wait for Pages deployment\n\s+if: steps\.push\.outputs\.push_result == 'pushed' && steps\.pages_plan\.outputs\.pages_changed == 'true'\n\s+env:\n\s+DEPLOYMENT_ID: \$\{\{ steps\.deployment\.outputs\.deployment_id \}\}\n\s+EXPECTED_COMMIT_SHA: \$\{\{ steps\.commit\.outputs\.commit_sha \}\}\n\s+EXPECTED_PUBLIC_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}\n\s+run: bun run scripts\/ci\/wait-for-pages-deployment\.ts/u,
  );
});

test("nightly follower history defers public audience failures until after deploy diagnostics", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act / Assert
  assert.match(
    workflowSource,
    /- name: Refresh public audience cache\n\s+run: bun run public:rich:sync -- --defer-failures --summary-json \.ci-diagnostics\/public-rich-sync-summary\.json/u,
  );
  const publishSummaryIndex = requireLine(workflowSource, "- name: Publish summary");
  const uploadDiagnosticsIndex = requireLine(
    workflowSource,
    "- name: Upload nightly audience diagnostics",
  );
  const healthCheckIndex = requireLine(workflowSource, "- name: Check nightly audience health");
  assert.ok(
    publishSummaryIndex < uploadDiagnosticsIndex,
    "Expected summary to publish before diagnostics upload.",
  );
  assert.ok(
    uploadDiagnosticsIndex < healthCheckIndex,
    "Expected diagnostics upload before the final health failure gate.",
  );
  assert.match(
    workflowSource,
    /- name: Upload nightly audience diagnostics\n\s+if: always\(\)\n\s+uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: nightly-audience-diagnostics\n\s+path: \|\n\s+\.ci-diagnostics\/\*\.json\n\s+output\/playwright\/public-rich-sync\/\*\.json\n\s+output\/cache-revalidation\/\*\.json/u,
  );
  assert.match(workflowSource, /include-hidden-files:\s+true/u);
  assert.match(
    workflowSource,
    /- name: Check nightly audience health\n\s+if: always\(\)\n\s+run: bun run scripts\/github-actions\/nightly-follower-history-health\.ts/u,
  );
  assert.doesNotMatch(
    workflowSource,
    /- name: Refresh public audience cache[\s\S]{0,160}continue-on-error:\s+true/u,
  );
});

test("nightly follower history includes Substack in the fresh public audience contract", () => {
  // Arrange
  const publicRichSyncSource = fs.readFileSync(PUBLIC_RICH_SYNC_PATH, "utf8");
  const followerHistorySyncSource = fs.readFileSync(FOLLOWER_HISTORY_SYNC_PATH, "utf8");

  // Act / Assert
  assert.match(publicRichSyncSource, /id:\s+"substack-public-profile"/u);
  assert.match(publicRichSyncSource, /requiresSubscribersCount:\s+true/u);
  assert.match(followerHistorySyncSource, /"substack-public-profile"/u);
});

test("nightly audience health treats nonfatal public sync failures as advisory", () => {
  // Arrange
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: {
      failed: 1,
      fatalFailed: 0,
      entries: [
        {
          linkId: "instagram",
          status: "failed",
          reason: "audience_missing",
          artifactPath: "output/playwright/public-rich-sync/instagram.json",
          detail:
            "Instagram public browser capture saw placeholder content: login_redirect. Fallback public-html capture also failed: login_wall.",
        },
      ],
    },
    historySummary: {
      observedAt: "2026-05-16T07:37:25.097Z",
      status: "written",
      snapshots: [
        {
          linkId: "github",
          platform: "github",
          audienceCountRaw: "97 followers",
        },
      ],
    },
    followerHistoryIndex: {
      entries: [
        {
          linkId: "instagram",
          platform: "instagram",
          latestObservedAt: "2026-05-12T12:39:57.059Z",
          latestAudienceCountRaw: "102 followers",
        },
      ],
    },
  });

  // Act
  const formatted = formatNightlyAudienceHealthReport(report);

  // Assert
  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, [
    {
      kind: "capture_failure",
      linkId: "instagram",
      reason: "audience_missing",
      fatal: false,
      detail:
        "Instagram public browser capture saw placeholder content: login_redirect. Fallback public-html capture also failed: login_wall.",
      artifactPath: "output/playwright/public-rich-sync/instagram.json",
    },
  ]);
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(report.advisoryFindings, report.findings);
  assert.match(formatted, /Nightly audience health check passed with advisory findings/u);
  assert.match(formatted, /fatal=no/u);
});

test("nightly audience health fails on fatal public sync failures", () => {
  // Arrange
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: {
      failed: 1,
      fatalFailed: 1,
      entries: [
        {
          linkId: "instagram",
          status: "failed",
          reason: "profile_unavailable",
          artifactPath: "output/playwright/public-rich-sync/instagram-not-found.json",
          detail:
            "Instagram public browser capture saw fatal profile-unavailable placeholder content: not_found.",
          fatal: true,
        },
      ],
    },
    historySummary: {
      observedAt: "2026-05-16T07:37:25.097Z",
      status: "written",
      snapshots: [],
    },
    followerHistoryIndex: {
      entries: [
        {
          linkId: "instagram",
          platform: "instagram",
          latestObservedAt: "2026-05-12T12:39:57.059Z",
          latestAudienceCountRaw: "102 followers",
        },
      ],
    },
  });

  // Act
  const formatted = formatNightlyAudienceHealthReport(report);

  // Assert
  assert.equal(report.ok, false);
  assert.deepEqual(report.blockingFindings, report.findings);
  assert.deepEqual(report.advisoryFindings, []);
  assert.match(formatted, /Nightly audience health check failed/u);
  assert.match(formatted, /Blocking findings/u);
  assert.match(formatted, /fatal=yes/u);
});

test("nightly audience health fails when fresh observations are missing snapshots", () => {
  // Arrange
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: {
      failed: 0,
      fatalFailed: 0,
      entries: [
        {
          linkId: "instagram",
          status: "synced",
          reason: "counts_refreshed",
          artifactPath: "output/playwright/public-rich-sync/instagram.json",
        },
      ],
    },
    historySummary: {
      observedAt: "2026-05-16T07:37:25.097Z",
      status: "written",
      snapshots: [],
    },
    followerHistoryIndex: {
      entries: [
        {
          linkId: "instagram",
          platform: "instagram",
          latestObservedAt: "2026-05-16T07:37:25.097Z",
          latestAudienceCountRaw: "104 followers",
        },
      ],
    },
  });

  // Assert
  assert.equal(report.ok, false);
  assert.deepEqual(report.blockingFindings, report.findings);
  assert.deepEqual(report.advisoryFindings, []);
  assert.deepEqual(report.findings, [
    {
      kind: "missing_snapshot",
      linkId: "instagram",
      platform: "instagram",
      reason: "fresh_public_observation_missing_history_snapshot",
      artifactPath: "output/playwright/public-rich-sync/instagram.json",
      latestObservedAt: "2026-05-16T07:37:25.097Z",
    },
  ]);
});

test("nightly audience health flags stale index rows without explicit failures", () => {
  // Arrange
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: {
      failed: 0,
      fatalFailed: 0,
      entries: [
        { linkId: "instagram", status: "synced", reason: "counts_refreshed" },
        { linkId: "medium", status: "skipped", reason: "counts_unchanged" },
      ],
    },
    historySummary: {
      observedAt: "2026-05-16T07:37:25.097Z",
      status: "written",
      snapshots: [
        {
          linkId: "instagram",
          platform: "instagram",
          audienceCountRaw: "104 followers",
        },
        {
          linkId: "medium",
          platform: "medium",
          audienceCountRaw: "3.3K followers",
        },
      ],
    },
    followerHistoryIndex: {
      entries: [
        {
          linkId: "instagram",
          platform: "instagram",
          latestObservedAt: "2026-05-16T07:37:25.097Z",
          latestAudienceCountRaw: "104 followers",
        },
        {
          linkId: "medium",
          platform: "medium",
          latestObservedAt: "2026-05-16T07:37:25.097Z",
          latestAudienceCountRaw: "3.3K followers",
        },
        {
          linkId: "substack",
          platform: "substack",
          latestObservedAt: "2026-05-12T12:39:57.059Z",
          latestAudienceCountRaw: "15 subscribers",
        },
      ],
    },
  });

  // Assert
  assert.equal(report.ok, false);
  assert.deepEqual(report.blockingFindings, report.findings);
  assert.deepEqual(report.advisoryFindings, []);
  assert.deepEqual(report.findings, [
    {
      kind: "stale_index",
      linkId: "substack",
      platform: "substack",
      reason: "history_index_not_updated_for_current_run",
      latestObservedAt: "2026-05-12T12:39:57.059Z",
      detail:
        "Latest history remains 2026-05-12T12:39:57.059Z; current run observed at 2026-05-16T07:37:25.097Z.",
    },
  ]);
});

test("nightly audience health passes when fresh observations have current snapshots", () => {
  // Arrange
  const report = analyzeNightlyAudienceHealth({
    publicRichSyncSummary: {
      failed: 0,
      fatalFailed: 0,
      entries: [{ linkId: "substack", status: "skipped", reason: "counts_unchanged" }],
    },
    historySummary: {
      observedAt: "2026-05-16T07:37:25.097Z",
      status: "written",
      snapshots: [
        {
          linkId: "substack",
          platform: "substack",
          audienceCountRaw: "15 subscribers",
        },
      ],
    },
    followerHistoryIndex: {
      entries: [
        {
          linkId: "substack",
          platform: "substack",
          latestObservedAt: "2026-05-16T07:37:25.097Z",
          latestAudienceCountRaw: "15 subscribers",
        },
      ],
    },
  });

  // Assert
  assert.equal(report.ok, true);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.blockingFindings, []);
  assert.deepEqual(report.advisoryFindings, []);
  assert.equal(formatNightlyAudienceHealthReport(report), "Nightly audience health check passed.");
});
