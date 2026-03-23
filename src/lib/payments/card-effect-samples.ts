import type { OpenLink, SiteData } from "../content/load-content";
import type { PaymentCardEffectsConfig } from "./types";

export const PAYMENT_CARD_EFFECT_SAMPLES_PATH = "/__samples/payment-card-effects";

export interface PaymentCardEffectSampleFixture {
  id: string;
  title: string;
  description: string;
  outputFileName: string;
  link: OpenLink;
}

const buildBitcoinEffectLink = ({
  id,
  label,
  description,
  effects,
}: {
  id: string;
  label: string;
  description: string;
  effects: PaymentCardEffectsConfig;
}): OpenLink => ({
  id,
  label,
  description,
  type: "payment",
  payment: {
    qrDisplay: "hidden",
    primaryRailId: "bitcoin",
    effects,
    rails: [
      {
        id: "bitcoin",
        rail: "bitcoin",
        address: "bc1qopenlinkspaymentcardeffectsample0000000000000",
        amount: "0.00021",
        message: "Thanks for supporting OpenLinks",
      },
    ],
  },
});

const buildLightningEffectLink = ({
  id,
  label,
  description,
  effects,
}: {
  id: string;
  label: string;
  description: string;
  effects: PaymentCardEffectsConfig;
}): OpenLink => ({
  id,
  label,
  description,
  type: "payment",
  payment: {
    qrDisplay: "hidden",
    primaryRailId: "lightning",
    effects,
    rails: [
      {
        id: "lightning",
        rail: "lightning",
        address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
        message: "Lightning support",
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
