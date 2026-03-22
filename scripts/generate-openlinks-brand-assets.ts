import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

interface BrandAssetTarget {
  id: "main" | "studio";
  rootDir: string;
  appName: string;
  shortName: string;
}

interface GenerateBrandAssetsOptions {
  quiet?: boolean;
}

const ROOT = process.cwd();
const CANONICAL_LOGO_PATH = path.join(ROOT, "public/branding/openlinks-logo/openlinks-logo.svg");
const CANONICAL_BRANDING_RELATIVE_PATH = "branding/openlinks-logo/openlinks-logo.svg";

const TARGETS: BrandAssetTarget[] = [
  {
    id: "main",
    rootDir: path.join(ROOT, "public"),
    appName: "OpenLinks",
    shortName: "OpenLinks",
  },
  {
    id: "studio",
    rootDir: path.join(ROOT, "packages/studio-web/public"),
    appName: "OpenLinks Studio",
    shortName: "OL Studio",
  },
];

const THEME_COLOR = "#111111";
const BADGE_BG = "#111111";
const BADGE_STROKE = "#ffffff";

const RASTER_SIZES = [
  { filename: "favicon-16x16.png", size: 16 },
  { filename: "favicon-32x32.png", size: 32 },
  { filename: "apple-touch-icon.png", size: 180 },
  { filename: "android-chrome-192x192.png", size: 192 },
  { filename: "android-chrome-512x512.png", size: 512 },
];

const toRelative = (targetPath: string): string => path.relative(ROOT, targetPath);

const writeIfChanged = (filePath: string, content: Buffer | string): boolean => {
  const nextBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const currentBuffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
  if (currentBuffer?.equals(nextBuffer)) {
    return false;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, nextBuffer);
  return true;
};

const extractCanonicalMarkSpec = (
  canonicalSvg: string,
): {
  pathData: string;
  circleRadius: number;
  stroke: { circle: number; l: number };
} => {
  const circleMatch = canonicalSvg.match(
    /<circle[^>]*\sr="([^"]+)"[^>]*\sstroke-width="([^"]+)"[^>]*\/?>/i,
  );
  if (!circleMatch?.[1] || !circleMatch[2]) {
    throw new Error(`Unable to locate canonical ring spec in ${toRelative(CANONICAL_LOGO_PATH)}.`);
  }

  const pathMatch = canonicalSvg.match(/<path[^>]*\sd="([^"]+)"[^>]*\/?>/i);
  const pathStrokeMatch = canonicalSvg.match(/<path[^>]*\sstroke-width="([^"]+)"[^>]*\/?>/i);
  if (!pathMatch?.[1] || !pathStrokeMatch?.[1]) {
    throw new Error(`Unable to locate canonical L path in ${toRelative(CANONICAL_LOGO_PATH)}.`);
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

const buildBadgeSvg = (input: {
  pathData: string;
  circleRadius: number;
  stroke: { circle: number; l: number };
}): string =>
  [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="title desc">',
    '  <title id="title">OpenLinks favicon badge</title>',
    '  <desc id="desc">OpenLinks logo mark in a high-contrast circular badge for tiny-icon legibility.</desc>',
    `  <circle cx="50" cy="50" r="49" fill="${BADGE_BG}" />`,
    `  <circle cx="50" cy="50" r="${input.circleRadius}" fill="none" stroke="${BADGE_STROKE}" stroke-width="${input.stroke.circle}" />`,
    `  <path d="${input.pathData}" fill="none" stroke="${BADGE_STROKE}" stroke-width="${input.stroke.l}" stroke-linecap="round" stroke-linejoin="round" />`,
    "</svg>",
    "",
  ].join("\n");

const renderPng = (svgSource: string, size: number): Buffer => {
  const renderer = new Resvg(svgSource, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return renderer.render().asPng();
};

const buildManifest = (target: BrandAssetTarget): string => {
  const payload = {
    name: target.appName,
    short_name: target.shortName,
    id: ".",
    start_url: ".",
    scope: ".",
    icons: [
      {
        src: "android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    theme_color: THEME_COLOR,
    background_color: THEME_COLOR,
    display: "standalone",
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
};

const generateForTarget = async (input: {
  target: BrandAssetTarget;
  badgeSvg: string;
  canonicalSvg: string;
  quiet: boolean;
}): Promise<void> => {
  const { target, badgeSvg, canonicalSvg, quiet } = input;
  const touchedFiles: string[] = [];

  const faviconSvgPath = path.join(target.rootDir, "favicon.svg");
  if (writeIfChanged(faviconSvgPath, badgeSvg)) {
    touchedFiles.push(faviconSvgPath);
  }

  const rasterPathsByName = new Map<string, string>();
  for (const entry of RASTER_SIZES) {
    const pngBuffer = renderPng(badgeSvg, entry.size);
    const pngPath = path.join(target.rootDir, entry.filename);
    if (writeIfChanged(pngPath, pngBuffer)) {
      touchedFiles.push(pngPath);
    }
    rasterPathsByName.set(entry.filename, pngPath);
  }

  const faviconIcoPath = path.join(target.rootDir, "favicon.ico");
  const favicon16Path = rasterPathsByName.get("favicon-16x16.png");
  const favicon32Path = rasterPathsByName.get("favicon-32x32.png");
  if (!favicon16Path || !favicon32Path) {
    throw new Error(`Missing favicon PNG intermediates for target '${target.id}'.`);
  }

  const icoBuffer = await pngToIco([favicon16Path, favicon32Path]);
  if (writeIfChanged(faviconIcoPath, icoBuffer)) {
    touchedFiles.push(faviconIcoPath);
  }

  const manifestPath = path.join(target.rootDir, "site.webmanifest");
  if (writeIfChanged(manifestPath, buildManifest(target))) {
    touchedFiles.push(manifestPath);
  }

  const targetCanonicalMarkPath = path.join(target.rootDir, CANONICAL_BRANDING_RELATIVE_PATH);
  if (writeIfChanged(targetCanonicalMarkPath, canonicalSvg)) {
    touchedFiles.push(targetCanonicalMarkPath);
  }

  if (!quiet) {
    console.log(`Brand assets generated for ${target.id}: ${toRelative(target.rootDir)}`);
    for (const touchedFile of touchedFiles) {
      console.log(`- ${toRelative(touchedFile)}`);
    }
  }
};

export const generateOpenLinksBrandAssets = async (
  options?: GenerateBrandAssetsOptions,
): Promise<void> => {
  const quiet = options?.quiet ?? false;
  if (!fs.existsSync(CANONICAL_LOGO_PATH)) {
    throw new Error(
      `Canonical logo source is missing: ${toRelative(CANONICAL_LOGO_PATH)}. Generate logo assets first.`,
    );
  }

  const canonicalSvg = fs.readFileSync(CANONICAL_LOGO_PATH, "utf8");
  const canonicalMarkSpec = extractCanonicalMarkSpec(canonicalSvg);
  const badgeSvg = buildBadgeSvg(canonicalMarkSpec);

  for (const target of TARGETS) {
    await generateForTarget({
      target,
      badgeSvg,
      canonicalSvg,
      quiet,
    });
  }
};

if (import.meta.main) {
  generateOpenLinksBrandAssets().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to generate OpenLinks brand assets: ${message}`);
    process.exitCode = 1;
  });
}
