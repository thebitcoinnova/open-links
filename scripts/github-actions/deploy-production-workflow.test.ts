import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github/workflows/deploy-production.yml");
const VERIFY_JOB_IF_SNIPPET = `if: |
      always() &&
      needs.prepare.result == 'success' &&
      (
        needs.prepare.outputs.aws_target_enabled != 'true' ||
        needs.aws.result == 'success'
      ) &&
      (
        needs.prepare.outputs.github_pages_enabled != 'true' ||
        needs.pages.result == 'success'
      ) &&
      (
        needs.prepare.outputs.aws_enabled == 'true' ||
        needs.prepare.outputs.github_pages_enabled == 'true'
      )`;

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

test("deploy production verifies only after enabled deploy jobs actually succeed", () => {
  // Arrange
  const workflowSource = fs.readFileSync(WORKFLOW_PATH, "utf8");

  // Act / Assert
  assert.match(
    workflowSource,
    /verify:\n\s+name: Verify Production Deployment\n\s+runs-on: ubuntu-latest\n\s+needs:\n\s+- prepare\n\s+- aws\n\s+- pages\n\s+if: \|\n\s+always\(\) &&\n\s+needs\.prepare\.result == 'success' &&\n\s+\(\n\s+needs\.prepare\.outputs\.aws_target_enabled != 'true' \|\|\n\s+needs\.aws\.result == 'success'\n\s+\) &&\n\s+\(\n\s+needs\.prepare\.outputs\.github_pages_enabled != 'true' \|\|\n\s+needs\.pages\.result == 'success'\n\s+\) &&/u,
  );
  assert.doesNotMatch(workflowSource, /needs\.aws\.result == 'skipped'/u);
  assert.doesNotMatch(workflowSource, /needs\.pages\.result == 'skipped'/u);
  assert.ok(
    workflowSource.includes(VERIFY_JOB_IF_SNIPPET),
    "Expected verify job to require enabled deploy jobs to succeed before verification runs.",
  );
});
