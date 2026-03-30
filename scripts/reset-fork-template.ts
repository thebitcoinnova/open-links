import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { replaceReadmeDeployUrlBlock } from "./lib/readme-deploy-urls";

const ROOT = process.cwd();

const RESET_TARGET_PATHS = {
  followerHistoryIndex: "public/history/followers/index.json",
  links: "data/links.json",
  profile: "data/profile.json",
  readme: "README.md",
  site: "data/site.json",
} as const;

const GENERATED_FILE_PATHS = [
  "public/badges/openlinks.svg",
  "data/generated/rich-metadata.json",
  "data/generated/rich-enrichment-report.json",
  "data/generated/quality-report.json",
  "data/generated/quality-report.md",
  "data/cache/profile-avatar.json",
  "data/cache/profile-avatar.runtime.json",
  "data/cache/content-images.json",
  "data/cache/content-images.runtime.json",
  "data/cache/rich-public-cache.runtime.json",
  "public/generated/seo/social-preview.svg",
  "public/generated/seo/social-preview.png",
] as const;

const RESET_DIRECTORIES = [
  {
    path: "public/cache/content-images",
    preserve: [] as string[],
  },
  {
    path: "public/cache/profile-avatar",
    preserve: [] as string[],
  },
  {
    path: "public/cache/rich-authenticated",
    preserve: [".gitkeep"],
  },
  {
    path: "public/history/followers",
    preserve: [],
  },
] as const;

const RESET_PROFILE = {
  avatar: "https://avatars.githubusercontent.com/u/583231?v=4",
  bio: "A clean OpenLinks starter profile.",
  custom: {},
  headline: "Customize this fork",
  name: "Your Name",
};

const RESET_LINKS = {
  custom: {},
  links: [
    {
      custom: {},
      enabled: true,
      icon: "github",
      id: "github",
      label: "GitHub",
      order: 1,
      type: "simple",
      url: "https://github.com",
    },
    {
      custom: {},
      enabled: true,
      icon: "x",
      id: "x",
      label: "X",
      order: 2,
      type: "simple",
      url: "https://x.com",
    },
    {
      custom: {},
      enabled: true,
      id: "website",
      label: "Website",
      order: 3,
      type: "simple",
      url: "https://example.com",
    },
  ],
  order: ["github", "x", "website"],
};

const RESET_SITE = {
  baseUrl: "/",
  custom: {},
  description: "Minimal starter for OpenLinks",
  quality: {
    seo: {
      canonicalBaseUrl: "https://example.com/",
    },
  },
  theme: {
    active: "sleek",
    available: ["sleek", "sleek-emerald", "sleek-mono", "daybreak"],
  },
  title: "Minimal OpenLinks",
  ui: {
    footer: {
      ctaLabel: "Create Your OpenLinks",
      description:
        "OpenLinks is a personal, free, open source, version-controlled links site.\nFork it, customize it, and publish fast.",
      prompt: {
        enabled: true,
        explanation:
          "Paste this bootstrap prompt into OpenClaw, Claude, or Codex to create a new OpenLinks site from this repository.",
        title: "Create your own OpenLinks site",
      },
      showBuildInfo: true,
    },
  },
};

const EMPTY_FOLLOWER_HISTORY_INDEX = {
  entries: [],
  updatedAt: "1970-01-01T00:00:00.000Z",
  version: 1,
};

const EMPTY_RICH_PUBLIC_CACHE = {
  $schema: "../../schema/rich-public-cache.schema.json",
  entries: {},
  version: 1,
};

const EMPTY_RICH_AUTHENTICATED_CACHE = {
  $schema: "../../schema/rich-authenticated-cache.schema.json",
  entries: {},
  updatedAt: "1970-01-01T00:00:00.000Z",
  version: 1,
};

