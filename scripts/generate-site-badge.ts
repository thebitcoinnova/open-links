import path from "node:path";
import process from "node:process";
import { generateSiteBadgeArtifact } from "./site-badge";

const ROOT = process.cwd();

export const generateSiteBadge = () => generateSiteBadgeArtifact({ rootDir: ROOT });

if (import.meta.main) {
  const result = generateSiteBadge();
  console.log(`Site badge ${result.status}: ${path.relative(ROOT, result.outputPath)}`);
}
