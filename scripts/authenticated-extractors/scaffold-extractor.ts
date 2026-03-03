import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { renderTemplateTokens } from "../shared/embedded-code-loader";
import { DEFAULT_AUTH_EXTRACTORS_POLICY_PATH, loadAuthenticatedExtractorsPolicy } from "./policy";

interface CliArgs {
  id: string;
  domains: string[];
  summary: string;
}

const ROOT = process.cwd();
const REGISTRY_PATH = "scripts/authenticated-extractors/registry.ts";
const PLUGIN_DIR = "scripts/authenticated-extractors/plugins";
const PLUGIN_TEMPLATE_PATH =
  "scripts/authenticated-extractors/plugins/authenticated-extractor-plugin.template.ts";
const DEFAULT_DOCS = [
  "docs/authenticated-rich-extractors.md",
  "docs/create-new-rich-content-extractor.md",
  "docs/rich-metadata-fetch-blockers.md",
];

const absolutePath = (value: string): string =>
  path.isAbsolute(value) ? value : path.join(ROOT, value);

const readText = (relativePath: string): string =>
  fs.readFileSync(absolutePath(relativePath), "utf8");

const writeText = (relativePath: string, value: string): void => {
  const absolute = absolutePath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, value, "utf8");
};

const readJson = <T>(relativePath: string): T =>
  JSON.parse(fs.readFileSync(absolutePath(relativePath), "utf8")) as T;

const writeJson = (relativePath: string, payload: unknown): void =>
  writeText(relativePath, `${JSON.stringify(payload, null, 2)}\n`);

const getFlagValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const next = args[index + 1];
  if (typeof next !== "string" || next.startsWith("--")) {
    return undefined;
  }

  const trimmed = next.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseArgs = (): CliArgs => {
  const args = process.argv.slice(2);
  const id = getFlagValue(args, "--id");
  const domainsRaw = getFlagValue(args, "--domains");
  const summary = getFlagValue(args, "--summary");

  if (!id) {
    throw new Error("Missing required flag --id <extractor-id>.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error("--id must match /^[a-z0-9][a-z0-9-]*$/ (kebab-case).");
  }

  if (!domainsRaw) {
    throw new Error("Missing required flag --domains <domain1,domain2>.");
  }
  const domains = domainsRaw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  if (domains.length === 0) {
    throw new Error("--domains must include at least one domain.");
  }

  if (!summary) {
    throw new Error('Missing required flag --summary "<summary>".');
  }

  return {
    id,
    domains,
    summary,
  };
};

const toCamelCase = (value: string): string => {
  const parts = value.split(/[^a-zA-Z0-9]+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return "customExtractor";
  }

  return parts
    .map((part, index) =>
      index === 0
        ? part.toLowerCase()
        : `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`,
    )
    .join("");
};

const appendLineBetweenMarkers = (
  content: string,
  markerStart: string,
  markerEnd: string,
  line: string,
): string => {
  const startIndex = content.indexOf(markerStart);
  const endIndex = content.indexOf(markerEnd);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error(`Unable to find marker block '${markerStart}' -> '${markerEnd}'.`);
  }

  if (content.includes(line)) {
    return content;
  }

  const insertionPoint = endIndex;
  return `${content.slice(0, insertionPoint)}${line}\n${content.slice(insertionPoint)}`;
};

const scaffoldPlugin = (args: CliArgs): { pluginPath: string; exportName: string } => {
  const exportName = `${toCamelCase(args.id)}Extractor`;
  const pluginPath = path.posix.join(PLUGIN_DIR, `${args.id}.ts`);
  const pluginAbsolutePath = absolutePath(pluginPath);

  if (fs.existsSync(pluginAbsolutePath)) {
    throw new Error(`Plugin file already exists at ${pluginPath}.`);
  }

  const template = renderTemplateTokens(
    readText(PLUGIN_TEMPLATE_PATH),
    {
      __EXTRACTOR_ID__: args.id,
      __EXTRACTOR_VERSION__: `${new Date().toISOString().slice(0, 10)}.1`,
      __DEFAULT_SESSION__: `openlinks-${args.id}`,
      __EXPORT_NAME__: exportName,
    },
    `scaffold template '${PLUGIN_TEMPLATE_PATH}'`,
  );

  writeText(pluginPath, template);
  return { pluginPath, exportName };
};

const updateRegistry = (args: CliArgs, exportName: string): void => {
  const importLine = `import { ${exportName} } from "./plugins/${args.id}";`;
  const mapLine = `  [${exportName}.id]: ${exportName},`;

  let registry = readText(REGISTRY_PATH);
  registry = appendLineBetweenMarkers(
    registry,
    "// AUTH_EXTRACTOR_IMPORTS_START",
    "// AUTH_EXTRACTOR_IMPORTS_END",
    importLine,
  );
  registry = appendLineBetweenMarkers(
    registry,
    "// AUTH_EXTRACTOR_MAP_START",
    "// AUTH_EXTRACTOR_MAP_END",
    mapLine,
  );

  writeText(REGISTRY_PATH, registry);
};

const updatePolicy = (args: CliArgs): void => {
  const policy = loadAuthenticatedExtractorsPolicy({
    policyPath: DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  });

  if (policy.extractors.some((extractor) => extractor.id === args.id)) {
    throw new Error(
      `Policy already contains extractor id '${args.id}' in ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}.`,
    );
  }

  policy.extractors.push({
    id: args.id,
    status: "experimental",
    method: "manual_browser_session",
    domains: args.domains,
    matchSubdomains: true,
    summary: args.summary,
    loginInstructions:
      "Complete site login and any MFA/challenge in the headed browser session; sync continues automatically after auth detection.",
    docs: DEFAULT_DOCS,
  });

  policy.updatedAt = new Date().toISOString();
  writeJson(DEFAULT_AUTH_EXTRACTORS_POLICY_PATH, policy);
};

const run = () => {
  const args = parseArgs();

  const existingPolicy = readJson<{ extractors?: Array<{ id?: string }> }>(
    DEFAULT_AUTH_EXTRACTORS_POLICY_PATH,
  );
  if ((existingPolicy.extractors ?? []).some((extractor) => extractor.id === args.id)) {
    throw new Error(
      `Extractor '${args.id}' already exists in ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}. Choose a different id.`,
    );
  }

  const { pluginPath, exportName } = scaffoldPlugin(args);
  updateRegistry(args, exportName);
  updatePolicy(args);

  console.log("Authenticated extractor scaffold created.");
  console.log(`- Plugin template: ${pluginPath}`);
  console.log(`- Registry updated: ${REGISTRY_PATH}`);
  console.log(`- Policy updated: ${DEFAULT_AUTH_EXTRACTORS_POLICY_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Implement ensureSession/extract in ${pluginPath}.`);
  console.log(`2. Configure link(s) with links[].enrichment.authenticatedExtractor='${args.id}'.`);
  console.log("3. Run npm run setup:rich-auth and commit cache/assets.");
};

try {
  run();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Scaffold extractor failed: ${message}`);
  process.exit(1);
}
