import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/deploy-production.yml");

test("deploy production passes the checkout ref into the shared Pages deployment helpers", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act / Assert
  assert.match(
    workflowSource,
    /- name: Create Pages deployment\n\s+if: steps\.pages_plan\.outputs\.pages_changed == 'true'\n\s+id: deployment\n\s+env:\n\s+ARTIFACT_ID: \$\{\{ steps\.upload_pages_artifact\.outputs\.artifact-id \}\}\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}\n\s+PAGES_BUILD_VERSION: \$\{\{ needs\.prepare\.outputs\.checkout_ref \}\}\n\s+run: bun run scripts\/ci\/create-pages-deployment\.ts/u,
  );
  assert.match(
    workflowSource,
    /- name: Wait for Pages deployment\n\s+if: steps\.pages_plan\.outputs\.pages_changed == 'true'\n\s+env:\n\s+DEPLOYMENT_ID: \$\{\{ steps\.deployment\.outputs\.deployment_id \}\}\n\s+EXPECTED_COMMIT_SHA: \$\{\{ needs\.prepare\.outputs\.checkout_ref \}\}\n\s+EXPECTED_PUBLIC_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}\n\s+run: bun run scripts\/ci\/wait-for-pages-deployment\.ts/u,
  );
});
