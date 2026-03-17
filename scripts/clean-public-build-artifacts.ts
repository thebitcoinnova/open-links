import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_PUBLIC_DIR = "public";
const LEGACY_PUBLIC_GENERATED_PATHS = ["generated/images", "generated/profile-avatar.jpg"] as const;

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const walkForDsStoreFiles = (directory: string, results: string[]): void => {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absoluteEntryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkForDsStoreFiles(absoluteEntryPath, results);
      continue;
    }

    if (entry.isFile() && entry.name === ".DS_Store") {
      results.push(absoluteEntryPath);
    }
  }
};

export const listPublicBuildCleanupTargets = (publicDir = DEFAULT_PUBLIC_DIR): string[] => {
  const absolutePublicDir = absolutePath(publicDir);
  const cleanupTargets: string[] = [];

  walkForDsStoreFiles(absolutePublicDir, cleanupTargets);

  for (const relativeLegacyPath of LEGACY_PUBLIC_GENERATED_PATHS) {
    const absoluteLegacyPath = path.join(absolutePublicDir, relativeLegacyPath);
    if (fs.existsSync(absoluteLegacyPath)) {
      cleanupTargets.push(absoluteLegacyPath);
    }
  }

  return cleanupTargets.sort();
};

export const runPublicBuildCleanup = (publicDir = DEFAULT_PUBLIC_DIR): string[] => {
  const cleanupTargets = listPublicBuildCleanupTargets(publicDir);

  for (const cleanupTarget of cleanupTargets) {
    fs.rmSync(cleanupTarget, { force: true, recursive: true });
  }

  return cleanupTargets;
};

if (import.meta.main) {
  const removed = runPublicBuildCleanup();

  if (removed.length === 0) {
    console.log("Public build cleanup: no legacy or OS-generated artifacts found.");
  } else {
    console.log("Public build cleanup removed:");
    for (const absoluteRemovedPath of removed) {
      console.log(`- ${path.relative(ROOT, absoluteRemovedPath)}`);
    }
  }
}
