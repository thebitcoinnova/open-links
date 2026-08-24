import process from "node:process";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import type { SiteData } from "../../src/lib/content/load-content";
import {
  DEFAULT_BLOCKERS_REGISTRY_PATH,
  loadRichEnrichmentBlockersRegistry,
} from "../enrichment/blockers-registry";
import { readEnrichmentReport } from "../enrichment/report";
import type { EnrichmentRunSummary } from "../enrichment/types";
import { type ValidationResult, formatHumanOutput, formatJsonOutput } from "./format-output";
import { type ValidationIssue, runPolicyRules } from "./rules";
import {
  authenticatedExtractorConfigIssues,
  enrichmentIssues,
  knownBlockerConfigIssues,
} from "./validate-data-auth";
import {
  ENRICHMENT_BYPASS_ENV,
  type GeneratedRichMetadataPayload,
} from "./validate-data-contracts";
import {
  hasRichPreviewValidationCandidates,
  hasRichRenderCandidates,
  publicAugmentedStableCacheCoverageIssues,
  remoteCachePolicyCoverageIssues,
  resolveGeneratedContentImagesBySlot,
  resolveGeneratedMetadataByLink,
  resolveGeneratedReferralByLink,
} from "./validate-data-enrichment-cache";
import {
  analyticsHistorySetupIssues,
  followerHistoryArtifactIssues,
} from "./validate-data-history";
import {
  referralGeneratedConflictIssues,
  richCardPreviewImageIssues,
  supportedSocialProfileMetadataIssues,
} from "./validate-data-preview";
import { collectReferralCatalogIssues } from "./validate-data-referrals";
import {
  parseArgs,
  readContentImagesManifest,
  readJsonFile,
  resolveEnrichmentMetadataPath,
  resolveEnrichmentReportPath,
  resolveHookRichArtifactCheckDecision,
  schemaIssue,
  sortIssues,
  tryReadJsonFile,
} from "./validate-data-runtime";

type ValidationContext = {
  args: ReturnType<typeof parseArgs>;
  profileData: Record<string, unknown>;
  linksData: Record<string, unknown>;
  siteData: Record<string, unknown>;
  enrichmentReportPath: string;
  enrichmentReport: ReturnType<typeof readEnrichmentReport>;
  bypassActive: boolean;
  enrichmentMetadataPath: string;
  generatedMetadataRead: ReturnType<typeof tryReadJsonFile<GeneratedRichMetadataPayload>>;
  generatedMetadataByLink: ReturnType<typeof resolveGeneratedMetadataByLink>;
  hookDecision: ReturnType<typeof resolveHookRichArtifactCheckDecision>;
  issues: ValidationIssue[];
  suppressedKnownBlockerLinkIds: Set<string>;
  suppressedAuthenticatedCacheLinkIds: Set<string>;
};

type ValidationSchemas = {
  profile: Record<string, unknown>;
  links: Record<string, unknown>;
  site: Record<string, unknown>;
};

const collectSchemaIssues = (
  args: ReturnType<typeof parseArgs>,
  schemas: ValidationSchemas,
  profileData: Record<string, unknown>,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
): ValidationIssue[] => {
  const checks = [
    {
      source: args.profilePath,
      schema: schemas.profile,
      data: profileData,
    },
    {
      source: args.linksPath,
      schema: schemas.links,
      data: linksData,
    },
    {
      source: args.sitePath,
      schema: schemas.site,
      data: siteData,
    },
  ];
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const issues: ValidationIssue[] = [];
  for (const check of checks) {
    const validate = ajv.compile(check.schema);
    if (validate(check.data) || !validate.errors) continue;
    for (const error of validate.errors) issues.push(schemaIssue(check.source, error));
  }
  return issues;
};

