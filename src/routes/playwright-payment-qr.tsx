import { For, type JSX, createEffect } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import type { OpenLink, SiteData } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  applyThemeState,
  applyTypographyState,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

export const PLAYWRIGHT_PAYMENT_QR_PATH = "/__playwright/payment-qr";

const fixtureSite = {
  title: "Payment QR Fixtures",
  description: "Stable payment QR fixtures for Playwright coverage.",
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
        displayDefault: "toggle",
        styleDefault: "rounded",
        logoModeDefault: "none",
        fullscreenDefault: "enabled",
      },
    },
  },
} as const satisfies SiteData;

interface FixtureCard {
  id: string;
  title: string;
  description: string;
  link: OpenLink;
}

const fixtureCards: FixtureCard[] = [
  {
    id: "single-inline",
    title: "Single rail inline QR",
    description: "Always-visible Bitcoin QR with a fullscreen action for modal coverage.",
    link: {
      id: "bitcoin-tip-jar",
      label: "Bitcoin Tips",
      url: "bitcoin:bc1qopenlinksfixturetipjar0000000000000000000000000",
      description: "Direct support with an always-visible on-chain QR code.",
      type: "payment",
      payment: {
        qrDisplay: "always",
        primaryRailId: "btc",
        rails: [
          {
            id: "btc",
            rail: "bitcoin",
            label: "Bitcoin Tip Jar",
            address: "bc1qopenlinksfixturetipjar0000000000000000000000000",
            amount: "0.00042",
            message: "Thanks for supporting OpenLinks",
            qr: {
              style: "dots",
              logoMode: "none",
              foregroundColor: "#f8fafc",
              backgroundColor: "#0f172a",
            },
          },
        ],
      },
    },
  },
  {
    id: "single-toggle",
    title: "Single rail toggle QR",
    description: "Cash App QR starts hidden so Playwright can verify the show and hide flow.",
    link: {
      id: "cashapp-support",
      label: "Cash App Support",
      url: "https://cash.app/$openlinks",
      description: "Tap the QR control to reveal a web payment QR code.",
      type: "payment",
      payment: {
        qrDisplay: "toggle",
        primaryRailId: "cashapp",
        rails: [
          {
            id: "cashapp",
            rail: "cashapp",
            label: "Cash App Support",
            url: "https://cash.app/$openlinks",
            qr: {
              style: "rounded",
              logoMode: "none",
              foregroundColor: "#047857",
              backgroundColor: "#ecfdf5",
            },
          },
        ],
      },
    },
  },
  {
    id: "multi-rail",
    title: "Multi-rail QR expansion",
    description: "A mixed lightning and Cash App card for rail-specific expansion coverage.",
    link: {
      id: "open-source-funding",
      label: "Open Source Funding",
      url: "lightning:lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
      description: "Choose the rail that best fits your preferred payment flow.",
      type: "payment",
      payment: {
        qrDisplay: "toggle",
        primaryRailId: "lightning",
        effects: {
          enabled: true,
        },
        rails: [
          {
            id: "lightning",
            rail: "lightning",
            label: "Lightning Support",
            address: "lnurl1dp68gurn8ghj7mrww4exctnv9e3k7mf0d3sk6tm4wdhk6arfdenx2cm0d5hk6",
            message: "Lightning support",
            qr: {
              style: "square",
              logoMode: "none",
              foregroundColor: "#f59e0b",
              backgroundColor: "#111827",
            },
          },
          {
            id: "cashapp",
            rail: "cashapp",
            label: "Project Cash App",
            url: "https://cash.app/$openlinksproject",
            qr: {
              style: "rounded",
              logoMode: "none",
              foregroundColor: "#10b981",
              backgroundColor: "#f0fdf4",
            },
          },
        ],
      },
    },
  },
  {
    id: "composite-auto-badge",
    title: "Composite auto badge",
    description:
      "A Club Orange + Lightning payment QR badge composed from one site icon and one rail symbol.",
    link: {
      id: "cluborange-lightning-tips",
      label: "Club Orange Tips",
      description: "The QR should render a composed Club Orange and Lightning center badge.",
      icon: "cluborange",
      type: "payment",
      payment: {
        qrDisplay: "always",
        primaryRailId: "lightning",
        rails: [
          {
            id: "lightning",
            rail: "lightning",
            label: "Club Orange Lightning",
            address: "peterryszkiewicz@cluborange.org",
            qr: {
              style: "dots",
              logoMode: "none",
              foregroundColor: "#f59e0b",
              backgroundColor: "#111827",
              badge: {
                mode: "auto",
              },
            },
          },
        ],
      },
    },
  },
];

const themeSelection = resolveThemeSelection(fixtureSite);
const layout = resolveLayoutPreferences(fixtureSite);
const brandIconOptions = resolveBrandIconOptions(fixtureSite);
const modePolicy = resolveModePolicy(fixtureSite);
const typography = resolveTypographyPreferences({
  site: fixtureSite,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale,
});
const themeFingerprint = `${themeSelection.active}:dark`;

const pageStyle = {
  "padding-top": "2.5rem",
} satisfies JSX.CSSProperties;

const headerStyle = {
  display: "grid",
  gap: "0.6rem",
} satisfies JSX.CSSProperties;

const eyebrowStyle = {
  margin: "0",
  color: "var(--text-muted)",
  "font-size": "var(--type-caption)",
  "letter-spacing": "0.08em",
  "text-transform": "uppercase",
} satisfies JSX.CSSProperties;

const titleStyle = {
  margin: "0",
  "font-family": "var(--font-display)",
  "font-size": "var(--type-title)",
} satisfies JSX.CSSProperties;

const descriptionStyle = {
  margin: "0",
  color: "var(--text-muted)",
  "max-width": "42rem",
} satisfies JSX.CSSProperties;

const fixtureSectionStyle = {
  display: "grid",
  gap: "0.85rem",
} satisfies JSX.CSSProperties;

const fixtureTitleStyle = {
  margin: "0",
  "font-family": "var(--font-display)",
  "font-size": "var(--type-headline)",
} satisfies JSX.CSSProperties;

const PlaywrightPaymentQrRoute = () => {
  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: "dark",
      policy: modePolicy,
      density: layout.density,
      brandIconSizeMode: brandIconOptions.sizeMode,
    });
    applyTypographyState(typography);

    if (typeof document !== "undefined") {
      document.title = fixtureSite.title;
    }
  });

  return (
    <main
      aria-label="Payment QR Playwright fixtures"
      class={`page layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={pageStyle}
    >
      <section style={headerStyle}>
        <p style={eyebrowStyle}>Playwright fixture route</p>
        <h1 style={titleStyle}>Payment QR fixtures</h1>
        <p style={descriptionStyle}>
          Stable payment QR cards for browser assertions and committed screenshot baselines.
        </p>
      </section>

      <For each={fixtureCards}>
        {(fixture) => (
          <section data-payment-qr-fixture={fixture.id} style={fixtureSectionStyle}>
            <div style={headerStyle}>
              <h2 style={fixtureTitleStyle}>{fixture.title}</h2>
              <p style={descriptionStyle}>{fixture.description}</p>
            </div>

            <PaymentLinkCard
              link={fixture.link}
              site={fixtureSite}
              interaction="minimal"
              brandIconOptions={brandIconOptions}
              themeFingerprint={themeFingerprint}
            />
          </section>
        )}
      </For>
    </main>
  );
};

export default PlaywrightPaymentQrRoute;
