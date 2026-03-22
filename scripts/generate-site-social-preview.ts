import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { SiteData } from "../src/lib/content/load-content";
import {
  DEFAULT_CANONICAL_OPENLINKS_LOGO_PATH,
  readCanonicalOpenLinksMarkSpec,
} from "./lib/openlinks-logo";
import { buildSocialPreviewSvg, renderSocialPreviewPng } from "./lib/social-preview";

const ROOT = process.cwd();

export const DEFAULT_SITE_SOCIAL_PREVIEW_SVG_PATH = "public/generated/seo/social-preview.svg";
export const DEFAULT_SITE_SOCIAL_PREVIEW_PNG_PATH = "public/generated/seo/social-preview.png";

export interface ResolvedSiteSocialPreviewSpec {
  title: string;
  description: string;
  svgOutputPath: string;
  pngOutputPath: string;
}

export interface ResolveSiteSocialPreviewSpecInput {
  site: Pick<SiteData, "title" | "description" | "quality">;
  svgOutputPath?: string;
  pngOutputPath?: string;
}

export interface GenerateSiteSocialPreviewArtifactInput {
  canonicalLogoPath?: string;
  rootDir?: string;
  site?: Pick<SiteData, "title" | "description" | "quality">;
  sitePath?: string;
  svgOutputPath?: string;
  pngOutputPath?: string;
}

export interface GenerateSiteSocialPreviewArtifactResult {
  svgOutputPath: string;
  svgStatus: "unchanged" | "written";
  pngOutputPath: string;
  pngStatus: "unchanged" | "written";
}

const absolutePath = (rootDir: string, value: string): string =>
  path.isAbsolute(value) ? value : path.join(rootDir, value);

const readJsonFile = <T>(rootDir: string, relativePath: string): T => {
  const absolute = absolutePath(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(absolute, "utf8")) as T;
};

const trimToUndefined = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const writeIfChanged = (filePath: string, content: Buffer | string): "unchanged" | "written" => {
  const nextBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const currentBuffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  if (currentBuffer?.equals(nextBuffer)) {
    return "unchanged";
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextBuffer);
  return "written";
};

export const resolveSiteSocialPreviewSpec = (
  input: ResolveSiteSocialPreviewSpecInput,
): ResolvedSiteSocialPreviewSpec => ({
  title:
    trimToUndefined(input.site.quality?.seo?.defaults?.title) ??
    trimToUndefined(input.site.title) ??
    "OpenLinks",
  description:
    trimToUndefined(input.site.quality?.seo?.defaults?.description) ??
    trimToUndefined(input.site.description) ??
    "Personal, free, open source, version-controlled links website.",
  svgOutputPath: input.svgOutputPath ?? DEFAULT_SITE_SOCIAL_PREVIEW_SVG_PATH,
  pngOutputPath: input.pngOutputPath ?? DEFAULT_SITE_SOCIAL_PREVIEW_PNG_PATH,
});

export const generateSiteSocialPreviewArtifact = (
  input: GenerateSiteSocialPreviewArtifactInput = {},
): GenerateSiteSocialPreviewArtifactResult => {
  const rootDir = input.rootDir ?? ROOT;
  const site = input.site ?? readJsonFile<SiteData>(rootDir, input.sitePath ?? "data/site.json");
  const spec = resolveSiteSocialPreviewSpec({
    site,
    svgOutputPath: input.svgOutputPath,
    pngOutputPath: input.pngOutputPath,
  });
  const markSpec = readCanonicalOpenLinksMarkSpec(
    rootDir,
    input.canonicalLogoPath ?? DEFAULT_CANONICAL_OPENLINKS_LOGO_PATH,
  );
  const svg = buildSocialPreviewSvg({
    title: spec.title,
    description: spec.description,
    markSpec,
  });
  const png = renderSocialPreviewPng(svg);
  const absoluteSvgOutputPath = absolutePath(rootDir, spec.svgOutputPath);
  const absolutePngOutputPath = absolutePath(rootDir, spec.pngOutputPath);

  return {
    svgOutputPath: absoluteSvgOutputPath,
    svgStatus: writeIfChanged(absoluteSvgOutputPath, svg),
    pngOutputPath: absolutePngOutputPath,
    pngStatus: writeIfChanged(absolutePngOutputPath, png),
  };
};

if (import.meta.main) {
  try {
    const result = generateSiteSocialPreviewArtifact();
    console.log(
      `Site social preview SVG: ${result.svgStatus} (${path.relative(ROOT, result.svgOutputPath)})`,
    );
    console.log(
      `Site social preview PNG: ${result.pngStatus} (${path.relative(ROOT, result.pngOutputPath)})`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate site social preview: ${message}`);
    process.exitCode = 1;
  }
}
