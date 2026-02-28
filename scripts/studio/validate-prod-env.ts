#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";

type Target = "web" | "api" | "worker" | "all";
type OutputFormat = "human" | "json";
type IssueCode = "missing" | "invalid" | "placeholder";

interface Args {
  target: Target;
  envFile?: string;
  format: OutputFormat;
}

interface Rule {
  key: string;
  required: boolean;
  minLength?: number;
  url?: boolean;
}

interface ValidationIssue {
  target: Exclude<Target, "all">;
  key: string;
  code: IssueCode;
  message: string;
  remediation: string;
  token?: string;
}

interface Result {
  target: Target;
  ok: boolean;
  source: string;
  issues: ValidationIssue[];
}

const TARGET_RULES: Record<Exclude<Target, "all">, Rule[]> = {
  web: [
    { key: "VITE_STUDIO_API_URL", required: true, url: true },
    { key: "VITE_GITHUB_APP_INSTALL_URL", required: true, url: true },
    { key: "VITE_TURNSTILE_SITE_KEY", required: true },
  ],
  api: [
    { key: "DATABASE_URL", required: true, url: true },
    { key: "SESSION_SECRET", required: true, minLength: 32 },
    { key: "ENCRYPTION_KEY", required: true, minLength: 32 },
    { key: "INTERNAL_CRON_SECRET", required: true, minLength: 16 },
    { key: "GITHUB_APP_ID", required: true },
    { key: "GITHUB_APP_CLIENT_ID", required: true },
    { key: "GITHUB_APP_CLIENT_SECRET", required: true },
    { key: "GITHUB_APP_PRIVATE_KEY", required: true },
    { key: "GITHUB_WEBHOOK_SECRET", required: true },
    { key: "UPSTREAM_REPO_OWNER", required: true },
    { key: "UPSTREAM_REPO_NAME", required: true },
    { key: "STUDIO_API_URL", required: true, url: true },
    { key: "STUDIO_WEB_URL", required: true, url: true },
    { key: "TURNSTILE_SECRET_KEY", required: true },
  ],
  worker: [
    { key: "STUDIO_API_URL", required: true, url: true },
    { key: "INTERNAL_CRON_SECRET", required: true, minLength: 16 },
  ],
};

const PLACEHOLDER_PATTERNS: Array<{ token: string; pattern: RegExp }> = [
  { token: "replace", pattern: /replace/i },
  { token: "placeholder", pattern: /placeholder/i },
  { token: "your_", pattern: /your_/i },
  { token: "YOUR_APP_NAME", pattern: /your_app_name/i },
  { token: "...", pattern: /\.\.\./ },
];

const usage = (): string => {
  return [
    "Usage:",
    "  bun scripts/studio/validate-prod-env.ts --target <web|api|worker|all> [--env-file .env.studio] [--format human|json]",
    "",
    "Examples:",
    "  bun scripts/studio/validate-prod-env.ts --target all --env-file .env.studio",
    "  bun scripts/studio/validate-prod-env.ts --target api --format json",
  ].join("\n");
};

const parseArgs = (argv: string[]): Args => {
  const args: Args = {
    target: "all",
    format: "human",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--target") {
      const value = argv[i + 1];
      if (!value || !["web", "api", "worker", "all"].includes(value)) {
        throw new Error("Invalid --target value.");
      }
      args.target = value as Target;
      i += 1;
      continue;
    }

    if (arg === "--env-file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --env-file.");
      }
      args.envFile = value;
      i += 1;
      continue;
    }

    if (arg === "--format") {
      const value = argv[i + 1];
      if (!value || !["human", "json"].includes(value)) {
        throw new Error("Invalid --format value.");
      }
      args.format = value as OutputFormat;
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
};

const parseEnvFile = (filePath: string): Record<string, string> => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Env file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const output: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eqIndex = normalized.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, eqIndex).trim();
    let value = normalized.slice(eqIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
};