const FORK_TEMPLATE_SIGNAL_CHECKS = [
  {
    filePath: "data/profile.json",
    label: "profile name still matches seeded upstream identity",
    pattern: /"name"\s*:\s*"Peter Ryszkiewicz"/u,
  },
  {
    filePath: "data/profile.json",
    label: "profile links still point at pRizz",
    pattern: /https:\/\/github\.com\/pRizz/u,
  },
  {
    filePath: "data/links.json",
    label: "links still point at seeded upstream identities",
    pattern:
      /https:\/\/(?:github\.com\/pRizz|x\.com\/pryszkie|primal\.net\/peterryszkiewicz|openlinks\.us|www\.linkedin\.com\/in\/peter-ryszkiewicz)/u,
  },
  {
    filePath: "data/site.json",
    label: "site canonical still points at openlinks.us",
    pattern: /"canonicalBaseUrl"\s*:\s*"https:\/\/openlinks\.us\/"/u,
  },
  {
    filePath: "README.md",
    label: "README deploy URLs still advertise upstream production hosts",
    pattern: /https:\/\/(?:openlinks\.us\/?|prizz\.github\.io\/open-links\/?)/u,
  },
  {
    filePath: "public/badges/openlinks.svg",
    label: "published badge still names the upstream seed identity",
    pattern: /Peter Ryszkiewicz/u,
  },
  {
    filePath: "data/cache/rich-public-cache.json",
    label: "public rich cache still contains upstream seed identity",
    pattern: /Peter Ryszkiewicz/u,
  },
  {
    filePath: "data/cache/rich-authenticated-cache.json",
    label: "authenticated rich cache still contains upstream seed identity",
    pattern: /Peter Ryszkiewicz/u,
  },
] as const;

export interface ForkResetOptions {
  check?: boolean;
  force?: boolean;
  rootDir?: string;
}

export interface ForkResetResult {
  changed: boolean;
  check: boolean;
  removedPaths: string[];
  rewrittenFiles: string[];
  seedSignals: string[];
}

interface CliArgs extends ForkResetOptions {}

const resolveAbsolutePath = (rootDir: string, relativePath: string): string =>
  path.isAbsolute(relativePath) ? relativePath : path.join(rootDir, relativePath);

const readFileIfExists = (absolutePath: string): string | undefined => {
  if (!fs.existsSync(absolutePath)) {
    return undefined;
  }

  return fs.readFileSync(absolutePath, "utf8");
};

