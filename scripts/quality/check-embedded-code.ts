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

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const EMBEDDED_CODE_DIR = path.join(SCRIPTS_DIR, "embedded-code");

const INLINE_EVAL_LITERAL_PATTERN =
  /runAgentBrowserJson(?:<[^>]+>)?\s*\(\s*\[\s*["']eval["']\s*,\s*(`(?:[\s\S]*?)`|"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\[\s\S])*')/g;
const LARGE_INLINE_TEMPLATE_PATTERN = /const\s+template\s*=\s*`([\s\S]*?)`;/g;
const LARGE_TEMPLATE_MIN_LINES = 20;

const toRelative = (absolutePath: string): string => path.relative(ROOT, absolutePath).replaceAll("\\", "/");

const toLineColumn = (content: string, index: number): { line: number; column: number } => {
  const upToIndex = content.slice(0, index);
  const lines = upToIndex.split("\n");
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;
  return { line, column };
};

const listScriptTypeScriptFiles = (directory: string): string[] => {
  const results: string[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (absolutePath === EMBEDDED_CODE_DIR || entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      results.push(...listScriptTypeScriptFiles(absolutePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (absolutePath.endsWith(".ts") || absolutePath.endsWith(".tsx")) {
      results.push(absolutePath);
    }
  }

  return results;
};

const checkInlineEvalLiterals = (absolutePath: string, content: string): Finding[] => {
  const findings: Finding[] = [];

  for (const match of content.matchAll(INLINE_EVAL_LITERAL_PATTERN)) {
    const literal = match[1] ?? "";
    const index = match.index ?? 0;
    const { line, column } = toLineColumn(content, index);
    findings.push({
      rule: "inline_eval_literal",
      file: toRelative(absolutePath),
      line,
      column,
      message: `Inline literal used as runAgentBrowserJson eval payload (${literal.startsWith("`") ? "template literal" : "string literal"}). Move payload into scripts/embedded-code/ and load via embedded-code-loader.`
    });
  }

  return findings;
};

const checkLargeInlineTemplates = (absolutePath: string, content: string): Finding[] => {
  const findings: Finding[] = [];

  for (const match of content.matchAll(LARGE_INLINE_TEMPLATE_PATTERN)) {
    const templateBody = match[1] ?? "";
    const lineCount = templateBody.split("\n").length;
    const containsCodeLikeContent =
      /\bimport\s+/.test(templateBody) ||
      /\bexport\s+/.test(templateBody) ||
      /AuthenticatedExtractorPlugin/.test(templateBody);

    if (lineCount < LARGE_TEMPLATE_MIN_LINES || !containsCodeLikeContent) {
      continue;
    }

    const index = match.index ?? 0;
    const { line, column } = toLineColumn(content, index);
    findings.push({
      rule: "large_inline_scaffold_template",
      file: toRelative(absolutePath),
      line,
      column,
      message:
        "Large inline scaffold template detected. Move template into scripts/embedded-code/templates/ and render through embedded-code-loader."
    });
  }

  return findings;
};

const run = (): void => {
  const tsFiles = listScriptTypeScriptFiles(SCRIPTS_DIR);
  const findings: Finding[] = [];

  for (const absolutePath of tsFiles) {
    const content = fs.readFileSync(absolutePath, "utf8");
    findings.push(...checkInlineEvalLiterals(absolutePath, content));
    findings.push(...checkLargeInlineTemplates(absolutePath, content));
  }

  if (findings.length === 0) {
    console.log("Embedded code guardrail: PASS (no prohibited inline eval/template patterns found).");
    return;
  }

  console.error(`Embedded code guardrail: FAIL (${findings.length} finding${findings.length === 1 ? "" : "s"}).`);
  for (const finding of findings) {
    console.error(
      `- [${finding.rule}] ${finding.file}:${finding.line}:${finding.column} ${finding.message}`
    );
  }

  process.exit(1);
};

run();
