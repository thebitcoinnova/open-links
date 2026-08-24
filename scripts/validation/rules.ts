import {
  hasMeaningfulReferralContent,
  normalizeReferralConfig,
} from "../../src/lib/content/referral-fields";
import {
  resolveLinkProfileSemantics,
  resolveSupportedSocialProfile,
} from "../../src/lib/content/social-profile-fields";
import { normalizeHandle, resolveHandleFromUrl } from "../../src/lib/identity/handle-resolver";
import {
  BASE_ALLOWED_SCHEMES,
  LINKS_ROOT_KEYS,
  LINK_KEYS,
  PAYMENT_ALLOWED_SCHEMES,
  PROFILE_KEYS,
  SITE_KEYS,
  checkCustomConflicts,
  checkIconOverrideAliases,
  checkKnownIconAlias,
  checkScheme,
  handleResolutionReasonSummary,
  isRecord,
  toStringOrUndefined,
  unknownTopLevelWarnings,
} from "./rules-common";
import type { PolicyInput, ValidationIssue } from "./rules-contracts";
import { checkPaymentConfig, checkSitePaymentsConfig } from "./rules-payment";

export type { PolicyInput, ValidationIssue } from "./rules-contracts";

const collectLinkPolicyIssues = (
  links: Record<string, unknown>,
  source: string,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const linkItems = Array.isArray(links.links) ? links.links : [];
  linkItems.forEach((link, index) => {
    if (!isRecord(link)) {
      return;
    }

    const linkUrl = toStringOrUndefined(link.url);
    const linkIcon = toStringOrUndefined(link.icon);
    const linkEnabled = link.enabled !== false;
    const metadata = isRecord(link.metadata) ? link.metadata : undefined;
    const enrichment = isRecord(link.enrichment) ? link.enrichment : undefined;
    const referral = normalizeReferralConfig(isRecord(link.referral) ? link.referral : undefined);
    const manualHandle = normalizeHandle(metadata?.handle);
    const profileSemantics = resolveLinkProfileSemantics(enrichment?.profileSemantics);
    const handleResolution = resolveHandleFromUrl({
      url: linkUrl,
      icon: linkIcon,
    });

    if (linkEnabled && referral && !hasMeaningfulReferralContent(referral)) {
      issues.push({
        level: "warning",
        strictBlocking: false,
        source: source,
        path: `$.links[${index}].referral`,
        message: `Referral disclosure warning for link '${toStringOrUndefined(link.id) ?? `links[${index}]`}': referral is marked, but no meaningful disclosure fields are present.`,
        remediation:
          "Add one or more of links[].referral.visitorBenefit, ownerBenefit, offerSummary, " +
          "termsSummary, termsUrl, or code. `kind` alone classifies the link but does not disclose the offer.",
      });
    }

    if (linkEnabled && referral && linkUrl) {
      const supportedReferralProfile = resolveSupportedSocialProfile({
        url: linkUrl,
        icon: linkIcon,
        metadataHandle: metadata?.handle,
        profileSemantics: "auto",
      });

      if (supportedReferralProfile && profileSemantics !== "non_profile") {
        issues.push({
          level: "warning",
          strictBlocking: false,
          source: source,
          path: `$.links[${index}].enrichment.profileSemantics`,
          message: `Referral semantics warning for link '${toStringOrUndefined(link.id) ?? `links[${index}]`}': supported ${supportedReferralProfile.platform} profile-family URLs used as referral links should usually set enrichment.profileSemantics='non_profile' to avoid profile-style rendering.`,
          remediation:
            "Set links[].enrichment.profileSemantics to 'non_profile' for referral/promo links on supported profile-family URLs unless you intentionally want profile-style semantics.",
        });
      }
    }

    if (linkEnabled && linkUrl && profileSemantics === "profile") {
      const supportedProfile = resolveSupportedSocialProfile({
        url: linkUrl,
        icon: linkIcon,
        metadataHandle: metadata?.handle,
        profileSemantics,
      });

      if (!supportedProfile) {
        issues.push({
          level: "warning",
          strictBlocking: false,
          source: source,
          path: `$.links[${index}].enrichment.profileSemantics`,
          message: `Profile semantics warning for link '${toStringOrUndefined(link.id) ?? `links[${index}]`}': enrichment.profileSemantics='profile' is set, but no supported social profile could be resolved from the URL or metadata.handle.`,
          remediation:
            "Use a canonical profile URL for this domain, set links[].metadata.handle manually, or switch links[].enrichment.profileSemantics to 'auto' or 'non_profile'.",
        });
      }
    }

    if (
      linkEnabled &&
      linkUrl &&
      profileSemantics === "auto" &&
      !manualHandle &&
      handleResolution.supported &&
      !handleResolution.handle
    ) {
      const extractorLabel = handleResolution.extractorId ?? "supported";
      issues.push({
        level: "warning",
        strictBlocking: false,
        source: source,
        path: `$.links[${index}].metadata.handle`,
        message:
          `Handle extraction warning for link '${toStringOrUndefined(link.id) ?? `links[${index}]`}': ` +
          `supported extractor '${extractorLabel}' could not resolve a handle. ` +
          `${handleResolutionReasonSummary(handleResolution.reason)}`,
        remediation:
          "Use a canonical profile URL for this domain or set links[].metadata.handle manually. " +
          "Handle coverage warnings are informational and do not fail strict validation.",
      });
    }

    const linkType = toStringOrUndefined(link.type);
    const paymentConfig = isRecord(link.payment) ? link.payment : undefined;
    const isPaymentContext = linkType === "payment" || Boolean(paymentConfig);

    if (linkType === "simple" || linkType === "rich" || linkUrl) {
      issues.push(
        ...checkScheme(source, `$.links[${index}].url`, linkUrl, {
          allowedSchemes: isPaymentContext ? PAYMENT_ALLOWED_SCHEMES : BASE_ALLOWED_SCHEMES,
          remediation: isPaymentContext
            ? "Use http/https/mailto/tel or a supported payment scheme for payment-enabled links."
            : "Use one of: http, https, mailto, tel.",
        }),
      );
    }

    issues.push(...checkKnownIconAlias(source, `$.links[${index}].icon`, link.icon));
    issues.push(...checkPaymentConfig(source, `$.links[${index}].payment`, link.payment));
    issues.push(
      ...checkCustomConflicts(source, link.custom, LINK_KEYS, `$.links[${index}].custom`),
    );
  });
  return issues;
};

