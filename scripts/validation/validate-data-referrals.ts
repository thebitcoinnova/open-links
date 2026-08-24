import fs from "node:fs";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { normalizeReferralCatalogRef } from "../../src/lib/content/referral-fields";
import type { ValidationIssue } from "./rules-contracts";
import {
  DEFAULT_REFERRAL_CATALOG_LOCAL_PATH,
  DEFAULT_REFERRAL_CATALOG_PATH,
  DEFAULT_REFERRAL_CATALOG_SCHEMA_PATH,
  type ReferralCatalogFamilyRecord,
  type ReferralCatalogIndex,
  type ReferralCatalogIntegrityInput,
  type ReferralCatalogMatcherRecord,
  type ReferralCatalogOfferRecord,
  type ReferralCatalogPayload,
} from "./validate-data-contracts";
import {
  absolutePath,
  isRecord,
  readJsonFile,
  schemaIssue,
  toStringOrUndefined,
  tryReadJsonFile,
} from "./validate-data-runtime";

export const resolveReferralCatalogItems = <T extends Record<string, unknown>>(
  value: unknown,
): T[] => (Array.isArray(value) ? value.filter(isRecord).map((entry) => entry as T) : []);

export const mergeReferralCatalogSectionById = <T extends Record<string, unknown>>(
  baseEntries: readonly T[],
  overlayEntries: readonly T[],
  idKey: keyof T,
): Map<string, T> => {
  const merged = new Map<string, T>();

  for (const entry of [...baseEntries, ...overlayEntries]) {
    const id = toStringOrUndefined(entry[idKey]);
    if (!id) {
      continue;
    }

    merged.set(id, entry);
  }

  return merged;
};

export const referralCatalogDuplicateIdIssues = <T extends Record<string, unknown>>(input: {
  entries: readonly T[];
  idKey: keyof T;
  label: string;
  sectionName: string;
  source: string;
}): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, number>();

  input.entries.forEach((entry, index) => {
    const id = toStringOrUndefined(entry[input.idKey]);
    if (!id) {
      return;
    }

    const maybeExistingIndex = seenIds.get(id);
    if (maybeExistingIndex !== undefined) {
      issues.push({
        level: "error",
        source: input.source,
        path: `$.${input.sectionName}[${index}].${String(input.idKey)}`,
        message: `Duplicate referral catalog ${input.label} id '${id}' in ${input.source}.`,
        remediation: `Keep each ${input.label} id unique within $.${input.sectionName}; the earlier duplicate is at index ${maybeExistingIndex}.`,
      });
      return;
    }

    seenIds.set(id, index);
  });

  return issues;
};

export const buildReferralCatalogIndex = (
  input: ReferralCatalogIntegrityInput,
): { issues: ValidationIssue[]; index: ReferralCatalogIndex } => {
  const catalogFamilies = resolveReferralCatalogItems<ReferralCatalogFamilyRecord>(
    input.catalogData.families,
  );
  const localFamilies = resolveReferralCatalogItems<ReferralCatalogFamilyRecord>(
    input.localCatalogData?.families,
  );
  const catalogOffers = resolveReferralCatalogItems<ReferralCatalogOfferRecord>(
    input.catalogData.offers,
  );
  const localOffers = resolveReferralCatalogItems<ReferralCatalogOfferRecord>(
    input.localCatalogData?.offers,
  );
  const catalogMatchers = resolveReferralCatalogItems<ReferralCatalogMatcherRecord>(
    input.catalogData.matchers,
  );
  const localMatchers = resolveReferralCatalogItems<ReferralCatalogMatcherRecord>(
    input.localCatalogData?.matchers,
  );
  const issues: ValidationIssue[] = [
    ...referralCatalogDuplicateIdIssues({
      entries: catalogFamilies,
      idKey: "familyId",
      label: "family",
      sectionName: "families",
      source: input.catalogSource,
    }),
    ...referralCatalogDuplicateIdIssues({
      entries: catalogOffers,
      idKey: "offerId",
      label: "offer",
      sectionName: "offers",
      source: input.catalogSource,
    }),
    ...referralCatalogDuplicateIdIssues({
      entries: catalogMatchers,
      idKey: "matcherId",
      label: "matcher",
      sectionName: "matchers",
      source: input.catalogSource,
    }),
  ];

  if (input.localCatalogSource) {
    issues.push(
      ...referralCatalogDuplicateIdIssues({
        entries: localFamilies,
        idKey: "familyId",
        label: "family",
        sectionName: "families",
        source: input.localCatalogSource,
      }),
      ...referralCatalogDuplicateIdIssues({
        entries: localOffers,
        idKey: "offerId",
        label: "offer",
        sectionName: "offers",
        source: input.localCatalogSource,
      }),
      ...referralCatalogDuplicateIdIssues({
        entries: localMatchers,
        idKey: "matcherId",
        label: "matcher",
        sectionName: "matchers",
        source: input.localCatalogSource,
      }),
    );
  }

  return {
    issues,
    index: {
      families: mergeReferralCatalogSectionById(catalogFamilies, localFamilies, "familyId"),
      offers: mergeReferralCatalogSectionById(catalogOffers, localOffers, "offerId"),
      matchers: mergeReferralCatalogSectionById(catalogMatchers, localMatchers, "matcherId"),
    },
  };
};

