import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

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

test("nightly follower history keeps public audience sync best effort for non-terminal failures", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act / Assert
  assert.match(
    workflowSource,
    /- name: Refresh public audience cache\n\s+run: bun run public:rich:sync -- --allow-failures --summary-json \.ci-diagnostics\/public-rich-sync-summary\.json/u,
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