export const runPolicyRules = ({
  profile,
  links,
  site,
  sources: overrideSources,
}: PolicyInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const sources = {
    profile: "data/profile.json",
    links: "data/links.json",
    site: "data/site.json",
    ...overrideSources,
  };

  issues.push(...unknownTopLevelWarnings(sources.profile, profile, PROFILE_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.links, links, LINKS_ROOT_KEYS));
  issues.push(...unknownTopLevelWarnings(sources.site, site, SITE_KEYS));

  issues.push(...checkCustomConflicts(sources.profile, profile.custom, PROFILE_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.links, links.custom, LINKS_ROOT_KEYS, "$.custom"));
  issues.push(...checkCustomConflicts(sources.site, site.custom, SITE_KEYS, "$.custom"));

  const siteUi = isRecord(site.ui) ? site.ui : undefined;
  const maybeScale =
    siteUi && typeof siteUi.profileAvatarScale === "number" ? siteUi.profileAvatarScale : undefined;
  if (maybeScale !== undefined && (maybeScale <= 0 || maybeScale > 4)) {
    issues.push({
      level: "warning",
      source: sources.site,
      path: "$.ui.profileAvatarScale",
      message: `profileAvatarScale ${maybeScale} is outside the recommended 0–4 range.`,
      remediation: "Use a value between 0 and 4 (default 1.5) for avatar size multiplier.",
    });
  }
  const brandIcons = siteUi && isRecord(siteUi.brandIcons) ? siteUi.brandIcons : undefined;
  issues.push(
    ...checkIconOverrideAliases(
      sources.site,
      "$.ui.brandIcons.iconOverrides",
      brandIcons?.iconOverrides,
    ),
  );
  issues.push(...checkSitePaymentsConfig(sources.site, site));

  const profileLinks = Array.isArray(profile.profileLinks) ? profile.profileLinks : [];
  profileLinks.forEach((link, index) => {
    if (isRecord(link)) {
      issues.push(
        ...checkScheme(sources.profile, `$.profileLinks[${index}].url`, link.url, {
          allowedSchemes: BASE_ALLOWED_SCHEMES,
          remediation: "Use one of: http, https, mailto, tel.",
        }),
      );
    }
  });

  issues.push(...collectLinkPolicyIssues(links, sources.links));

  return issues;
};
