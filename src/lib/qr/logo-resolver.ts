import type { OpenLink } from "../content/load-content";
import type { KnownSiteId } from "../icons/known-sites-data";
import { resolveKnownSite } from "../icons/known-sites-data";
import { normalizeCustomLogoUrl, resolvePaymentRailLogoUrl } from "../payments/rail-logos";
import type {
  PaymentQrBadgeConfig,
  PaymentQrBadgeItem,
  PaymentQrLogoMode,
  PaymentRail,
  PaymentRailType,
} from "../payments/types";
import { resolveSocialProfileMetadata } from "../ui/social-profile-metadata";
import {
  type ResolvedQrBadgeEntry,
  dedupeQrBadgeEntries,
  resolveAssetQrBadgeEntry,
  resolveComposedQrBadgeUrl,
  resolveComposedQrBadgeUrlWithEmbeddedAssets,
  resolveKnownSiteQrBadgeEntry,
} from "./logo-badges";

export interface ResolvedQrLogo {
  logoSize: number;
  logoUrl?: string;
}

interface ResolvedQrBadgeComposition {
  entries: ResolvedQrBadgeEntry[];
  fallbackLogoUrl?: string;
  foregroundEntryIndex?: 0 | 1;
}

export type ResolveQrLogoInput =
  | {
      kind: "profile";
      avatarUrl?: string;
      siteLogoUrl?: string;
      logoSize?: number;
    }
  | {
      kind: "link";
      link: OpenLink;
      logoSize?: number;
    }
  | {
      kind: "payment";
      link: OpenLink;
      rail: PaymentRail;
      badge?: PaymentQrBadgeConfig;
      customLogoUrl?: string;
      defaultLogoMode?: PaymentQrLogoMode;
      logoMode?: PaymentQrLogoMode;
      logoSize?: number;
    };

const DEFAULT_QR_LOGO_SIZE = 0.24;

const paymentRailSiteIds: Record<PaymentRailType, KnownSiteId> = {
  patreon: "patreon",
  kofi: "kofi",
  paypal: "paypal",
  cashapp: "cashapp",
  stripe: "stripe",
  coinbase: "coinbase",
  bitcoin: "bitcoin",
  lightning: "lightning",
  ethereum: "ethereum",
  solana: "solana",
  "custom-crypto": "wallet",
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampQrLogoSize = (value: number | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_QR_LOGO_SIZE;
  }

  return clamp(value, 0.15, 0.35);
};

const resolveBadgeUrl = (
  entries: ResolvedQrBadgeEntry[],
  options?: { foregroundEntryIndex?: 0 | 1 },
): string | undefined => {
  const dedupedEntries = dedupeQrBadgeEntries(entries);

  if (dedupedEntries.length === 0) {
    return undefined;
  }

  return resolveComposedQrBadgeUrl(dedupedEntries, options);
};

const resolveBadgeCompositionUrl = (composition: ResolvedQrBadgeComposition): string | undefined =>
  resolveBadgeUrl(composition.entries, {
    foregroundEntryIndex: composition.foregroundEntryIndex,
  }) ?? composition.fallbackLogoUrl;

const resolveEmbeddedBadgeCompositionUrl = async (
  composition: ResolvedQrBadgeComposition,
  baseUrl?: string,
): Promise<string | undefined> =>
  (await resolveComposedQrBadgeUrlWithEmbeddedAssets(
    composition.entries,
    {
      foregroundEntryIndex: composition.foregroundEntryIndex,
    },
    baseUrl,
  )) ?? composition.fallbackLogoUrl;

const resolveLinkPrimaryBadgeEntry = (
  link: OpenLink,
): Extract<ResolvedQrBadgeEntry, { kind: "asset" }> | undefined => {
  const socialProfile = resolveSocialProfileMetadata(link);

  if (socialProfile.usesProfileLayout && socialProfile.profileImageUrl) {
    return resolveAssetQrBadgeEntry(socialProfile.profileImageUrl, `${link.label} profile image`);
  }

  if (socialProfile.hasDistinctPreviewImage && socialProfile.previewImageUrl) {
    return resolveAssetQrBadgeEntry(socialProfile.previewImageUrl, `${link.label} preview image`);
  }

  return undefined;
};

const resolveRailEntry = (railType: PaymentRailType): ResolvedQrBadgeEntry | undefined =>
  resolveKnownSiteQrBadgeEntry(paymentRailSiteIds[railType]);

const resolveLinkSiteEntry = (link: OpenLink): ResolvedQrBadgeEntry | undefined => {
  const maybeKnownSite = resolveKnownSite(link.icon, link.url);

  if (!maybeKnownSite) {
    return undefined;
  }

  return resolveKnownSiteQrBadgeEntry(maybeKnownSite.id);
};

