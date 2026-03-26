import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { upsertReadmeDeployUrlRow } from "../lib/readme-deploy-urls";
import { parseArgs } from "./shared";

const args = parseArgs(process.argv.slice(2));
const readmePath = path.resolve(args.readme ?? "README.md");
const target = args.target?.trim();
const status = args.status?.trim() ?? "active";
const primaryUrl = args["primary-url"]?.trim();
const additionalUrls = args["additional-urls"]?.trim() ?? "none";
const evidence = args.evidence?.trim();
const check = args.check === "true";

if (!target || !primaryUrl || !evidence) {
  throw new Error(
    "Missing required flags. Expected --target, --primary-url, and --evidence for README deploy URL updates.",
  );
}

const originalContent = await readFile(readmePath, "utf8");
const replacement = upsertReadmeDeployUrlRow(originalContent, {
  additionalUrls,
  evidence,
  primaryUrl,
  status,
  target,
});

if (check && replacement.changed) {
  throw new Error(`README deploy row for '${target}' is out of date in ${readmePath}.`);
}

if (!check && replacement.changed) {
  await writeFile(readmePath, replacement.content, "utf8");
}

console.log(
  replacement.changed
    ? `${check ? "README deploy row requires update" : "Updated README deploy row"} for ${target}.`
    : `README deploy row already up to date for ${target}.`,
);
