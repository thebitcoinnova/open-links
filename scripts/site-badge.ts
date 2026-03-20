import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { makeBadge } from "badge-maker";
import type { ProfileData, SiteData } from "../src/lib/content/load-content";

const ROOT = process.cwd();

export const DEFAULT_SITE_BADGE_LABEL = "OpenLinks";
export const DEFAULT_SITE_BADGE_FALLBACK_MESSAGE = "My OpenLinks";
export const DEFAULT_SITE_BADGE_LABEL_COLOR = "#111111";
export const DEFAULT_SITE_BADGE_MESSAGE_COLOR = "#0f766e";
export const DEFAULT_SITE_BADGE_STYLE = "flat" as const;
export const DEFAULT_SITE_BADGE_OUTPUT_PATH = "public/badges/openlinks.svg";
export const DEFAULT_SITE_BADGE_LOGO_PATH = "public/favicon.svg";

export interface ResolvedSiteBadgeSpec {
  label: string;
  message: string;
  labelColor: string;
  color: string;
  outputPath: string;
  style: "flat";
}

export interface ResolveSiteBadgeSpecInput {
  outputPath?: string;
  profile: Pick<ProfileData, "name">;
  site: Pick<SiteData, "sharing">;
}

export interface BuildSiteBadgeSvgInput {
  logoDataUrl: string;
  spec: ResolvedSiteBadgeSpec;
}

export interface GenerateSiteBadgeArtifactInput {
  logoPath?: string;
  outputPath?: string;
  profile?: Pick<ProfileData, "name">;
  rootDir?: string;
  site?: Pick<SiteData, "sharing">;
}

export interface GenerateSiteBadgeArtifactResult {
  outputPath: string;
  status: "removed" | "unchanged" | "written";
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

export const resolveSiteBadgeSpec = (
  input: ResolveSiteBadgeSpecInput,
): ResolvedSiteBadgeSpec | null => {
  const maybeBadge = input.site.sharing?.badge;
  if (maybeBadge?.enabled === false) {
    return null;
  }

  const message =
    trimToUndefined(maybeBadge?.message) ??
    trimToUndefined(input.profile.name) ??
    DEFAULT_SITE_BADGE_FALLBACK_MESSAGE;

  return {
    label: DEFAULT_SITE_BADGE_LABEL,
    message,
    labelColor: DEFAULT_SITE_BADGE_LABEL_COLOR,
    color: DEFAULT_SITE_BADGE_MESSAGE_COLOR,
    outputPath: input.outputPath ?? DEFAULT_SITE_BADGE_OUTPUT_PATH,
    style: DEFAULT_SITE_BADGE_STYLE,
  };
};

export const buildSiteBadgeSvg = (input: BuildSiteBadgeSvgInput): string =>
  makeBadge({
    color: input.spec.color,
    idSuffix: "openlinksSiteBadge",
    label: input.spec.label,
    labelColor: input.spec.labelColor,
    logoBase64: input.logoDataUrl,
    message: input.spec.message,
    style: input.spec.style,
  });

export const readSvgFileAsDataUrl = (
  rootDir = ROOT,
  relativePath = DEFAULT_SITE_BADGE_LOGO_PATH,
): string => {
  const absolute = absolutePath(rootDir, relativePath);
  const svg = fs.readFileSync(absolute, "utf8");
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
};

export const generateSiteBadgeArtifact = (
  input: GenerateSiteBadgeArtifactInput = {},
): GenerateSiteBadgeArtifactResult => {
  const rootDir = input.rootDir ?? ROOT;
  const profile = input.profile ?? readJsonFile<ProfileData>(rootDir, "data/profile.json");
  const site = input.site ?? readJsonFile<SiteData>(rootDir, "data/site.json");
  const spec = resolveSiteBadgeSpec({
    outputPath: input.outputPath,
    profile,
    site,
  });
  const absoluteOutputPath = absolutePath(
    rootDir,
    spec?.outputPath ?? input.outputPath ?? DEFAULT_SITE_BADGE_OUTPUT_PATH,
  );

  if (!spec) {
    const existed = fs.existsSync(absoluteOutputPath);
    fs.rmSync(absoluteOutputPath, { force: true });
    return {
      outputPath: absoluteOutputPath,
      status: existed ? "removed" : "unchanged",
    };
  }

  const svg = `${buildSiteBadgeSvg({
    logoDataUrl: readSvgFileAsDataUrl(rootDir, input.logoPath ?? DEFAULT_SITE_BADGE_LOGO_PATH),
    spec,
  })}\n`;
  const previous = fs.existsSync(absoluteOutputPath)
    ? fs.readFileSync(absoluteOutputPath, "utf8")
    : null;

  if (previous === svg) {
    return {
      outputPath: absoluteOutputPath,
      status: "unchanged",
    };
  }

  fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
  fs.writeFileSync(absoluteOutputPath, svg, "utf8");

  return {
    outputPath: absoluteOutputPath,
    status: "written",
  };
};