const resolveProfileQrLogoUrl = (
  input: Extract<ResolveQrLogoInput, { kind: "profile" }>,
): string | undefined => {
  return resolveBadgeCompositionUrl(resolveProfileQrBadgeComposition(input));
};

const resolveProfileQrBadgeComposition = (
  input: Extract<ResolveQrLogoInput, { kind: "profile" }>,
): ResolvedQrBadgeComposition => {
  const maybeAvatarEntry = resolveAssetQrBadgeEntry(input.avatarUrl, "Profile avatar");

  if (!maybeAvatarEntry) {
    return {
      entries: [],
    };
  }

  const maybeSiteEntry = resolveAssetQrBadgeEntry(input.siteLogoUrl, "Site logo");

  if (!maybeSiteEntry) {
    return {
      entries: [maybeAvatarEntry],
      fallbackLogoUrl: maybeAvatarEntry.url,
    };
  }

  return {
    entries: [maybeAvatarEntry, maybeSiteEntry],
    fallbackLogoUrl: maybeAvatarEntry.url,
    foregroundEntryIndex: 0,
  };
};

const resolveLinkQrLogoUrl = (link: OpenLink): string | undefined => {
  return resolveBadgeCompositionUrl(resolveLinkQrBadgeComposition(link));
};

const resolveLinkQrBadgeComposition = (link: OpenLink): ResolvedQrBadgeComposition => {
  const maybePrimaryEntry = resolveLinkPrimaryBadgeEntry(link);
  const maybeSiteEntry = resolveLinkSiteEntry(link);

  if (maybePrimaryEntry && maybeSiteEntry) {
    return {
      entries: [maybePrimaryEntry, maybeSiteEntry],
      fallbackLogoUrl: maybePrimaryEntry.url,
      foregroundEntryIndex: 0,
    };
  }

  if (maybePrimaryEntry?.kind === "asset") {
    return {
      entries: [maybePrimaryEntry],
      fallbackLogoUrl: maybePrimaryEntry.url,
    };
  }

  if (maybeSiteEntry) {
    return {
      entries: [maybeSiteEntry],
    };
  }

  return {
    entries: [],
  };
};

const resolvePaymentAutoSiteEntry = (
  link: OpenLink,
  rail: PaymentRail,
): ResolvedQrBadgeEntry | undefined => {
  const maybeKnownSite =
    resolveKnownSite(link.icon, link.url) ?? resolveKnownSite(rail.icon, rail.url);

  if (!maybeKnownSite) {
    return undefined;
  }

  if (maybeKnownSite.id === paymentRailSiteIds[rail.rail]) {
    return undefined;
  }

  return resolveKnownSiteQrBadgeEntry(maybeKnownSite.id);
};

const resolveBadgeItems = (
  items: PaymentQrBadgeItem[] | undefined,
  railType: PaymentRailType,
): ResolvedQrBadgeEntry[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  const entries = items.flatMap((item): ResolvedQrBadgeEntry[] => {
    if (item.type === "rail") {
      const maybeRailEntry = resolveRailEntry(railType);
      return maybeRailEntry ? [maybeRailEntry] : [];
    }

    if (item.type === "site") {
      if (typeof item.value !== "string") {
        return [];
      }

      const maybeSiteEntry = resolveKnownSiteQrBadgeEntry(item.value as KnownSiteId);
      return maybeSiteEntry ? [maybeSiteEntry] : [];
    }

    if (item.type === "asset") {
      const maybeAssetUrl = normalizeCustomLogoUrl(item.value);
      if (!maybeAssetUrl) {
        return [];
      }

      return [
        {
          kind: "asset",
          label: item.value ?? "Asset",
          url: maybeAssetUrl,
        },
      ];
    }

    return [];
  });

  return dedupeQrBadgeEntries(entries).slice(0, 2);
};

const resolveExplicitPaymentLogoUrl = (input: {
  customLogoUrl?: string;
  logoMode?: PaymentQrLogoMode;
  railType: PaymentRailType;
}): string | undefined => {
  if (!input.logoMode) {
    return undefined;
  }

  return resolvePaymentRailLogoUrl({
    railType: input.railType,
    logoMode: input.logoMode,
    customLogoUrl: input.customLogoUrl,
  });
};

const resolveDefaultPaymentLogoUrl = (input: {
  customLogoUrl?: string;
  defaultLogoMode?: PaymentQrLogoMode;
  railType: PaymentRailType;
}): string | undefined => {
  if (input.defaultLogoMode === "none") {
    return undefined;
  }

  return resolvePaymentRailLogoUrl({
    railType: input.railType,
    logoMode: "rail-default",
    customLogoUrl: input.customLogoUrl,
  });
};

