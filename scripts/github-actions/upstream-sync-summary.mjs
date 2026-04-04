import fs from "node:fs";

const status = process.env.SYNC_COMMAND_STATUS ?? "unknown";
const resultPath = process.env.UPSTREAM_SYNC_RESULT_PATH ?? ".ci-diagnostics/upstream-sync.json";
const deployDispatchStatus = process.env.UPSTREAM_SYNC_DEPLOY_DISPATCH_STATUS?.trim();

const printFallbackSummary = (reason) => {
  console.log("## Upstream Sync");
  console.log("");
  console.log(
    `Command failed before a usable JSON result was written (${reason}; exit ${status}).`,
  );
  console.log(`- Result path: \`${resultPath}\``);
  process.exit(0);
};

if (!fs.existsSync(resultPath)) {
  printFallbackSummary("missing result file");
}

const rawResult = fs.readFileSync(resultPath, "utf8").trim();
if (rawResult.length === 0) {
  printFallbackSummary("empty result file");
}

let result;
try {
  result = JSON.parse(rawResult);
} catch {
  printFallbackSummary("invalid JSON result");
  process.exit(0);
}

console.log("## Upstream Sync");
console.log("");
console.log(`- Status: \`${result.status}\``);
console.log(`- Message: ${result.message}`);
console.log(`- Branch changed: \`${String(result.branchChanged)}\``);
if (result.publishRemote && result.publishBranch) {
  console.log(`- Publish target: \`${result.publishRemote}/${result.publishBranch}\``);
}
if (result.targetBranch) {
  console.log(`- Target branch: \`${result.targetBranch}\``);
}
if (result.baseRef) {
  console.log(`- Base ref: \`${result.baseRef}\``);
}
if (result.upstreamRef) {
  console.log(`- Upstream ref: \`${result.upstreamRef}\``);
}
if (result.beforeSha) {
  console.log(`- Before SHA: \`${result.beforeSha}\``);
}
if (result.afterSha) {
  console.log(`- After SHA: \`${result.afterSha}\``);
}
if (result.pushStatus) {
  console.log(`- Push status: \`${result.pushStatus}\``);
}
if (typeof result.pushed === "boolean") {
  console.log(`- Pushed: \`${String(result.pushed)}\``);
}
console.log(`- Result path: \`${resultPath}\``);

if (deployDispatchStatus?.length) {
  console.log(`- Deploy handoff: \`${deployDispatchStatus}\``);
}

if (Array.isArray(result.sharedConflicts) && result.sharedConflicts.length > 0) {
  console.log(`- Shared conflicts: \`${result.sharedConflicts.join(", ")}\``);
}

if (Array.isArray(result.forkOwnedConflicts) && result.forkOwnedConflicts.length > 0) {
  console.log(`- Fork-owned conflicts: \`${result.forkOwnedConflicts.join(", ")}\``);
}
