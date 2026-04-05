import fs from "node:fs";
import path from "node:path";
import process from "node:process";

interface Finding {
  rule: string;
  file: string;
  line: number;
  column: number;
  message: string;
}

interface SymbolCandidate {
  index: number;
  name: string;
}

const ROOT = process.cwd();
const ICONS_DIR = path.join(ROOT, "src/lib/icons");
const PAYMENT_LOGOS_DIR = path.join(ROOT, "public/payment-logos");
const PROVENANCE_HEADER = "SVG Logo Provenance";
const HAND_AUTHORED_SOURCE_PATTERN = /^hand-authored$/i;
const LOGO_ICON_EXPORT_PATTERN = /^\s*export\s+const\s+(Icon[A-Z][A-Za-z0-9_]*)\b/gm;
const LOGO_PATH_CONSTANT_PATTERN = /^\s*const\s+([A-Z0-9_]+(?:_PATH|_PATHS))\b/gm;
const IGNORED_ICON_EXPORT_NAMES = new Set([
  "IconWallet",
  "IconMail",
  "IconMenu",
  "IconShare",
  "IconCopy",
  "IconQrCode",
  "IconAnalytics",
  "IconOpen",
]);
const IGNORED_PATH_CONSTANT_NAMES = new Set(["WALLET_PATHS"]);

const toRelative = (absolutePath: string): string =>
  path.relative(ROOT, absolutePath).replaceAll("\\", "/");

const toLineColumn = (content: string, index: number): { line: number; column: number } => {
  const upToIndex = content.slice(0, index);
  const lines = upToIndex.split("\n");
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
};

const listFilesRecursive = (
  directory: string,
  predicate: (filePath: string) => boolean,
): string[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const results: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      results.push(...listFilesRecursive(absolutePath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(absolutePath)) {
      results.push(absolutePath);
    }
  }

  return results;
};

const extractField = (
  comment: string,
  label: "Source" | "Method" | "Notes",
): string | undefined => {
  const match = comment.match(
    new RegExp(String.raw`(?:^|\n)\s*(?:\*\s*)?${label}:\s*(.+)\s*$`, "im"),
  );
  return match?.[1]?.trim();
};

const validateProvenanceComment = (
  comment: string,
  absolutePath: string,
  line: number,
  column: number,
  subject: string,
): Finding[] => {
  const findings: Finding[] = [];
  const relativePath = toRelative(absolutePath);

  if (!comment.includes(PROVENANCE_HEADER)) {
    findings.push({
      rule: "missing_provenance_header",
      file: relativePath,
      line,
      column,
      message: `Missing '${PROVENANCE_HEADER}' header for ${subject}.`,
    });
  }

  const source = extractField(comment, "Source");
  if (!source) {
    findings.push({
      rule: "missing_source_field",
      file: relativePath,
      line,
      column,
      message: `Missing required 'Source:' field for ${subject}.`,
    });
  }

  const method = extractField(comment, "Method");
  if (!method) {
    findings.push({
      rule: "missing_method_field",
      file: relativePath,
      line,
      column,
      message: `Missing required 'Method:' field for ${subject}.`,
    });
  }

  if (source && HAND_AUTHORED_SOURCE_PATTERN.test(source)) {
    const notes = extractField(comment, "Notes");
    if (!notes) {
      findings.push({
        rule: "missing_notes_field",
        file: relativePath,
        line,
        column,
        message: `Missing required 'Notes:' field for hand-authored ${subject}.`,
      });
    }
  }

  return findings;
};

const collectTsSymbolCandidates = (content: string): SymbolCandidate[] => {
  const candidates: SymbolCandidate[] = [];

  for (const match of content.matchAll(LOGO_ICON_EXPORT_PATTERN)) {
    const name = match[1];
    if (!name || IGNORED_ICON_EXPORT_NAMES.has(name)) {
      continue;
    }
    candidates.push({ name, index: match.index ?? 0 });
  }

  for (const match of content.matchAll(LOGO_PATH_CONSTANT_PATTERN)) {
    const name = match[1];
    if (!name || IGNORED_PATH_CONSTANT_NAMES.has(name)) {
      continue;
    }
    candidates.push({ name, index: match.index ?? 0 });
  }

  return candidates.sort((left, right) => left.index - right.index);
};

const findImmediateBlockComment = (content: string, index: number): string | undefined => {
  const prefix = content.slice(0, index);
  const match = prefix.match(/\/\*\*[\s\S]*?\*\/\s*$/u);
  return match?.[0];
};

const checkTsFile = (absolutePath: string): Finding[] => {
  const content = fs.readFileSync(absolutePath, "utf8");
  const findings: Finding[] = [];

  for (const candidate of collectTsSymbolCandidates(content)) {
    const { line, column } = toLineColumn(content, candidate.index);
    const comment = findImmediateBlockComment(content, candidate.index);

    if (!comment) {
      findings.push({
        rule: "missing_ts_provenance_comment",
        file: toRelative(absolutePath),
        line,
        column,
        message: `Missing immediate '${PROVENANCE_HEADER}' block comment for custom logo symbol '${candidate.name}'.`,
      });
      continue;
    }

    findings.push(
      ...validateProvenanceComment(
        comment,
        absolutePath,
        line,
        column,
        `custom logo symbol '${candidate.name}'`,
      ),
    );
  }

  return findings;
};

const checkSvgFile = (absolutePath: string): Finding[] => {
  const content = fs.readFileSync(absolutePath, "utf8");
  const match = content.match(/^\uFEFF?\s*(?:<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->)/u);

  if (!match) {
    return [
      {
        rule: "missing_svg_provenance_comment",
        file: toRelative(absolutePath),
        line: 1,
        column: 1,
        message: `Missing leading '${PROVENANCE_HEADER}' XML comment for hand-authored logo asset.`,
      },
    ];
  }

  return validateProvenanceComment(
    match[1],
    absolutePath,
    1,
    1,
    `hand-authored logo asset '${path.basename(absolutePath)}'`,
  );
};

const run = (): void => {
  const tsFiles = listFilesRecursive(
    ICONS_DIR,
    (filePath) => filePath.endsWith(".ts") || filePath.endsWith(".tsx"),
  );
  const svgFiles = listFilesRecursive(PAYMENT_LOGOS_DIR, (filePath) => filePath.endsWith(".svg"));
  const findings = [
    ...tsFiles.flatMap((absolutePath) => checkTsFile(absolutePath)),
    ...svgFiles.flatMap((absolutePath) => checkSvgFile(absolutePath)),
  ];

  if (findings.length === 0) {
    console.log(
      "Logo SVG provenance guardrail: PASS (all human-authored custom logo hotspots include provenance metadata).",
    );
    return;
  }

  console.error(
    `Logo SVG provenance guardrail: FAIL (${findings.length} finding${findings.length === 1 ? "" : "s"}).`,
  );
  for (const finding of findings) {
    console.error(
      `- [${finding.rule}] ${finding.file}:${finding.line}:${finding.column} ${finding.message}`,
    );
  }

  process.exit(1);
};

run();