export const createValidationContext = (): ValidationContext => {
  const args = parseArgs();
  const schemas: ValidationSchemas = {
    profile: readJsonFile<Record<string, unknown>>("schema/profile.schema.json"),
    links: readJsonFile<Record<string, unknown>>("schema/links.schema.json"),
    site: readJsonFile<Record<string, unknown>>("schema/site.schema.json"),
  };
  const profileData = readJsonFile<Record<string, unknown>>(args.profilePath);
  const linksData = readJsonFile<Record<string, unknown>>(args.linksPath);
  const siteData = readJsonFile<Record<string, unknown>>(args.sitePath);
  const enrichmentReportPath = resolveEnrichmentReportPath(siteData, args.enrichmentReportPath);
  const enrichmentReport = readEnrichmentReport(enrichmentReportPath);
  const bypassActive =
    process.env[ENRICHMENT_BYPASS_ENV] === "1" || enrichmentReport?.bypassActive === true;
  const enrichmentMetadataPath = resolveEnrichmentMetadataPath(siteData);
  const generatedMetadataRead =
    tryReadJsonFile<GeneratedRichMetadataPayload>(enrichmentMetadataPath);
  return {
    args,
    profileData,
    linksData,
    siteData,
    enrichmentReportPath,
    enrichmentReport,
    bypassActive,
    enrichmentMetadataPath,
    generatedMetadataRead,
    generatedMetadataByLink: generatedMetadataRead.value
      ? resolveGeneratedMetadataByLink(generatedMetadataRead.value)
      : {},
    hookDecision: resolveHookRichArtifactCheckDecision({
      mode: args.mode,
      changedPathsFile: args.changedPathsFile,
    }),
    issues: collectSchemaIssues(args, schemas, profileData, linksData, siteData),
    suppressedKnownBlockerLinkIds: new Set<string>(),
    suppressedAuthenticatedCacheLinkIds: new Set<string>(),
  };
};

const collectCorePolicyIssues = (context: ValidationContext) => {
  const { args, profileData, linksData, siteData, generatedMetadataByLink, issues } = context;
  issues.push(...collectReferralCatalogIssues({ linksData, linksSource: args.linksPath }));
  issues.push(
    ...runPolicyRules({
      profile: profileData,
      links: linksData,
      site: siteData,
      sources: { profile: args.profilePath, links: args.linksPath, site: args.sitePath },
    }),
  );
  issues.push(
    ...remoteCachePolicyCoverageIssues({
      profileSource: args.profilePath,
      profileData,
      linksSource: args.linksPath,
      linksData,
      siteData,
      generatedMetadataByLink,
    }),
  );
  issues.push(
    ...publicAugmentedStableCacheCoverageIssues({
      linksSource: args.linksPath,
      linksData,
      siteData,
      generatedMetadataByLink,
    }),
  );
};

