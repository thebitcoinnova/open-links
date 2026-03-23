import type { OpenLink, SiteData } from "../content/load-content";
import type { PaymentCardEffectsConfig, PaymentQrConfig } from "./types";

export const PAYMENT_CARD_EFFECT_SAMPLES_PATH = "/__samples/payment-card-effects";
export const PAYMENT_CARD_EFFECT_EASTER_EGG_PATH = "/spark/tip-cards";
export const PAYMENT_CARD_EFFECT_ROUTE_PATHS = [
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
] as const;

export const isPaymentCardEffectRoutePath = (pathname: string): boolean =>
  PAYMENT_CARD_EFFECT_ROUTE_PATHS.some((routePath) => pathname.endsWith(routePath));

export interface PaymentCardEffectDemoCard {
  id: string;
  title: string;
  description: string;
  link: OpenLink;
}

export interface PaymentCardEffectSampleFixture extends PaymentCardEffectDemoCard {
  outputFileName: string;
}

export interface PaymentCardEffectDemoSection {
  id: string;
  title: string;
  description: string;
  layout?: "grid" | "stack";
  cards: readonly PaymentCardEffectDemoCard[];
}

const bitcoinQr = {
  style: "dots",
  logoMode: "none",
  foregroundColor: "#f8fafc",
  backgroundColor: "#0f172a",
} as const satisfies PaymentQrConfig;

const lightningQr = {
  style: "square",
  logoMode: "none",
  foregroundColor: "#fbbf24",
  backgroundColor: "#111827",
} as const satisfies PaymentQrConfig;

const cashAppQr = {
  style: "rounded",
  logoMode: "none",
  foregroundColor: "#10b981",
  backgroundColor: "#f0fdf4",
} as const satisfies PaymentQrConfig;

const buildBitcoinEffectLink = ({
  id,
  label,
  description,
  effects,
  qrDisplay = "hidden",
}: {
  id: string;
  label: string;
  description: string;
  effects?: PaymentCardEffectsConfig;
  qrDisplay?: "always" | "hidden" | "toggle";
}): OpenLink => ({
  id,
  label,
  description,
  type: "payment",
  payment: {
    qrDisplay,
    primaryRailId: "bitcoin",
    effects,
    rails: [
      {
        id: "bitcoin",
        rail: "bitcoin",
        label: "Bitcoin Tip Jar",
        address: "bc1qopenlinkspaymentcardeffectsample0000000000000",
        amount: "0.00021",
        message: "Thanks for supporting OpenLinks",
        qr: bitcoinQr,
      },
    ],
  },
});

const buildLightningEffectLink = ({
  id,
  label,
  description,
  effects,
  qrDisplay = "hidden",
}: {
  id: string;
  label: string;
  description: string;
  effects?: PaymentCardEffectsConfig;
  qrDisplay?: "always" | "hidden" | "toggle";
}): OpenLink => ({
  id,
  label,
  description,
  type: "payment",
  payment: {
    qrDisplay,
    primaryRailId: "lightning",
    effects,
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        label: "Lightning Tip Jar",
        address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
        message: "Lightning support",
        qr: lightningQr,
      },
    ],
  },
});

const buildLightningSupportDeckLink = ({
  id,
  label,
  description,
  effects,
}: {
  id: string;
  label: string;
  description: string;
  effects?: PaymentCardEffectsConfig;
}): OpenLink => ({
  id,
  label,
  description,
  type: "payment",
  payment: {
    qrDisplay: "toggle",
    primaryRailId: "lightning",
    effects,
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        label: "Lightning Support",
        address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
        message: "Lightning support",
        qr: lightningQr,
      },
      {
        id: "cashapp",
        rail: "cashapp",
        label: "Project Cash App",
        url: "https://cash.app/$openlinksproject",
        qr: cashAppQr,
      },
    ],
  },
});

export const paymentCardEffectSamplesSite = {
  title: "Payment Card Effect Samples",
  description: "Repeatable visual samples for OpenLinks payment card effects.",
  theme: {
    active: "sleek",
    available: ["sleek"],
  },
  ui: {
    density: "medium",
    desktopColumns: "one",
    typographyScale: "fixed",
    targetSize: "comfortable",
    modePolicy: "static-dark",
    brandIcons: {
      colorMode: "brand",
      contrastMode: "auto",
      minContrastRatio: 3,
      sizeMode: "large",
    },
    payments: {
      qr: {
        displayDefault: "hidden",
        styleDefault: "rounded",
        logoModeDefault: "none",
        fullscreenDefault: "disabled",
      },
    },
  },
} as const satisfies SiteData;