const writeFileIfChanged = (
  absolutePath: string,
  content: string,
  options: { check: boolean; rewrittenFiles: string[]; rootDir: string },
) => {
  const currentContent = readFileIfExists(absolutePath);
  if (currentContent === content) {
    return;
  }

  options.rewrittenFiles.push(path.relative(options.rootDir, absolutePath));
  if (options.check) {
    return;
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
};

const removeFileIfExists = (
  absolutePath: string,
  options: { check: boolean; removedPaths: string[]; rootDir: string },
) => {
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  options.removedPaths.push(path.relative(options.rootDir, absolutePath));
  if (options.check) {
    return;
  }

  fs.rmSync(absolutePath, { force: true, recursive: true });
};

const clearDirectoryContents = (
  absoluteDirectoryPath: string,
  preserve: readonly string[],
  options: { check: boolean; removedPaths: string[]; rootDir: string },
) => {
  fs.mkdirSync(absoluteDirectoryPath, { recursive: true });

  const preserveSet = new Set(preserve);
  for (const entry of fs.readdirSync(absoluteDirectoryPath, { withFileTypes: true })) {
    if (preserveSet.has(entry.name)) {
      continue;
    }

    const absoluteEntryPath = path.join(absoluteDirectoryPath, entry.name);
    options.removedPaths.push(path.relative(options.rootDir, absoluteEntryPath));
    if (!options.check) {
      fs.rmSync(absoluteEntryPath, { force: true, recursive: true });
    }
  }

  if (options.check) {
    return;
  }

  for (const preservedEntry of preserve) {
    const absolutePreservedPath = path.join(absoluteDirectoryPath, preservedEntry);
    fs.mkdirSync(path.dirname(absolutePreservedPath), { recursive: true });
    if (!fs.existsSync(absolutePreservedPath)) {
      fs.writeFileSync(absolutePreservedPath, "", "utf8");
    }
  }
};

export const detectForkTemplateSeedSignals = (rootDir = ROOT): string[] => {
  const signals: string[] = [];

  for (const check of FORK_TEMPLATE_SIGNAL_CHECKS) {
    const content = readFileIfExists(resolveAbsolutePath(rootDir, check.filePath));
    if (!content) {
      continue;
    }

    if (check.pattern.test(content)) {
      signals.push(check.label);
    }
  }

  return signals;
};

const parseArgs = (argv = process.argv.slice(2)): CliArgs => {
  const args: CliArgs = {
    check: false,
    force: false,
  };

  for (const rawArgument of argv) {
    if (rawArgument === "--check") {
      args.check = true;
      continue;
    }

    if (rawArgument === "--force") {
      args.force = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${rawArgument}`);
  }

  return args;
};

const buildResetReadmeContent = (rootDir: string): string => {
  const readmePath = resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.readme);
  const readmeContent = fs.readFileSync(readmePath, "utf8");
  return replaceReadmeDeployUrlBlock(readmeContent, []).content;
};

const serializeJson = (payload: unknown): string => `${JSON.stringify(payload, null, 2)}\n`;

export const runForkReset = (options: ForkResetOptions = {}): ForkResetResult => {
  const rootDir = options.rootDir ?? ROOT;
  const seedSignals = detectForkTemplateSeedSignals(rootDir);

  if (seedSignals.length === 0 && !options.force) {
    throw new Error(
      "Refusing to reset because this repo no longer looks like inherited starter state. Re-run with --force if you intentionally want to wipe existing customized data.",
    );
  }

  const rewrittenFiles: string[] = [];
  const removedPaths: string[] = [];
  const writeOptions = {
    check: options.check ?? false,
    rewrittenFiles,
    rootDir,
  };
  const removeOptions = {
    check: options.check ?? false,
    removedPaths,
    rootDir,
  };

  writeFileIfChanged(
    resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.profile),
    serializeJson(RESET_PROFILE),
    writeOptions,
  );
  writeFileIfChanged(
    resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.links),
    serializeJson(RESET_LINKS),
    writeOptions,
  );
  writeFileIfChanged(
    resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.site),
    serializeJson(RESET_SITE),
    writeOptions,
  );
  writeFileIfChanged(
    resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.readme),
    buildResetReadmeContent(rootDir),
    writeOptions,
  );
  writeFileIfChanged(
    resolveAbsolutePath(rootDir, "data/cache/rich-public-cache.json"),
    serializeJson(EMPTY_RICH_PUBLIC_CACHE),
    writeOptions,
  );
  writeFileIfChanged(
    resolveAbsolutePath(rootDir, "data/cache/rich-authenticated-cache.json"),
    serializeJson(EMPTY_RICH_AUTHENTICATED_CACHE),
    writeOptions,
  );

  for (const relativeFilePath of GENERATED_FILE_PATHS) {
    removeFileIfExists(resolveAbsolutePath(rootDir, relativeFilePath), removeOptions);
  }

  for (const directoryTarget of RESET_DIRECTORIES) {
    clearDirectoryContents(
      resolveAbsolutePath(rootDir, directoryTarget.path),
      directoryTarget.preserve,
      removeOptions,
    );
  }

  writeFileIfChanged(
    resolveAbsolutePath(rootDir, RESET_TARGET_PATHS.followerHistoryIndex),
    serializeJson(EMPTY_FOLLOWER_HISTORY_INDEX),
    writeOptions,
  );

  return {
    changed: rewrittenFiles.length > 0 || removedPaths.length > 0,
    check: options.check ?? false,
    removedPaths,
    rewrittenFiles,
    seedSignals,
  };
};

const printResult = (result: ForkResetResult): void => {
  const prefix = result.check ? "Fork reset check" : "Fork reset";
  const modeLine =
    result.seedSignals.length > 0
      ? `Starter-state signals detected: ${result.seedSignals.join("; ")}`
      : "Starter-state signals not detected; running due to --force.";

  console.log(`${prefix}: ${result.changed ? "changes planned" : "already clean"}.`);
  console.log(modeLine);

  if (result.rewrittenFiles.length > 0) {
    console.log("Rewritten files:");
    for (const filePath of result.rewrittenFiles) {
      console.log(`- ${filePath}`);
    }
  }

  if (result.removedPaths.length > 0) {
    console.log("Removed generated/cache paths:");
    for (const removedPath of result.removedPaths) {
      console.log(`- ${removedPath}`);
    }
  }
};

if (import.meta.main) {
  const args = parseArgs();
  const result = runForkReset(args);
  printResult(result);
}
