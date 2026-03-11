import fs from "node:fs";
import path from "node:path";

interface Args {
  readmePath: string;
  anchorLines: string[];
  imagePath: string;
  imageAlt: string;
  startMarker: string;
  endMarker: string;
}

interface UpdateReadmeScreenshotBlockArgs {
  anchorLines: string[];
  imagePath: string;
  imageAlt: string;
  startMarker: string;
  endMarker: string;
}

const ROOT = process.cwd();
const DEFAULT_SCREENSHOT_ANCHOR = "<!-- OPENLINKS_SCREENSHOT_ANCHOR -->";
const LEGACY_SCREENSHOT_ANCHOR_LINES = [
  DEFAULT_SCREENSHOT_ANCHOR,
  "This project is developer-first, but that does not mean raw JSON should be your default CRUD surface. For most maintainers, the recommended path is:",
  "This project is developer-first: fork the repo, edit JSON, push, and publish.",
];

const parseArgs = (): Args => {
  const rawArgs = process.argv.slice(2);

  const getFlag = (name: string): string | undefined => {
    const index = rawArgs.indexOf(name);
    if (index < 0) return undefined;
    return rawArgs[index + 1];
  };

  const maybeAnchorLine = getFlag("--anchor");

  return {
    readmePath: getFlag("--readme") ?? "README.md",
    anchorLines: maybeAnchorLine ? [maybeAnchorLine] : LEGACY_SCREENSHOT_ANCHOR_LINES,
    imagePath: getFlag("--image-path") ?? "docs/assets/openlinks-preview.png",
    imageAlt: getFlag("--image-alt") ?? "OpenLinks preview",
    startMarker: getFlag("--start-marker") ?? "<!-- OPENLINKS_SCREENSHOT_START -->",
    endMarker: getFlag("--end-marker") ?? "<!-- OPENLINKS_SCREENSHOT_END -->",
  };
};

const resolveAbsolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const findAllLineIndexes = (lines: string[], matchLine: string): number[] => {
  const indexes: number[] = [];
  lines.forEach((line, index) => {
    if (line === matchLine) {
      indexes.push(index);
    }
  });
  return indexes;
};

const normalizeTrailingWhitespace = (lines: string[]): string[] => {
  const normalized = [...lines];
  while (normalized.length > 0 && normalized[normalized.length - 1] === "") {
    normalized.pop();
  }
  return normalized;
};

const resolveAnchorIndex = (lines: string[], anchorLines: string[]): number => {
  for (const anchorLine of anchorLines) {
    const index = lines.indexOf(anchorLine);
    if (index >= 0) {
      return index;
    }
  }

  throw new Error(
    `README anchor line not found. Checked: ${anchorLines.map((line) => JSON.stringify(line)).join(", ")}`,
  );
};

export const updateReadmeScreenshotBlock = (
  originalContent: string,
  args: UpdateReadmeScreenshotBlockArgs,
): string => {
  const newline = originalContent.includes("\r\n") ? "\r\n" : "\n";
  const lines = originalContent.split(/\r?\n/);

  const startMarkerIndexes = findAllLineIndexes(lines, args.startMarker);
  const endMarkerIndexes = findAllLineIndexes(lines, args.endMarker);

  if (startMarkerIndexes.length !== endMarkerIndexes.length) {
    throw new Error(
      `README screenshot markers are unbalanced. start=${startMarkerIndexes.length}, end=${endMarkerIndexes.length}.`,
    );
  }

  if (startMarkerIndexes.length > 1) {
    throw new Error(
      `README screenshot markers appear multiple times (${startMarkerIndexes.length} blocks).`,
    );
  }

  let cleanedLines = [...lines];
  if (startMarkerIndexes.length === 1) {
    const start = startMarkerIndexes[0];
    const maybeEnd = endMarkerIndexes.find((index) => index > start);
    if (typeof maybeEnd !== "number") {
      throw new Error(
        "README screenshot markers are malformed. End marker must follow start marker.",
      );
    }

    cleanedLines = [...lines.slice(0, start), ...lines.slice(maybeEnd + 1)];
  }

  const anchorIndex = resolveAnchorIndex(cleanedLines, args.anchorLines);

  const screenshotBlock = [
    args.startMarker,
    `![${args.imageAlt}](${args.imagePath})`,
    args.endMarker,
  ];

  const beforeAnchor = cleanedLines.slice(0, anchorIndex + 1);
  const afterAnchor = cleanedLines.slice(anchorIndex + 1);
  const needsBlankSeparator = afterAnchor[0] !== "";

  const updatedLines = normalizeTrailingWhitespace([
    ...beforeAnchor,
    ...screenshotBlock,
    ...(needsBlankSeparator ? [""] : []),
    ...afterAnchor,
  ]);

  return `${updatedLines.join(newline)}${newline}`;
};

const run = (): void => {
  const args = parseArgs();
  const readmeAbsolutePath = resolveAbsolutePath(args.readmePath);

  const originalContent = fs.readFileSync(readmeAbsolutePath, "utf8");
  const updatedContent = updateReadmeScreenshotBlock(originalContent, args);
  if (updatedContent !== originalContent) {
    fs.writeFileSync(readmeAbsolutePath, updatedContent, "utf8");
    console.log(`Updated README screenshot block at ${args.readmePath}.`);
    return;
  }

  console.log(`README screenshot block already up to date at ${args.readmePath}.`);
};

if (import.meta.main) {
  run();
}