export const paymentCardEffectSampleFixtures: readonly PaymentCardEffectSampleFixture[] = [
  {
    id: "particles",
    title: "Ambient particles",
    description: "Subtle floating particles over a standard tip card.",
    outputFileName: "ambient-particles",
    link: buildBitcoinEffectLink({
      id: "ambient-particles",
      label: "Ambient Tip Jar",
      description: "Subtle ambient particles for a gentle premium shimmer.",
      effects: {
        enabled: true,
        effects: ["particles"],
      },
    }),
  },
  {
    id: "lightning-particles",
    title: "Lightning particles",
    description: "Electric spark streaks for a focused Lightning card treatment.",
    outputFileName: "lightning-particles",
    link: buildLightningEffectLink({
      id: "lightning-particles",
      label: "Lightning Sparks",
      description: "Electric particle accents tuned for Lightning-first support cards.",
      effects: {
        enabled: true,
        effects: ["lightning-particles"],
      },
    }),
  },
  {
    id: "glitter-particles",
    title: "Gold glitter particles",
    description: "Warm gold glitter for a celebratory but still restrained look.",
    outputFileName: "gold-glitter-particles",
    link: buildBitcoinEffectLink({
      id: "gold-glitter-particles",
      label: "Golden Glitter Tips",
      description: "Gold glitter particles bring a soft celebratory glow to the card.",
      effects: {
        enabled: true,
        effects: ["glitter-particles"],
        glitterPalette: "gold",
      },
    }),
  },
  {
    id: "lightning-default-combo",
    title: "Lightning default combo",
    description:
      "The default Lightning-card opt-in: lightning particles plus gold glitter particles.",
    outputFileName: "lightning-default-combo",
    link: buildLightningEffectLink({
      id: "lightning-default-combo",
      label: "Lightning Default",
      description: "Lightning cards default to sparks plus gold glitter when effects are enabled.",
      effects: {
        enabled: true,
      },
    }),
  },
];

export const paymentCardEffectExampleCards: readonly PaymentCardEffectDemoCard[] = [
  {
    id: "classic-tip-jar",
    title: "Classic tip jar",
    description: "Baseline single-rail payment card with no effects and an always-visible QR.",
    link: buildBitcoinEffectLink({
      id: "classic-tip-jar",
      label: "Classic Tip Jar",
      description: "No particles, no glitter, just the clean payment card baseline.",
      qrDisplay: "always",
    }),
  },
  {
    id: "ambient-live-qr",
    title: "Ambient particles with live QR",
    description: "Soft particles layered over an always-visible QR presentation.",
    link: buildBitcoinEffectLink({
      id: "ambient-live-qr",
      label: "Ambient Support",
      description:
        "Ambient particles stay subtle while the QR remains readable and front-and-center.",
      qrDisplay: "always",
      effects: {
        enabled: true,
        effects: ["particles"],
      },
    }),
  },
  {
    id: "ice-glitter-example",
    title: "Ice glitter variation",
    description: "An alternate glitter palette for a cooler, more crystalline look.",
    link: buildBitcoinEffectLink({
      id: "ice-glitter-example",
      label: "Ice Glitter Tips",
      description: "A cooler glitter palette that still reads premium without feeling heavy.",
      qrDisplay: "always",
      effects: {
        enabled: true,
        effects: ["glitter-particles"],
        glitterPalette: "ice",
      },
    }),
  },
  {
    id: "lightning-support-deck",
    title: "Multi-rail support deck",
    description: "A practical support card with Lightning defaults and a secondary web rail.",
    link: buildLightningSupportDeckLink({
      id: "lightning-support-deck",
      label: "Support the Project",
      description: "Try the QR toggle to inspect both Lightning and Cash App paths.",
      effects: {
        enabled: true,
      },
    }),
  },
];

export const paymentCardEffectDemoSections: readonly PaymentCardEffectDemoSection[] = [
  {
    id: "effect-showcase",
    title: "Effect showcase",
    description: "Each effect isolated so you can compare the visual treatments one by one.",
    layout: "stack",
    cards: paymentCardEffectSampleFixtures,
  },
  {
    id: "example-cards",
    title: "Example tip cards",
    description:
      "A few practical card arrangements that show how the effects feel in more realistic layouts.",
    layout: "grid",
    cards: paymentCardEffectExampleCards,
  },
];
