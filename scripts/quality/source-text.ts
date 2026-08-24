import fs from "node:fs";
import path from "node:path";

export const readSourceText = (rootDir: string, relativePath: string): string =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

export const readCombinedSourceText = (rootDir: string, relativePaths: string[]): string =>
  relativePaths.map((relativePath) => readSourceText(rootDir, relativePath)).join("\n");
