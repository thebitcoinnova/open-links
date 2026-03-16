import { createHash } from "node:crypto";
import { access, copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type DeployTarget,
  deploymentConfig,
  getCanonicalUrl,
  getDeployTargetConfig,
  getExpectedAssetPrefix,
  getRobotsTxt,
  normalizeBasePath,
  parseDeployTarget,
} from "../../src/lib/deployment-config";

const indexableRoutes = ["/"] as const;

export type DeployCacheClass = "html" | "metadata" | "immutable" | "asset";

export interface DeployManifestFile {
  cacheClass: DeployCacheClass;
  path: string;
  sha256: string;
  size: number;
}

export interface DeployManifest {
  artifactHash: string;
  basePath: string;
  canonicalOrigin: string;
  files: DeployManifestFile[];
  publicOrigin: string;
  routes: string[];
  target: DeployTarget;
  version: 1;
}

export interface DeployManifestDiff {
  changed: boolean;
  deletes: string[];
  unchanged: string[];
  uploads: DeployManifestFile[];
}

export async function finalizeArtifact(outputDir: string, rawTarget?: string) {
  const target = parseDeployTarget(rawTarget);

  await mkdir(outputDir, { recursive: true });
  await ensureNoJekyllFile(outputDir);
  await ensureRootNotFoundFile(outputDir);
  await writeSiteMetadataFiles(outputDir, target);
  await assertArtifactMatchesTarget(outputDir, target);

  return writeDeployManifest(outputDir, target);
}

export async function writeDeployManifest(outputDir: string, rawTarget?: string) {
  const target = parseDeployTarget(rawTarget);
  const manifest = await createDeployManifest(outputDir, target);
  const manifestPath = path.join(outputDir, "deploy-manifest.json");

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}

export async function createDeployManifest(
  outputDir: string,
  target: DeployTarget,
): Promise<DeployManifest> {
  const files = await collectArtifactFiles(outputDir);
  const targetConfig = getDeployTargetConfig(target);
  const basePath = normalizeBasePath(targetConfig.basePath);
  const artifactHash = createHash("sha256")
    .update(
      files.map((file) => `${file.path}:${file.sha256}:${file.size}:${file.cacheClass}`).join("\n"),
    )
    .digest("hex");

  return {
    artifactHash,
    basePath,
    canonicalOrigin: deploymentConfig.primaryCanonicalOrigin,
    files,
    publicOrigin: targetConfig.publicOrigin,
    routes: [...indexableRoutes],
    target,
    version: 1,
  };
}

export async function readDeployManifest(manifestPath: string) {
  const content = await readFile(manifestPath, "utf8");
  return JSON.parse(content) as DeployManifest;
}

export async function assertDeployArtifactIntegrity(outputDir: string, manifest: DeployManifest) {
  const missingPaths: string[] = [];

  for (const file of manifest.files) {
    try {
      await access(path.join(outputDir, file.path));
    } catch {
      missingPaths.push(file.path);
    }
  }

  if (missingPaths.length === 0) {
    return;
  }

  const samplePaths = missingPaths.slice(0, 3).join(", ");
  const remainder = missingPaths.length > 3 ? ", ..." : "";
  throw new Error(
    `Artifact directory ${outputDir} is missing ${missingPaths.length} file(s) listed in deploy-manifest.json: ${samplePaths}${remainder}. This usually means the artifact was archived or uploaded without hidden files. Rebuild the artifact or preserve hidden files during upload and download.`,
  );
}