const mergeEnvironment = (args: Args): { values: Record<string, string>; source: string } => {
  const fromFile = args.envFile ? parseEnvFile(args.envFile) : {};
  const merged: Record<string, string> = { ...fromFile };

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      merged[key] = value;
    }
  }

  if (args.envFile) {
    const resolved = path.isAbsolute(args.envFile)
      ? args.envFile
      : path.resolve(process.cwd(), args.envFile);
    return {
      values: merged,
      source: `${resolved} + process.env overrides`,
    };
  }

  return {
    values: merged,
    source: "process.env",
  };
};

const findPlaceholderToken = (value: string): string | null => {
  for (const { token, pattern } of PLACEHOLDER_PATTERNS) {
    if (pattern.test(value)) {
      return token;
    }
  }
  return null;
};

const isValidUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const targetsFor = (target: Target): Array<Exclude<Target, "all">> => {
  if (target === "all") {
    return ["web", "api", "worker"];
  }
  return [target];
};

const validateTarget = (
  target: Exclude<Target, "all">,
  values: Record<string, string>,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const rules = TARGET_RULES[target];

  for (const rule of rules) {
    const raw = values[rule.key];
    const value = typeof raw === "string" ? raw.trim() : "";

    if (rule.required && value.length === 0) {
      issues.push({
        target,
        key: rule.key,
        code: "missing",
        message: `${rule.key} is required for ${target} production builds but is missing or empty.`,
        remediation: `Set ${rule.key} to a real value in your env source and rerun the preflight.`,
      });
      continue;
    }

    if (value.length === 0) {
      continue;
    }

    const placeholderToken = findPlaceholderToken(value);
    if (placeholderToken) {
      issues.push({
        target,
        key: rule.key,
        code: "placeholder",
        token: placeholderToken,
        message: `${rule.key} contains placeholder token "${placeholderToken}".`,
        remediation: `Replace ${rule.key} with a non-placeholder value.`,
      });
    }

    if (rule.url && !isValidUrl(value)) {
      issues.push({
        target,
        key: rule.key,
        code: "invalid",
        message: `${rule.key} must be a valid URL.`,
        remediation: `Set ${rule.key} to a valid URL such as https://example.com.`,
      });
    }

    if (typeof rule.minLength === "number" && value.length < rule.minLength) {
      issues.push({
        target,
        key: rule.key,
        code: "invalid",
        message: `${rule.key} must be at least ${rule.minLength} characters (received ${value.length}).`,
        remediation: `Set ${rule.key} to a value with at least ${rule.minLength} characters.`,
      });
    }
  }

  return issues;
};

const formatHuman = (result: Result): string => {
  const lines: string[] = [];
  lines.push("Studio production environment preflight");
  lines.push(`Target: ${result.target}`);
  lines.push(`Source: ${result.source}`);
  lines.push("");

  if (result.ok) {
    lines.push("Status: PASS");
    lines.push("All required Studio production env values are present and valid.");
    return lines.join("\n");
  }

  lines.push(`Status: FAIL (${result.issues.length} issue(s))`);
  lines.push("Detected issues:");
  for (const issue of result.issues) {
    lines.push(`- [${issue.target}] ${issue.key} (${issue.code}): ${issue.message}`);
  }

  lines.push("");
  lines.push("How to fix:");
  const seen = new Set<string>();
  for (const issue of result.issues) {
    const key = `${issue.target}:${issue.key}:${issue.remediation}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(`- [${issue.target}] ${issue.remediation}`);
  }
  lines.push("- Rerun: bun run studio:env:check:prod");

  return lines.join("\n");
};

const run = (): void => {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error("");
    console.error(usage());
    process.exit(2);
  }

  let merged: { values: Record<string, string>; source: string };
  try {
    merged = mergeEnvironment(args);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(2);
  }

  const issues = targetsFor(args.target).flatMap((target) => validateTarget(target, merged.values));
  const result: Result = {
    target: args.target,
    ok: issues.length === 0,
    source: merged.source,
    issues,
  };

  if (args.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatHuman(result));
  }

  process.exit(result.ok ? 0 : 1);
};

run();
