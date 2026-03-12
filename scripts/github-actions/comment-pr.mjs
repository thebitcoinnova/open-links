#!/usr/bin/env node

const {
  COMMENT_KIND,
  FAILED_COMMANDS,
  GITHUB_API_URL,
  GITHUB_REPOSITORY,
  GITHUB_RUN_ID,
  GITHUB_SERVER_URL,
  GITHUB_TOKEN,
  PR_NUMBER,
} = process.env;

if (!COMMENT_KIND || !GITHUB_REPOSITORY || !GITHUB_TOKEN || !PR_NUMBER) {
  throw new Error(
    "Missing required env. Expected COMMENT_KIND, GITHUB_REPOSITORY, GITHUB_TOKEN, and PR_NUMBER.",
  );
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
if (!owner || !repo) {
  throw new Error(`Invalid GITHUB_REPOSITORY '${GITHUB_REPOSITORY}'.`);
}

const failed = FAILED_COMMANDS || "unknown";
const runUrl = `${GITHUB_SERVER_URL ?? "https://github.com"}/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID ?? ""}`;

const bodyByKind = {
  required: [
    "### ❌ OpenLinks CI required checks failed",
    `- Failed commands: \`${failed}\``,
    "- Workflow summary includes remediation steps and raw diagnostics replay.",
    "- Artifact: `ci-diagnostics-required` (uploaded on failure).",
    `- Run details: ${runUrl}`,
  ].join("\n"),
  strict: [
    "### ⚠ OpenLinks strict checks failed (non-blocking in Phase 5)",
    `- Failed commands: \`${failed}\``,
    "- Required checks passed; this signal does not block merge/deploy in this phase.",
    "- Artifact: `ci-diagnostics-strict` (uploaded on strict failure).",
    `- Run details: ${runUrl}`,
  ].join("\n"),
};

const body = bodyByKind[COMMENT_KIND];
if (!body) {
  throw new Error(`Unsupported COMMENT_KIND '${COMMENT_KIND}'.`);
}

const response = await fetch(
  `${GITHUB_API_URL ?? "https://api.github.com"}/repos/${owner}/${repo}/issues/${PR_NUMBER}/comments`,
  {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "open-links-github-actions",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ body }),
  },
);

if (!response.ok) {
  throw new Error(`GitHub comment request failed: ${response.status} ${await response.text()}`);
}
