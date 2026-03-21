import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  normalizeGitHubRepositoryRef,
  normalizeGitHubRepositorySlug,
  resolveGitHubRepositoryRef,
} from "../src/lib/github-repository";
import {
  type OpenClawPromptRepositoryOptions,
  buildOpenClawBootstrapPrompt,
  buildOpenClawUpdatePrompt,
} from "../src/lib/openclaw-prompts";
import { resolveGitHubRepositorySlug } from "./lib/github-repository";

const ROOT = process.cwd();

export const OPENCLAW_BOOTSTRAP_PROMPT_MARKER = "OPENCLAW_BOOTSTRAP_PROMPT";
export const OPENCLAW_UPDATE_PROMPT_MARKER = "OPENCLAW_UPDATE_PROMPT";

export type OpenClawPromptBlockKind = "bootstrap" | "update";

export interface OpenClawPromptSyncTarget {
  filePath: string;
  blockKinds: OpenClawPromptBlockKind[];
}

export interface SyncOpenClawPromptsOptions extends OpenClawPromptRepositoryOptions {
  check?: boolean;
  rootDir?: string;
  targets?: OpenClawPromptSyncTarget[];
}

interface CliArgs extends OpenClawPromptRepositoryOptions {
  check: boolean;
}

interface PromptBlockDefinition {
  buildPrompt: (options: OpenClawPromptRepositoryOptions) => string;
  markerName: string;
}

interface ReplaceManagedPromptBlockResult {
  changed: boolean;
  content: string;
}

const PROMPT_BLOCK_DEFINITIONS: Record<OpenClawPromptBlockKind, PromptBlockDefinition> = {
  bootstrap: {
    buildPrompt: buildOpenClawBootstrapPrompt,
    markerName: OPENCLAW_BOOTSTRAP_PROMPT_MARKER,
  },
  update: {
    buildPrompt: buildOpenClawUpdatePrompt,
    markerName: OPENCLAW_UPDATE_PROMPT_MARKER,
  },
};

export const OPENCLAW_PROMPT_SYNC_TARGETS: OpenClawPromptSyncTarget[] = [
  {
    filePath: "README.md",
    blockKinds: ["bootstrap", "update"],
  },
  {
    filePath: "docs/quickstart.md",
    blockKinds: ["bootstrap", "update"],
  },
  {
    filePath: "docs/openclaw-bootstrap.md",
    blockKinds: ["bootstrap"],
  },
  {
    filePath: "docs/openclaw-update-crud.md",
    blockKinds: ["update"],
  },
  {
    filePath: "docs/ai-guided-customization.md",
    blockKinds: ["update"],
  },
];

const buildPromptMarker = (markerName: string, position: "start" | "end"): string =>
  `<!-- ${markerName}:${position} -->`;

const resolveAbsolutePath = (rootDir: string, filePath: string): string =>
  path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);

const parseArgs = (argv = process.argv.slice(2)): CliArgs => {
  const args: CliArgs = {
    check: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const rawArgument = argv[index];
    if (rawArgument === "--check") {
      args.check = true;
      continue;
    }

    if (rawArgument === "--repository-slug" || rawArgument.startsWith("--repository-slug=")) {
      args.repositorySlug = readFlagValue(argv, rawArgument, index);
      if (rawArgument === "--repository-slug") {
        index += 1;
      }
      continue;
    }

    if (rawArgument === "--repository-ref" || rawArgument.startsWith("--repository-ref=")) {
      args.repositoryRef = readFlagValue(argv, rawArgument, index);
      if (rawArgument === "--repository-ref") {
        index += 1;
      }
      continue;
    }

    throw new Error(`Unsupported argument: ${rawArgument}`);
  }

  return args;
};

const readFlagValue = (argv: string[], rawArgument: string, index: number): string => {
  const [, maybeInlineValue] = rawArgument.split("=", 2);
  if (typeof maybeInlineValue === "string") {
    return maybeInlineValue;
  }

  const nextValue = argv[index + 1];
  if (!nextValue) {
    throw new Error(`Missing value for ${rawArgument}`);
  }

  return nextValue;
};