export async function collectArtifactFiles(outputDir: string) {
  const relativePaths = await listRelativeFiles(outputDir);
  const deployablePaths = relativePaths.filter(
    (relativePath) => relativePath !== "deploy-manifest.json",
  );
  const files = await Promise.all(
    deployablePaths.map(async (relativePath) => {
      const filePath = path.join(outputDir, relativePath);
      const content = await readFile(filePath);

      return {
        cacheClass: classifyArtifactPath(relativePath),
        path: relativePath,
        sha256: createHash("sha256").update(content).digest("hex"),
        size: content.byteLength,
      } satisfies DeployManifestFile;
    }),
  );

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function diffDeployManifests(
  localManifest: DeployManifest,
  maybeRemoteManifest: DeployManifest | null,
) {
  if (!maybeRemoteManifest) {
    return {
      changed: true,
      deletes: [],
      unchanged: [],
      uploads: localManifest.files,
    } satisfies DeployManifestDiff;
  }

  const remoteFiles = new Map(maybeRemoteManifest.files.map((file) => [file.path, file]));
  const localFiles = new Map(localManifest.files.map((file) => [file.path, file]));
  const uploads: DeployManifestFile[] = [];
  const unchanged: string[] = [];

  for (const localFile of localManifest.files) {
    const maybeRemoteFile = remoteFiles.get(localFile.path);

    if (
      !maybeRemoteFile ||
      maybeRemoteFile.sha256 !== localFile.sha256 ||
      maybeRemoteFile.cacheClass !== localFile.cacheClass
    ) {
      uploads.push(localFile);
      continue;
    }

    unchanged.push(localFile.path);
  }

  const deletes = maybeRemoteManifest.files
    .filter((remoteFile) => !localFiles.has(remoteFile.path))
    .map((remoteFile) => remoteFile.path)
    .sort((left, right) => left.localeCompare(right));

  return {
    changed:
      localManifest.target !== maybeRemoteManifest.target ||
      localManifest.basePath !== maybeRemoteManifest.basePath ||
      localManifest.publicOrigin !== maybeRemoteManifest.publicOrigin ||
      localManifest.canonicalOrigin !== maybeRemoteManifest.canonicalOrigin ||
      uploads.length > 0 ||
      deletes.length > 0,
    deletes,
    unchanged: unchanged.sort((left, right) => left.localeCompare(right)),
    uploads: uploads.sort((left, right) => left.path.localeCompare(right.path)),
  } satisfies DeployManifestDiff;
}

export function classifyArtifactPath(relativePath: string): DeployCacheClass {
  if (relativePath.endsWith(".html")) {
    return "html";
  }

  if (
    relativePath === ".nojekyll" ||
    relativePath === "deploy-manifest.json" ||
    relativePath === "favicon.ico" ||
    relativePath === "robots.txt" ||
    relativePath === "sitemap.xml" ||
    relativePath === "site.webmanifest"
  ) {
    return "metadata";
  }

  const basename = path.basename(stripCompressionExtension(relativePath));
  if (/-[A-Za-z0-9_-]{8,}\./.test(basename)) {
    return "immutable";
  }

  return "asset";
}

export function getCacheControlForArtifactPath(relativePath: string) {
  const cacheClass = classifyArtifactPath(relativePath);

  switch (cacheClass) {
    case "html":
      return deploymentConfig.htmlCacheControl;
    case "immutable":
      return deploymentConfig.immutableCacheControl;
    case "metadata":
      return deploymentConfig.metadataCacheControl;
    case "asset":
      return deploymentConfig.mutableAssetCacheControl;
  }
}

export function getInvalidationPaths(changedPaths: string[]) {
  const invalidationPaths = new Set<string>();

  for (const relativePath of changedPaths) {
    if (classifyArtifactPath(relativePath) === "immutable") {
      continue;
    }

    if (relativePath === "index.html") {
      invalidationPaths.add("/");
      invalidationPaths.add("/index.html");
      continue;
    }

    if (relativePath.endsWith("/index.html")) {
      const directoryPath = `/${relativePath.slice(0, -"/index.html".length)}`;
      invalidationPaths.add(directoryPath);
      invalidationPaths.add(`${directoryPath}/`);
      invalidationPaths.add(`${directoryPath}/index.html`);
      continue;
    }

    invalidationPaths.add(`/${relativePath}`);
  }

  return Array.from(invalidationPaths).sort((left, right) => left.localeCompare(right));
}

export function getS3ContentType(relativePath: string) {
  const normalizedPath = stripCompressionExtension(relativePath);

  switch (path.extname(normalizedPath)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".webp":
      return "image/webp";
    case ".xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

export function getS3ContentEncoding(relativePath: string) {
  if (relativePath.endsWith(".br")) {
    return "br";
  }

  if (relativePath.endsWith(".gz")) {
    return "gzip";
  }

  return null;
}

export async function copyArtifact(sourceDir: string, destinationDir: string) {
  await rm(destinationDir, { force: true, recursive: true });
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
}

export async function assertArtifactMatchesTarget(outputDir: string, rawTarget?: string) {
  const target = parseDeployTarget(rawTarget);
  const htmlFilePaths = (await listRelativeFiles(outputDir)).filter((relativePath) =>
    relativePath.endsWith(".html"),
  );
  const assetPrefix = getExpectedAssetPrefix(target);
  const githubPagesBasePath = normalizeBasePath(deploymentConfig.githubPagesBasePath);
  const pagesBasePathPattern = new RegExp(
    `(?:href|src)="${escapeRegExp(deploymentConfig.githubPagesBasePath)}(?:assets/|favicon|site\\.webmanifest|apple-touch-icon|openlinks-social-fallback)`,
  );
  const unprefixedRootReferencePattern =
    githubPagesBasePath === "/"
      ? /(?:href|src)="\/(?!\/|https?:|$)/
      : new RegExp(`(?:href|src)="/(?!/|${escapeRegExp(githubPagesBasePath.slice(1))}|https?:|$)`);

  for (const relativePath of htmlFilePaths) {
    const html = await readFile(path.join(outputDir, relativePath), "utf8");

    if (!html.includes(assetPrefix)) {
      throw new Error(
        `Artifact ${relativePath} did not contain the expected asset prefix ${assetPrefix}.`,
      );
    }

    if (target === "aws" && pagesBasePathPattern.test(html)) {
      throw new Error(`Artifact ${relativePath} still contains the GitHub Pages base path.`);
    }

    if (target === "github-pages") {
      const maybeUnprefixedReference = html.match(unprefixedRootReferencePattern);
      if (maybeUnprefixedReference) {
        throw new Error(
          `Artifact ${relativePath} still contains an unprefixed root reference: ${maybeUnprefixedReference[0]}`,
        );
      }

      if (!html.includes('meta name="robots" content="noindex, nofollow"')) {
        throw new Error(`Artifact ${relativePath} did not include a noindex robots meta tag.`);
      }
    }

    if (target === "aws" && !html.includes('meta name="robots" content="index, follow"')) {
      throw new Error(`Artifact ${relativePath} did not include an indexable robots meta tag.`);
    }
  }
}

async function writeSiteMetadataFiles(outputDir: string, target: DeployTarget) {
  await writeFile(path.join(outputDir, "robots.txt"), getRobotsTxt(target), "utf8");
  await writeFile(path.join(outputDir, "sitemap.xml"), buildSitemapXml(), "utf8");
}

function buildSitemapXml() {
  const urls = indexableRoutes
    .map((route) => `  <url><loc>${escapeXml(getCanonicalUrl(route))}</loc></url>`)
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function ensureNoJekyllFile(outputDir: string) {
  await writeFile(path.join(outputDir, ".nojekyll"), "", "utf8");
}

async function ensureRootNotFoundFile(outputDir: string) {
  const nestedNotFoundFile = path.join(outputDir, "404", "index.html");
  const rootNotFoundFile = path.join(outputDir, "404.html");

  try {
    await access(nestedNotFoundFile);
    await copyFile(nestedNotFoundFile, rootNotFoundFile);
  } catch {
    // Builds that already emit /404.html do not need the fallback copy.
  }
}

async function listRelativeFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        return listRelativeFiles(rootDir, fullPath);
      }

      if (entry.isFile()) {
        return [path.relative(rootDir, fullPath)];
      }

      return [];
    }),
  );

  return files.flat().sort((left, right) => left.localeCompare(right));
}

function stripCompressionExtension(relativePath: string) {
  return relativePath.replace(/\.(br|gz)$/, "");
}
