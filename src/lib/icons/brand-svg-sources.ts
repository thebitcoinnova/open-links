import type { PaymentRailType } from "../payments/types";
import type { KnownSiteId } from "./known-sites-data";

export type BrandSvgSurfaceTarget = "known-site" | "payment-logo";

export type BrandSvgSourceKind =
  | "simple-icons-package"
  | "official-public-svg"
  | "source-derived-extraction"
  | "repo-fallback"
  | "blocked";

export type BrandSvgSourceStatus = "active" | "deferred";

export interface BrandSvgSourceEntry {
  brandId: string;
  surfaceTargets: readonly BrandSvgSurfaceTarget[];
  sourceKind: BrandSvgSourceKind;
  sourceUrl: string;
  variant: string;
  status: BrandSvgSourceStatus;
  knownSiteId?: KnownSiteId;
  packageIconKey?: string;
  paymentRailType?: PaymentRailType;
  paymentLogoAssetPath?: string;
  repoSourceAssetPath?: string;
  normalizationNotes?: string;
}

export const BRAND_SVG_SOURCE_ENTRIES: readonly BrandSvgSourceEntry[] = [
  {
    brandId: "bitcoin",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/bitcoin.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siBitcoin",
    paymentRailType: "bitcoin",
    paymentLogoAssetPath: "/payment-logos/bitcoin.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "cashapp",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/cashapp.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siCashapp",
    paymentRailType: "cashapp",
    paymentLogoAssetPath: "/payment-logos/cashapp.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "coinbase",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/coinbase.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siCoinbase",
    paymentRailType: "coinbase",
    paymentLogoAssetPath: "/payment-logos/coinbase.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "ethereum",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/ethereum.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siEthereum",
    paymentRailType: "ethereum",
    paymentLogoAssetPath: "/payment-logos/ethereum.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "kofi",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/kofi.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siKofi",
    paymentRailType: "kofi",
    paymentLogoAssetPath: "/payment-logos/kofi.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "lightning",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/lightning.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siLightning",
    paymentRailType: "lightning",
    paymentLogoAssetPath: "/payment-logos/lightning.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "patreon",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/patreon.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siPatreon",
    paymentRailType: "patreon",
    paymentLogoAssetPath: "/payment-logos/patreon.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "paypal",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/paypal.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siPaypal",
    paymentRailType: "paypal",
    paymentLogoAssetPath: "/payment-logos/paypal.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "solana",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/solana.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siSolana",
    paymentRailType: "solana",
    paymentLogoAssetPath: "/payment-logos/solana.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "stripe",
    surfaceTargets: ["payment-logo"],
    sourceKind: "simple-icons-package",
    sourceUrl: "https://simpleicons.org/icons/stripe.svg",
    variant: "glyph centered inside a circular QR/payment badge",
    status: "active",
    packageIconKey: "siStripe",
    paymentRailType: "stripe",
    paymentLogoAssetPath: "/payment-logos/stripe.svg",
    normalizationNotes:
      "The payment-logo asset is generated from the Simple Icons glyph and brand color into a square centered badge.",
  },
  {
    brandId: "custom-crypto",
    surfaceTargets: ["payment-logo"],
    sourceKind: "repo-fallback",
    sourceUrl: "public/payment-logos/generic-crypto.svg",
    variant: "OpenLinks-owned generic crypto fallback badge",
    status: "active",
    paymentRailType: "custom-crypto",
    paymentLogoAssetPath: "/payment-logos/generic-crypto.svg",
    repoSourceAssetPath: "public/payment-logos/generic-crypto.svg",
    normalizationNotes:
      "This is a non-brand fallback and intentionally remains repo-owned until a better shared fallback system exists.",
  },
  {
    brandId: "cluborange",
    surfaceTargets: ["known-site"],
    sourceKind: "official-public-svg",
    sourceUrl:
      "https://cdn.prod.website-files.com/690198076f4e61512a19a9a3/690198076f4e61512a19ab40_BrandIcon_OrangePillApp.svg",
    variant: "official Orange Pill App brand icon SVG",
    status: "active",
    knownSiteId: "cluborange",
    normalizationNotes:
      "The runtime geometry is normalized from the official brand icon asset so the icon and QR flows share one source.",
  },
  {
    brandId: "primal",
    surfaceTargets: ["known-site"],
    sourceKind: "official-public-svg",
    sourceUrl: "https://primal.net/assets/safari-pinned-tab-02640d32.svg",
    variant: "public pinned-tab SVG mark",
    status: "active",
    knownSiteId: "primal",
    normalizationNotes:
      "The runtime geometry is normalized from the public Primal SVG asset rather than a hand-drawn repo approximation.",
  },
  {
    brandId: "lemonade",
    surfaceTargets: ["known-site"],
    sourceKind: "source-derived-extraction",
    sourceUrl: "https://www.lemonade.com/",
    variant: "icon-side crop from the inline homepage wordmark",
    status: "active",
    knownSiteId: "lemonade",
    normalizationNotes:
      "The public logo SVG reference is gated, so the repo keeps normalized geometry extracted from the homepage's inline wordmark.",
  },
  {
    brandId: "strike",
    surfaceTargets: ["known-site", "payment-logo"],
    sourceKind: "source-derived-extraction",
    sourceUrl: "https://strike.me/",
    variant: "source-derived logomark retained in normalized geometry form",
    status: "active",
    knownSiteId: "strike",
    paymentLogoAssetPath: "/payment-logos/strike.svg",
    normalizationNotes:
      "Direct public asset fetches are blocked, so the repo keeps the current normalized mark as the shared source for icon and payment-badge surfaces.",
  },
  {
    brandId: "linkedin",
    surfaceTargets: ["known-site"],
    sourceKind: "blocked",
    sourceUrl:
      "https://content.linkedin.com/content/dam/me/business/en-us/amp/xbu/linkedin-revised-brand-guidelines/logos/in-logo.zip",
    variant: "LinkedIn InBug brand bundle",
    status: "deferred",
    normalizationNotes:
      "The public brand bundle exposed only PNG assets in this pass, so the known-site SVG migration remains deferred.",
  },
  {
    brandId: "twitter",
    surfaceTargets: ["known-site"],
    sourceKind: "blocked",
    sourceUrl: "https://about.x.com/en/who-we-are/brand-toolkit",
    variant: "legacy Twitter bird mark",
    status: "deferred",
    normalizationNotes:
      "The public X brand toolkit exposes X assets, not the legacy Twitter bird, so the legacy known-site icon remains deferred.",
  },
  {
    brandId: "skype",
    surfaceTargets: ["known-site"],
    sourceKind: "blocked",
    sourceUrl: "https://www.skype.com/en/legal/brand-guidelines/",
    variant: "Skype brand-guidelines asset bundle",
    status: "deferred",
    normalizationNotes:
      "The public brand-guidelines page exposed a PDF but no friendly SVG mark in this pass, so the known-site SVG migration remains deferred.",
  },
];

export const PAYMENT_LOGO_SOURCE_ENTRIES = BRAND_SVG_SOURCE_ENTRIES.filter((entry) =>
  entry.surfaceTargets.includes("payment-logo"),
);

export const ACTIVE_PAYMENT_LOGO_SOURCE_ENTRIES = PAYMENT_LOGO_SOURCE_ENTRIES.filter(
  (entry) => entry.status === "active",
);

export const DEFERRED_BRAND_SVG_SOURCE_ENTRIES = BRAND_SVG_SOURCE_ENTRIES.filter(
  (entry) => entry.status === "deferred",
);

export const findBrandSvgSourceEntry = (brandId: string): BrandSvgSourceEntry | undefined =>
  BRAND_SVG_SOURCE_ENTRIES.find((entry) => entry.brandId === brandId);
