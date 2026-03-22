import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

export const DEFAULT_CANONICAL_OPENLINKS_LOGO_PATH =
  "public/branding/openlinks-logo/openlinks-logo.svg";

export interface OpenLinksMarkSpec {
  pathData: string;
  circleRadius: number;
  stroke: {
    circle: number;
    l: number;
  };
}

const toDisplayPath = (rootDir: string, targetPath: string): string =>
  path.isAbsolute(targetPath) ? path.relative(rootDir, targetPath) : targetPath;

export const extractOpenLinksMarkSpec = (
  canonicalSvg: string,
  sourcePath = DEFAULT_CANONICAL_OPENLINKS_LOGO_PATH,
): OpenLinksMarkSpec => {
  const circleMatch = canonicalSvg.match(
    /<circle[^>]*\sr="([^"]+)"[^>]*\sstroke-width="([^"]+)"[^>]*\/?>/iu,
  );
  if (!circleMatch?.[1] || !circleMatch[2]) {
    throw new Error(`Unable to locate canonical ring spec in ${sourcePath}.`);
  }

  const pathMatch = canonicalSvg.match(/<path[^>]*\sd="([^"]+)"[^>]*\/?>/iu);
  const pathStrokeMatch = canonicalSvg.match(/<path[^>]*\sstroke-width="([^"]+)"[^>]*\/?>/iu);
  if (!pathMatch?.[1] || !pathStrokeMatch?.[1]) {
    throw new Error(`Unable to locate canonical L path in ${sourcePath}.`);
  }

  return {
    pathData: pathMatch[1],
    circleRadius: Number(circleMatch[1]),
    stroke: {
      circle: Number(circleMatch[2]),
      l: Number(pathStrokeMatch[1]),
    },
  };
};

export const readCanonicalOpenLinksMarkSpec = (
  rootDir = ROOT,
  relativePath = DEFAULT_CANONICAL_OPENLINKS_LOGO_PATH,
): OpenLinksMarkSpec => {
  const absolutePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(rootDir, relativePath);
  const sourcePath = toDisplayPath(rootDir, relativePath);
  const canonicalSvg = fs.readFileSync(absolutePath, "utf8");
  return extractOpenLinksMarkSpec(canonicalSvg, sourcePath);
};
