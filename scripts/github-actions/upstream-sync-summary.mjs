import fs from "node:fs";

const status = process.env.SYNC_COMMAND_STATUS ?? "unknown";
const resultPath = ".ci-diagnostics/upstream-sync.json";

if (!fs.existsSync(resultPath)) {
  console.log("## Upstream Sync");
  console.log("");
  console.log(`Command failed before a JSON result was written (exit ${status}).`);
  process.exit(0);
}

const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));

console.log("## Upstream Sync");
console.log("");
console.log(`- Status: \`${result.status}\``);
console.log(`- Message: ${result.message}`);
console.log(`- Branch changed: \`${String(result.branchChanged)}\``);
console.log(`- Target branch: \`${result.targetBranch}\``);
console.log(`- Upstream ref: \`${result.upstreamRef}\``);

if (Array.isArray(result.sharedConflicts) && result.sharedConflicts.length > 0) {
  console.log(`- Shared conflicts: \`${result.sharedConflicts.join(", ")}\``);
}

if (Array.isArray(result.forkOwnedConflicts) && result.forkOwnedConflicts.length > 0) {
  console.log(`- Fork-owned conflicts: \`${result.forkOwnedConflicts.join(", ")}\``);
}