export const referralCatalogRelationshipIssues = (
  input: ReferralCatalogIntegrityInput,
  index: ReferralCatalogIndex,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  const checkOffers = (
    entries: readonly ReferralCatalogOfferRecord[],
    source: string,
    sectionName: string,
  ) => {
    entries.forEach((offer, indexInSection) => {
      const offerId = toStringOrUndefined(offer.offerId) ?? `offers[${indexInSection}]`;
      const familyId = toStringOrUndefined(offer.familyId);

      if (!familyId) {
        return;
      }

      if (!index.families.has(familyId)) {
        issues.push({
          level: "error",
          source,
          path: `$.${sectionName}[${indexInSection}].familyId`,
          message: `Referral catalog offer '${offerId}' references unknown familyId '${familyId}'.`,
          remediation: `Use an existing familyId from ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or add the missing family entry before rerunning validation.`,
        });
      }
    });
  };

  const checkMatchers = (
    entries: readonly ReferralCatalogMatcherRecord[],
    source: string,
    sectionName: string,
  ) => {
    entries.forEach((matcher, indexInSection) => {
      const matcherId = toStringOrUndefined(matcher.matcherId) ?? `matchers[${indexInSection}]`;
      const familyId = toStringOrUndefined(matcher.familyId);
      const offerId = toStringOrUndefined(matcher.offerId);
      const maybeOffer = offerId ? index.offers.get(offerId) : undefined;

      if (familyId && !index.families.has(familyId)) {
        issues.push({
          level: "error",
          source,
          path: `$.${sectionName}[${indexInSection}].familyId`,
          message: `Referral catalog matcher '${matcherId}' references unknown familyId '${familyId}'.`,
          remediation: `Use an existing familyId from ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or add the missing family entry before rerunning validation.`,
        });
      }

      if (offerId && !maybeOffer) {
        issues.push({
          level: "error",
          source,
          path: `$.${sectionName}[${indexInSection}].offerId`,
          message: `Referral catalog matcher '${matcherId}' references unknown offerId '${offerId}'.`,
          remediation: `Use an existing offerId from ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or add the missing offer entry before rerunning validation.`,
        });
        return;
      }

      const offerFamilyId = toStringOrUndefined(maybeOffer?.familyId);
      if (familyId && offerFamilyId && familyId !== offerFamilyId) {
        issues.push({
          level: "error",
          source,
          path: `$.${sectionName}[${indexInSection}]`,
          message: `Referral catalog matcher '${matcherId}' mixes familyId '${familyId}' with offerId '${offerId}' from family '${offerFamilyId}'.`,
          remediation:
            "Keep matcher familyId and offerId aligned to the same family before rerunning validation.",
        });
      }
    });
  };

  checkOffers(
    resolveReferralCatalogItems<ReferralCatalogOfferRecord>(input.catalogData.offers),
    input.catalogSource,
    "offers",
  );
  checkMatchers(
    resolveReferralCatalogItems<ReferralCatalogMatcherRecord>(input.catalogData.matchers),
    input.catalogSource,
    "matchers",
  );

  if (input.localCatalogData && input.localCatalogSource) {
    checkOffers(
      resolveReferralCatalogItems<ReferralCatalogOfferRecord>(input.localCatalogData.offers),
      input.localCatalogSource,
      "offers",
    );
    checkMatchers(
      resolveReferralCatalogItems<ReferralCatalogMatcherRecord>(input.localCatalogData.matchers),
      input.localCatalogSource,
      "matchers",
    );
  }

  return issues;
};

export const referralCatalogLinkReferenceIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  index: ReferralCatalogIndex,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const links = Array.isArray(linksData.links) ? linksData.links : [];

  links.forEach((rawLink, indexInSection) => {
    if (!isRecord(rawLink) || !isRecord(rawLink.referral)) {
      return;
    }

    const catalogRef = normalizeReferralCatalogRef(rawLink.referral.catalogRef);
    if (!catalogRef) {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${indexInSection}]`;
    const maybeFamily = catalogRef.familyId ? index.families.get(catalogRef.familyId) : undefined;
    const maybeOffer = catalogRef.offerId ? index.offers.get(catalogRef.offerId) : undefined;
    const maybeMatcher = catalogRef.matcherId
      ? index.matchers.get(catalogRef.matcherId)
      : undefined;

    if (catalogRef.familyId && !maybeFamily) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef.familyId`,
        message: `Link '${linkId}' references unknown referral catalog familyId '${catalogRef.familyId}'.`,
        remediation: `Use a familyId defined in ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or remove $.links[${indexInSection}].referral.catalogRef.familyId.`,
      });
    }

    if (catalogRef.offerId && !maybeOffer) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef.offerId`,
        message: `Link '${linkId}' references unknown referral catalog offerId '${catalogRef.offerId}'.`,
        remediation: `Use an offerId defined in ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or remove $.links[${indexInSection}].referral.catalogRef.offerId.`,
      });
    }

    if (catalogRef.matcherId && !maybeMatcher) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef.matcherId`,
        message: `Link '${linkId}' references unknown referral catalog matcherId '${catalogRef.matcherId}'.`,
        remediation: `Use a matcherId defined in ${DEFAULT_REFERRAL_CATALOG_PATH} or ${DEFAULT_REFERRAL_CATALOG_LOCAL_PATH}, or remove $.links[${indexInSection}].referral.catalogRef.matcherId.`,
      });
    }

    const offerFamilyId = toStringOrUndefined(maybeOffer?.familyId);
    if (catalogRef.familyId && offerFamilyId && catalogRef.familyId !== offerFamilyId) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef`,
        message: `Link '${linkId}' mixes familyId '${catalogRef.familyId}' with offerId '${catalogRef.offerId}' from family '${offerFamilyId}'.`,
        remediation:
          "Keep link-level catalog familyId and offerId aligned to the same catalog family, or remove the redundant field.",
      });
    }

    const matcherFamilyId = toStringOrUndefined(maybeMatcher?.familyId);
    if (catalogRef.familyId && matcherFamilyId && catalogRef.familyId !== matcherFamilyId) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef`,
        message: `Link '${linkId}' mixes familyId '${catalogRef.familyId}' with matcherId '${catalogRef.matcherId}' from family '${matcherFamilyId}'.`,
        remediation:
          "Keep link-level catalog familyId and matcherId aligned to the same catalog family, or remove the redundant field.",
      });
    }

    const matcherOfferId = toStringOrUndefined(maybeMatcher?.offerId);
    if (catalogRef.offerId && matcherOfferId && catalogRef.offerId !== matcherOfferId) {
      issues.push({
        level: "error",
        source: linksSource,
        path: `$.links[${indexInSection}].referral.catalogRef`,
        message: `Link '${linkId}' mixes offerId '${catalogRef.offerId}' with matcherId '${catalogRef.matcherId}' from offer '${matcherOfferId}'.`,
        remediation:
          "Keep link-level catalog offerId and matcherId aligned to the same catalog offer, or remove the redundant field.",
      });
    }
  });

  return issues;
};