const shouldRenderPaymentSiteEntryInForeground = (railType: PaymentRailType): boolean =>
  railType === "lightning";

const resolveAutoPaymentLogoUrl = (input: {
  customLogoUrl?: string;
  defaultLogoMode?: PaymentQrLogoMode;
  link: OpenLink;
  rail: PaymentRail;
}): string | undefined => {
  const maybeSiteEntry = resolvePaymentAutoSiteEntry(input.link, input.rail);
  const maybeRailEntry = resolveRailEntry(input.rail.rail);

  if (maybeSiteEntry && maybeRailEntry) {
    return resolveComposedQrBadgeUrl([maybeSiteEntry, maybeRailEntry], {
      foregroundEntryIndex: shouldRenderPaymentSiteEntryInForeground(input.rail.rail)
        ? 0
        : undefined,
    });
  }

  if (maybeSiteEntry) {
    return resolveComposedQrBadgeUrl([maybeSiteEntry]);
  }

  if (maybeRailEntry) {
    return resolveDefaultPaymentLogoUrl({
      customLogoUrl: input.customLogoUrl,
      defaultLogoMode: input.defaultLogoMode,
      railType: input.rail.rail,
    });
  }

  return undefined;
};

const resolvePaymentQrLogoUrl = (
  input: Extract<ResolveQrLogoInput, { kind: "payment" }>,
): string | undefined => {
  const badgeMode = input.badge?.mode;

  if (badgeMode === "custom") {
    const maybeBadgeUrl = resolveComposedQrBadgeUrl(
      resolveBadgeItems(input.badge?.items, input.rail.rail),
    );

    if (maybeBadgeUrl) {
      return maybeBadgeUrl;
    }

    return resolveExplicitPaymentLogoUrl({
      customLogoUrl: input.customLogoUrl,
      logoMode: input.logoMode ?? input.defaultLogoMode,
      railType: input.rail.rail,
    });
  }

  if (badgeMode === "auto") {
    return (
      resolveAutoPaymentLogoUrl({
        customLogoUrl: input.customLogoUrl,
        defaultLogoMode: input.defaultLogoMode,
        link: input.link,
        rail: input.rail,
      }) ??
      resolveExplicitPaymentLogoUrl({
        customLogoUrl: input.customLogoUrl,
        logoMode: input.logoMode,
        railType: input.rail.rail,
      })
    );
  }

  if (badgeMode === "none") {
    return (
      resolveExplicitPaymentLogoUrl({
        customLogoUrl: input.customLogoUrl,
        logoMode: input.logoMode ?? input.defaultLogoMode,
        railType: input.rail.rail,
      }) ?? undefined
    );
  }

  const maybeExplicitLogoUrl = resolveExplicitPaymentLogoUrl({
    customLogoUrl: input.customLogoUrl,
    logoMode: input.logoMode,
    railType: input.rail.rail,
  });

  if (maybeExplicitLogoUrl !== undefined) {
    return maybeExplicitLogoUrl;
  }

  return resolveAutoPaymentLogoUrl({
    customLogoUrl: input.customLogoUrl,
    defaultLogoMode: input.defaultLogoMode,
    link: input.link,
    rail: input.rail,
  });
};

export const resolveQrLogo = (input: ResolveQrLogoInput): ResolvedQrLogo => {
  if (input.kind === "profile") {
    return {
      logoSize: clampQrLogoSize(input.logoSize),
      logoUrl: resolveProfileQrLogoUrl(input),
    };
  }

  if (input.kind === "link") {
    return {
      logoSize: clampQrLogoSize(input.logoSize),
      logoUrl: resolveLinkQrLogoUrl(input.link),
    };
  }

  return {
    logoSize: clampQrLogoSize(input.logoSize),
    logoUrl: resolvePaymentQrLogoUrl(input),
  };
};

export const resolveQrLogoWithEmbeddedAssets = async (
  input: Extract<ResolveQrLogoInput, { kind: "profile" | "link" }>,
  baseUrl?: string,
): Promise<ResolvedQrLogo> => {
  if (input.kind === "profile") {
    return {
      logoSize: clampQrLogoSize(input.logoSize),
      logoUrl: await resolveEmbeddedBadgeCompositionUrl(
        resolveProfileQrBadgeComposition(input),
        baseUrl,
      ),
    };
  }

  return {
    logoSize: clampQrLogoSize(input.logoSize),
    logoUrl: await resolveEmbeddedBadgeCompositionUrl(
      resolveLinkQrBadgeComposition(input.link),
      baseUrl,
    ),
  };
};