const collectAuthenticatedPolicyIssues = (context: ValidationContext) => {
  try {
    const result = authenticatedExtractorConfigIssues(
      context.args.linksPath,
      context.linksData,
      context.siteData,
      context.bypassActive,
    );
    context.issues.push(...result.issues);
    for (const linkId of result.suppressedAuthenticatedCacheLinkIds) {
      context.suppressedAuthenticatedCacheLinkIds.add(linkId);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    context.issues.push({
      level: "error",
      source: context.args.linksPath,
      path: "$.links",
      message: `Failed to evaluate authenticated extractor policy checks. ${message}`,
      remediation:
        "Fix authenticated extractor link configuration and policy/cache files, run npm run setup:rich-auth, then rerun validation.",
    });
  }
};

const collectKnownBlockerIssues = (context: ValidationContext) => {
  try {
    const registry = loadRichEnrichmentBlockersRegistry({
      registryPath: DEFAULT_BLOCKERS_REGISTRY_PATH,
    });
    const result = knownBlockerConfigIssues(
      context.args.linksPath,
      context.linksData,
      context.siteData,
      registry,
      context.bypassActive,
    );
    context.issues.push(...result.issues);
    for (const linkId of result.suppressedKnownBlockerLinkIds) {
      context.suppressedKnownBlockerLinkIds.add(linkId);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    context.issues.push({
      level: "error",
      source: DEFAULT_BLOCKERS_REGISTRY_PATH,
      path: "$",
      message: `Failed to load rich-enrichment blockers registry. ${message}`,
      remediation:
        "Restore data/policy/rich-enrichment-blockers.json and ensure it validates against schema/rich-enrichment-blockers.schema.json.",
    });
  }
};

const collectRichArtifactIssues = (context: ValidationContext) => {
  if (
    !hasRichRenderCandidates(context.linksData, context.siteData) ||
    !context.hookDecision.shouldRun
  )
    return;
  const metadataRead = context.generatedMetadataRead;
  const contentImagesRead = readContentImagesManifest();
  const generatedReferralByLink = metadataRead.value
    ? resolveGeneratedReferralByLink(metadataRead.value)
    : {};
  const needsPreviewValidation = hasRichPreviewValidationCandidates(
    context.linksData,
    context.siteData,
    context.generatedMetadataByLink,
  );
  if (needsPreviewValidation && !metadataRead.value) {
    context.issues.push({
      level: "error",
      source: context.enrichmentMetadataPath,
      path: "$",
      message:
        "Generated rich metadata is required to validate rich-card preview images, but it could not be loaded.",
      remediation: `Run npm run enrich:rich:strict to regenerate ${context.enrichmentMetadataPath}. ${`Then rerun npm run validate:data. ${metadataRead.errorMessage ?? ""}`.trim()}`,
    });
  }
  if (needsPreviewValidation && !contentImagesRead.value) {
    context.issues.push({
      level: "error",
      source: contentImagesRead.path,
      path: "$",
      message:
        "Generated content-image manifest is required to validate rich-card preview images, but it could not be loaded.",
      remediation: `Run npm run images:sync to regenerate ${contentImagesRead.path}. ${`Then rerun npm run validate:data. ${contentImagesRead.errorMessage ?? ""}`.trim()}`,
    });
  }
  if (needsPreviewValidation && metadataRead.value && contentImagesRead.value) {
    context.issues.push(
      ...richCardPreviewImageIssues(
        context.args.linksPath,
        context.linksData,
        context.siteData,
        context.generatedMetadataByLink,
        resolveGeneratedContentImagesBySlot(contentImagesRead.value),
        context.enrichmentMetadataPath,
        contentImagesRead.path,
      ),
      ...supportedSocialProfileMetadataIssues(
        context.args.linksPath,
        context.linksData,
        context.siteData,
        context.generatedMetadataByLink,
      ),
    );
  }
  if (metadataRead.value) {
    context.issues.push(
      ...referralGeneratedConflictIssues(
        context.args.linksPath,
        context.linksData,
        generatedReferralByLink,
      ),
    );
  }
};

const collectReportAndHistoryIssues = (context: ValidationContext) => {
  if (context.hookDecision.shouldRun) {
    context.issues.push(
      ...enrichmentIssues(
        context.enrichmentReportPath,
        context.enrichmentReport,
        context.args.strict,
        context.bypassActive,
        context.suppressedKnownBlockerLinkIds,
        context.suppressedAuthenticatedCacheLinkIds,
      ),
    );
  }
  context.issues.push(...followerHistoryArtifactIssues());
  context.issues.push(
    ...analyticsHistorySetupIssues({
      linksSource: context.args.linksPath,
      linksData: context.linksData,
      siteData: context.siteData as SiteData,
    }),
  );
};

const hasAuthenticatedSetupIssue = (issues: ValidationIssue[]): boolean =>
  issues.some((issue) => {
    const message = issue.message.toLowerCase();
    const source = issue.source.toLowerCase();
    return (
      message.includes("authenticated extractor") ||
      message.includes("authenticated cache") ||
      source.includes("rich-authenticated")
    );
  });

const buildValidationResult = (context: ValidationContext): ValidationResult => {
  const errors = sortIssues(context.issues.filter((issue) => issue.level === "error"));
  const warnings = sortIssues(context.issues.filter((issue) => issue.level === "warning"));
  const strictBlockingWarnings = warnings.filter((issue) => issue.strictBlocking !== false);
  const enrichmentSummary: EnrichmentRunSummary | undefined = context.enrichmentReport?.summary;
  return {
    strict: context.args.strict,
    format: context.args.format,
    success: errors.length === 0 && (!context.args.strict || strictBlockingWarnings.length === 0),
    errors,
    warnings,
    strictBlockingWarnings: strictBlockingWarnings.length,
    files: {
      profile: context.args.profilePath,
      links: context.args.linksPath,
      site: context.args.sitePath,
    },
    enrichment: {
      reportPath: context.enrichmentReportPath,
      found: context.enrichmentReport !== null,
      generatedAt: context.enrichmentReport?.generatedAt,
      summary: enrichmentSummary,
      failureMode: context.enrichmentReport?.failureMode,
      failOn: context.enrichmentReport?.failOn,
      bypassActive: context.bypassActive,
      abortedEarly: context.enrichmentReport?.abortedEarly,
    },
  };
};

const emitValidationResult = (context: ValidationContext, result: ValidationResult) => {
  if (context.args.format === "human" && context.hookDecision.humanNote) {
    console.log(context.hookDecision.humanNote);
    console.log("");
  }
  if (
    context.args.format === "human" &&
    hasAuthenticatedSetupIssue([...result.errors, ...result.warnings]) &&
    !context.bypassActive
  ) {
    console.log(
      "Hint: authenticated rich cache setup is required. Run `npm run setup:rich-auth`, commit updated cache/assets, then rerun validation/build.",
    );
    console.log("");
  }
  console.log(
    context.args.format === "json" ? formatJsonOutput(result) : formatHumanOutput(result),
  );
};

export const executeValidation = (): boolean => {
  const context = createValidationContext();
  collectCorePolicyIssues(context);
  collectAuthenticatedPolicyIssues(context);
  collectKnownBlockerIssues(context);
  collectRichArtifactIssues(context);
  collectReportAndHistoryIssues(context);
  const result = buildValidationResult(context);
  emitValidationResult(context, result);
  return result.success;
};
