import {
  getLinkContentImageSlotId,
  resolveEffectiveLinkContentImageMetadata,
} from "../../src/lib/content/content-image-slots";
import type { OpenLink } from "../../src/lib/content/load-content";
import {
  type GeneratedLinkReferralConfig,
  type LinkReferralConfig,
  REFERRAL_PROVENANCE_FIELDS,
  normalizeReferralConfig,
} from "../../src/lib/content/referral-fields";
import {
  mergeMetadataWithManualSocialProfileOverrides,
  resolveMissingSupportedSocialProfileFields,
  resolveSupportedSocialProfile,
} from "../../src/lib/content/social-profile-fields";
import type { ValidationIssue } from "./rules-contracts";
import {
  hasUrlScheme,
  resolveEnabledByDefault,
  resolveRichRenderMode,
  richLinkNeedsPreviewValidation,
  toCanonicalHttpUrl,
} from "./validate-data-enrichment-cache";
import { isRecord, toStringOrUndefined } from "./validate-data-runtime";

export const resolvePreviewImageAvailability = (
  imageCandidate: string | undefined,
  slotId: string,
  generatedContentImagesBySlot: Record<string, { resolvedPath?: string }>,
  contentImagesPath: string,
): { hasImage: boolean; detail: string } => {
  if (!imageCandidate) {
    return {
      hasImage: false,
      detail: "No metadata.image value was found.",
    };
  }

  const trimmed = imageCandidate.trim();
  if (trimmed.length === 0) {
    return {
      hasImage: false,
      detail: "metadata.image is an empty string.",
    };
  }

  if (!hasUrlScheme(trimmed)) {
    return { hasImage: true, detail: "" };
  }

  const canonical = toCanonicalHttpUrl(trimmed);
  if (!canonical) {
    return {
      hasImage: false,
      detail: `metadata.image uses an unsupported URL scheme (${trimmed}).`,
    };
  }

  const entry = generatedContentImagesBySlot[slotId];
  if (entry && typeof entry.resolvedPath === "string" && entry.resolvedPath.trim().length > 0) {
    return { hasImage: true, detail: "" };
  }

  return {
    hasImage: false,
    detail: `metadata.image points to a remote URL that was not materialized in ${contentImagesPath}. Runtime strips that image before rendering.`,
  };
};

export const richCardPreviewImageIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  generatedMetadataByLink: Record<string, Record<string, unknown>>,
  generatedContentImagesBySlot: Record<string, { resolvedPath?: string }>,
  metadataPath: string,
  contentImagesPath: string,
): ValidationIssue[] => {
  if (resolveRichRenderMode(siteData) === "simple") {
    return [];
  }

  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);
  const issues: ValidationIssue[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich" || rawLink.enabled === false) {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const generatedMetadata = generatedMetadataByLink[linkId];
    const effectiveMetadata = resolveEffectiveLinkContentImageMetadata({
      link: rawLink as unknown as OpenLink,
      generatedMetadata,
    });
    if (!richLinkNeedsPreviewValidation(siteData, rawLink, generatedMetadata)) {
      return;
    }
    const previewImage = toStringOrUndefined(effectiveMetadata.image);
    const imageAvailability = resolvePreviewImageAvailability(
      previewImage,
      getLinkContentImageSlotId(linkId, "image"),
      generatedContentImagesBySlot,
      contentImagesPath,
    );

    if (imageAvailability.hasImage) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enrichmentEnabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    const url = toStringOrUndefined(rawLink.url);
    const linkPath = `$.links[${index}]`;
    const imagePath = `${linkPath}.metadata.image`;

    const remediationBase = `Add a preview image at ${imagePath} (for example a local 'cache/content-images/<hash>.jpg' asset or a remote URL that resolves into ${contentImagesPath}).`;
    const enrichmentRemediation = enrichmentEnabled
      ? `If this rich link should use enrichment, rerun npm run enrich:rich:strict && npm run images:sync and verify ${metadataPath} has metadata.image for '${linkId}'.`
      : "This link has enrichment disabled; either add manual metadata.image, switch the link type to 'simple', or re-enable enrichment and rerun npm run enrich:rich:strict && npm run images:sync.";

    issues.push({
      level: "error",
      source: linksSource,
      path: imagePath,
      message:
        `Rich-card rendering is enabled for link '${linkId}'${url ? ` (${url})` : ""}, ` +
        `but no renderable preview image is available. ${imageAvailability.detail}`,
      remediation:
        `${remediationBase} ${enrichmentRemediation} If this link should never use a rich card, ` +
        `${linkPath}.type can be set to 'simple' (or set site.ui.richCards.renderMode='simple' globally).`,
    });
  });

  return issues;
};

export const supportedSocialProfileMetadataIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  siteData: Record<string, unknown>,
  generatedMetadataByLink: Record<string, Record<string, unknown>>,
): ValidationIssue[] => {
  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const enabledByDefault = resolveEnabledByDefault(siteData);
  const issues: ValidationIssue[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.type !== "rich" || rawLink.enabled === false) {
      return;
    }

    const enrichment = isRecord(rawLink.enrichment) ? rawLink.enrichment : undefined;
    const enrichmentEnabled =
      typeof enrichment?.enabled === "boolean" ? enrichment.enabled : enabledByDefault;
    if (!enrichmentEnabled) {
      return;
    }

    const url = toStringOrUndefined(rawLink.url);
    if (!url) {
      return;
    }

    const supportedProfile = resolveSupportedSocialProfile({
      url,
      icon: toStringOrUndefined(rawLink.icon),
      metadataHandle: isRecord(rawLink.metadata) ? rawLink.metadata.handle : undefined,
      profileSemantics: enrichment?.profileSemantics,
    });
    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const manualMetadata = isRecord(rawLink.metadata) ? rawLink.metadata : {};
    const generatedMetadata = generatedMetadataByLink[linkId] ?? {};
    const mergedMetadata =
      mergeMetadataWithManualSocialProfileOverrides(manualMetadata, generatedMetadata) ?? {};
    const resolvedSupportedProfile =
      resolveSupportedSocialProfile({
        url,
        icon: toStringOrUndefined(rawLink.icon),
        metadataHandle: mergedMetadata.handle,
        profileSemantics: enrichment?.profileSemantics,
      }) ?? supportedProfile;
    if (!resolvedSupportedProfile) {
      return;
    }
    const missingProfileFields = resolveMissingSupportedSocialProfileFields(
      mergedMetadata,
      resolvedSupportedProfile,
    );

    if (missingProfileFields.length === 0) {
      return;
    }

    const refreshCommand = toStringOrUndefined(enrichment?.authenticatedExtractor)
      ? `Run npm run setup:rich-auth (or npm run auth:rich:sync -- --only-link ${linkId})`
      : "Run npm run enrich:rich:strict";

    issues.push({
      level: "warning",
      source: linksSource,
      path: `$.links[${index}].metadata`,
      message:
        `Supported ${resolvedSupportedProfile.platform} profile link '${linkId}' is missing expected social profile metadata: ` +
        `${missingProfileFields.join(", ")}.`,
      remediation: `${refreshCommand}, or add manual values under $.links[${index}].metadata for the missing fields.`,
      strictBlocking: false,
    });
  });

  return issues;
};

export const referralGeneratedConflictIssues = (
  linksSource: string,
  linksData: Record<string, unknown>,
  generatedReferralByLink: Record<string, GeneratedLinkReferralConfig>,
): ValidationIssue[] => {
  const links = Array.isArray(linksData.links) ? linksData.links : [];
  const issues: ValidationIssue[] = [];

  links.forEach((rawLink, index) => {
    if (!isRecord(rawLink) || rawLink.enabled === false) {
      return;
    }

    const linkId = toStringOrUndefined(rawLink.id) ?? `links[${index}]`;
    const manualReferral = normalizeReferralConfig(
      isRecord(rawLink.referral) ? (rawLink.referral as LinkReferralConfig) : undefined,
    );
    const generatedReferral = normalizeReferralConfig(generatedReferralByLink[linkId]);

    if (!manualReferral || !generatedReferral) {
      return;
    }

    const mismatchedFields = REFERRAL_PROVENANCE_FIELDS.filter((field) => {
      const manualValue =
        typeof manualReferral[field] === "string" ? manualReferral[field] : undefined;
      const generatedValue =
        typeof generatedReferral[field] === "string" ? generatedReferral[field] : undefined;

      return (
        typeof manualValue === "string" &&
        typeof generatedValue === "string" &&
        manualValue !== generatedValue
      );
    });

    if (mismatchedFields.length === 0) {
      return;
    }

    issues.push({
      level: "warning",
      strictBlocking: false,
      source: linksSource,
      path: `$.links[${index}].referral`,
      message:
        `Referral drift warning for link '${linkId}': manual referral fields disagree with generated referral data for ` +
        `${mismatchedFields.join(", ")}.`,
      remediation:
        "Keep manual referral values authoritative, or refresh generated referral data so the saved disclosure and generated output agree.",
    });
  });

  return issues;
};