const resolvePromptSyncRepositorySlug = (maybeRepositorySlug?: string): string => {
  if (typeof maybeRepositorySlug === "string") {
    const normalizedRepositorySlug = normalizeGitHubRepositorySlug(maybeRepositorySlug);
    if (!normalizedRepositorySlug) {
      throw new Error(`Invalid GitHub repository slug: ${maybeRepositorySlug}`);
    }
    return normalizedRepositorySlug;
  }

  return resolveGitHubRepositorySlug(undefined);
};

const resolvePromptSyncRepositoryRef = (maybeRepositoryRef?: string): string => {
  if (typeof maybeRepositoryRef === "string") {
    const normalizedRepositoryRef = normalizeGitHubRepositoryRef(maybeRepositoryRef);
    if (!normalizedRepositoryRef) {
      throw new Error(`Invalid GitHub repository ref: ${maybeRepositoryRef}`);
    }
    return normalizedRepositoryRef;
  }

  return resolveGitHubRepositoryRef(process.env.OPENLINKS_REPOSITORY_DOCS_REF);
};

export const renderManagedPromptBlock = (markerName: string, promptText: string): string =>
  [
    buildPromptMarker(markerName, "start"),
    "```text",
    promptText,
    "```",
    buildPromptMarker(markerName, "end"),
  ].join("\n");

export const replaceManagedPromptBlock = (
  content: string,
  markerName: string,
  promptText: string,
): ReplaceManagedPromptBlockResult => {
  const startMarker = buildPromptMarker(markerName, "start");
  const endMarker = buildPromptMarker(markerName, "end");
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`Unable to find marker block '${startMarker}' -> '${endMarker}'.`);
  }

  if (content.indexOf(startMarker, startIndex + startMarker.length) >= 0) {
    throw new Error(`Marker '${startMarker}' appears multiple times in the same file.`);
  }

  if (content.indexOf(endMarker, endIndex + endMarker.length) >= 0) {
    throw new Error(`Marker '${endMarker}' appears multiple times in the same file.`);
  }

  const replacement = renderManagedPromptBlock(markerName, promptText);
  const nextContent =
    content.slice(0, startIndex) + replacement + content.slice(endIndex + endMarker.length);

  return {
    changed: nextContent !== content,
    content: nextContent,
  };
};

export const syncOpenClawPrompts = (options: SyncOpenClawPromptsOptions = {}): string[] => {
  const rootDir = options.rootDir ?? ROOT;
  const repositorySlug = resolvePromptSyncRepositorySlug(options.repositorySlug);
  const repositoryRef = resolvePromptSyncRepositoryRef(options.repositoryRef);
  const targets = options.targets ?? OPENCLAW_PROMPT_SYNC_TARGETS;
  const changedFiles: string[] = [];

  for (const target of targets) {
    const absoluteFilePath = resolveAbsolutePath(rootDir, target.filePath);
    const originalContent = fs.readFileSync(absoluteFilePath, "utf8");

    let nextContent = originalContent;
    for (const blockKind of target.blockKinds) {
      const definition = PROMPT_BLOCK_DEFINITIONS[blockKind];
      const replacement = replaceManagedPromptBlock(
        nextContent,
        definition.markerName,
        definition.buildPrompt({
          repositoryRef,
          repositorySlug,
        }),
      );
      nextContent = replacement.content;
    }

    if (nextContent === originalContent) {
      continue;
    }

    changedFiles.push(target.filePath);

    if (options.check) {
      continue;
    }

    fs.writeFileSync(absoluteFilePath, nextContent, "utf8");
  }

  if (options.check && changedFiles.length > 0) {
    throw new Error(
      `OpenClaw prompt blocks are out of sync in: ${changedFiles.join(", ")}. Run bun run openclaw:prompts:sync.`,
    );
  }

  return changedFiles;
};

export const runOpenClawPromptSync = (argv = process.argv.slice(2)): string[] => {
  const args = parseArgs(argv);

  return syncOpenClawPrompts({
    check: args.check,
    repositoryRef: args.repositoryRef,
    repositorySlug: args.repositorySlug,
  });
};

if (import.meta.main) {
  try {
    const changedFiles = runOpenClawPromptSync();
    if (changedFiles.length === 0) {
      console.log("OpenClaw prompt blocks are already in sync.");
    } else {
      console.log("Synced OpenClaw prompt blocks:");
      for (const filePath of changedFiles) {
        console.log(`- ${filePath}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