export const loadReferralCatalogPayload = (
  filePath: string,
): { exists: boolean; value: ReferralCatalogPayload | null; errorMessage?: string } => {
  if (!fs.existsSync(absolutePath(filePath))) {
    return { exists: false, value: null };
  }

  const read = tryReadJsonFile<ReferralCatalogPayload>(filePath);
  return {
    exists: true,
    value: read.value,
    errorMessage: read.errorMessage,
  };
};

export const collectReferralCatalogIssues = (input: {
  catalogPath?: string;
  linksData: Record<string, unknown>;
  linksSource: string;
  localCatalogPath?: string;
  schemaPath?: string;
}): ValidationIssue[] => {
  const catalogPath = input.catalogPath ?? DEFAULT_REFERRAL_CATALOG_PATH;
  const localCatalogPath = input.localCatalogPath ?? DEFAULT_REFERRAL_CATALOG_LOCAL_PATH;
  const schemaPath = input.schemaPath ?? DEFAULT_REFERRAL_CATALOG_SCHEMA_PATH;
  const schemaRead = tryReadJsonFile<Record<string, unknown>>(schemaPath);

  if (!schemaRead.value) {
    return [
      {
        level: "error",
        source: schemaPath,
        path: "$",
        message: `Failed to load referral catalog schema. ${schemaRead.errorMessage ?? ""}`.trim(),
        remediation:
          "Restore schema/referral-catalog.schema.json so shared and fork-local referral catalogs can be validated.",
      },
    ];
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schemaRead.value);
  const issues: ValidationIssue[] = [];

  const pushSchemaIssues = (source: string, value: ReferralCatalogPayload | null) => {
    if (!value) {
      return;
    }

    const valid = validate(value);
    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        issues.push(schemaIssue(source, error));
      }
    }
  };

  const catalogRead = loadReferralCatalogPayload(catalogPath);
  if (!catalogRead.exists || !catalogRead.value) {
    issues.push({
      level: "error",
      source: catalogPath,
      path: "$",
      message: `Failed to load shared referral catalog. ${catalogRead.errorMessage ?? ""}`.trim(),
      remediation:
        "Restore data/policy/referral-catalog.json and ensure it validates against schema/referral-catalog.schema.json before rerunning validation.",
    });
    return issues;
  }

  pushSchemaIssues(catalogPath, catalogRead.value);

  const localCatalogRead = loadReferralCatalogPayload(localCatalogPath);
  if (localCatalogRead.exists && !localCatalogRead.value) {
    issues.push({
      level: "error",
      source: localCatalogPath,
      path: "$",
      message:
        `Failed to load fork-local referral catalog overlay. ${localCatalogRead.errorMessage ?? ""}`.trim(),
      remediation:
        "Fix or remove data/policy/referral-catalog.local.json, then rerun validation. The overlay file is optional but must parse and validate when present.",
    });
  }

  if (localCatalogRead.value) {
    pushSchemaIssues(localCatalogPath, localCatalogRead.value);
  }

  const integrity = buildReferralCatalogIndex({
    catalogData: catalogRead.value,
    catalogSource: catalogPath,
    linksData: input.linksData,
    linksSource: input.linksSource,
    localCatalogData: localCatalogRead.value ?? undefined,
    localCatalogSource: localCatalogRead.value ? localCatalogPath : undefined,
  });
  issues.push(...integrity.issues);
  issues.push(
    ...referralCatalogRelationshipIssues(
      {
        catalogData: catalogRead.value,
        catalogSource: catalogPath,
        linksData: input.linksData,
        linksSource: input.linksSource,
        localCatalogData: localCatalogRead.value ?? undefined,
        localCatalogSource: localCatalogRead.value ? localCatalogPath : undefined,
      },
      integrity.index,
    ),
  );
  issues.push(
    ...referralCatalogLinkReferenceIssues(input.linksSource, input.linksData, integrity.index),
  );

  return issues;
};
