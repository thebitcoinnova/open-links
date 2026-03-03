import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RepoContentPayload, ValidationResult } from "@openlinks/studio-shared";
import addFormatsModule from "ajv-formats";
import Ajv2020Module, { type ErrorObject } from "ajv/dist/2020.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../../");
const schemaDir = path.join(repoRoot, "schema");

interface SchemaBundle {
  profile: object;
  links: object;
  site: object;
}

let cache: SchemaBundle | null = null;
const Ajv2020 = Ajv2020Module as unknown as {
  new (
    opts?: Record<string, unknown>,
  ): {
    compile: (schema: object) => {
      (value: unknown): boolean;
      errors?: ErrorObject[] | null;
    };
  };
};

const addFormats = addFormatsModule as unknown as (instance: unknown) => void;

const loadSchemas = async (): Promise<SchemaBundle> => {
  if (cache) return cache;

  const readJson = async (name: string): Promise<object> => {
    const raw = await readFile(path.join(schemaDir, name), "utf8");
    return JSON.parse(raw) as object;
  };

  cache = {
    profile: await readJson("profile.schema.json"),
    links: await readJson("links.schema.json"),
    site: await readJson("site.schema.json"),
  };

  return cache;
};

const formatError = (source: "profile" | "links" | "site", error: ErrorObject) => ({
  source,
  path: error.instancePath || "$",
  message: error.message ?? "Validation error",
});

export const validateRepoContent = async (
  payload: RepoContentPayload,
): Promise<ValidationResult> => {
  const schemas = await loadSchemas();
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const validateProfile = ajv.compile(schemas.profile);
  const validateLinks = ajv.compile(schemas.links);
  const validateSite = ajv.compile(schemas.site);

  const errors: ValidationResult["errors"] = [];
  const warnings: ValidationResult["warnings"] = [];

  if (!validateProfile(payload.profile)) {
    for (const error of validateProfile.errors ?? []) {
      errors.push(formatError("profile", error));
    }
  }

  if (!validateLinks(payload.links)) {
    for (const error of validateLinks.errors ?? []) {
      errors.push(formatError("links", error));
    }
  }

  if (!validateSite(payload.site)) {
    for (const error of validateSite.errors ?? []) {
      errors.push(formatError("site", error));
    }
  }

  const links = Array.isArray(payload.links.links) ? payload.links.links : [];
  if (links.length === 0) {
    warnings.push({
      source: "links",
      path: "$.links",
      message: "No links configured; site may render empty sections.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
