import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const EMBEDDED_CODE_ROOT = path.resolve(ROOT, "scripts", "embedded-code");
const embeddedCodeCache = new Map<string, string>();
const TOKEN_PATTERN = /__[A-Za-z0-9_]+__/g;

const resolveEmbeddedCodePath = (relativePath: string): string => {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Embedded code path must be relative. Received '${relativePath}'.`);
  }

  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalized.length === 0) {
    throw new Error("Embedded code path cannot be empty.");
  }

  const absolutePath = path.resolve(EMBEDDED_CODE_ROOT, normalized);
  if (
    absolutePath !== EMBEDDED_CODE_ROOT &&
    !absolutePath.startsWith(`${EMBEDDED_CODE_ROOT}${path.sep}`)
  ) {
    throw new Error(`Embedded code path escapes scripts/embedded-code: '${relativePath}'.`);
  }

  return absolutePath;
};

const cacheKeyForPath = (absolutePath: string): string =>
  path.relative(EMBEDDED_CODE_ROOT, absolutePath).replaceAll("\\", "/");

export const loadEmbeddedCode = (relativePath: string): string => {
  const absolutePath = resolveEmbeddedCodePath(relativePath);
  const key = cacheKeyForPath(absolutePath);

  const cached = embeddedCodeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Embedded code file not found: scripts/embedded-code/${key}. Check path '${relativePath}'.`,
    );
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  embeddedCodeCache.set(key, content);
  return content;
};

export const renderEmbeddedCode = (
  relativePath: string,
  replacements: Record<string, string>,
): string => {
  return renderTemplateTokens(
    loadEmbeddedCode(relativePath),
    replacements,
    `embedded code '${relativePath}'`,
  );
};

export const renderTemplateTokens = (
  template: string,
  replacements: Record<string, string>,
  sourceLabel = "template",
): string => {
  let rendered = template;

  for (const [token, replacement] of Object.entries(replacements)) {
    rendered = rendered.split(token).join(replacement);
  }

  const unresolved = Array.from(new Set(rendered.match(TOKEN_PATTERN) ?? []));
  if (unresolved.length > 0) {
    throw new Error(`${sourceLabel} has unresolved tokens: ${unresolved.join(", ")}`);
  }

  return rendered;
};
