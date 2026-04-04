import { type JSX, createEffect } from "solid-js";
import { RichLinkCard } from "../components/cards/RichLinkCard";
import type { OpenLink, SiteData } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  applyThemeState,
  applyTypographyState,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { buildRichCardViewModel } from "../lib/ui/rich-card-policy";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

export const PLAYWRIGHT_REFERRAL_CARD_PATH = "/__playwright/referral-card";

const fixtureSite = {
  title: "Referral Card Fixtures",
  description: "Stable referral-card fixtures for Playwright coverage.",
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
    richCards: {
      renderMode: "auto",
      sourceLabelDefault: "show",
      imageTreatment: "off",
      imageFit: "contain",
      mobile: {
        imageLayout: "inline",
      },
    },
  },
} as const satisfies SiteData;

const fixtureLink = {
  id: "cluborange-referral",
  label: "Join Club Orange",
  url: "https://signup.cluborange.org/co/pryszkie",
  type: "rich",
  icon: "cluborange",
  description: "Club Orange signup and referral landing page",
  metadata: {
    title: "Join Club Orange",
    description: "Club Orange signup and referral landing page",
    sourceLabel: "cluborange.org",
  },
  enrichment: {
    profileSemantics: "non_profile",
  },
  referral: {
    kind: "referral",
    visitorBenefit: "Join Club Orange starting at $40/year",
    ownerBenefit: "Supports the project",
    offerSummary: "Get Club Orange access and connect with Bitcoin builders.",
    termsSummary:
      "Available to new members only. Pricing varies by plan and region. Additional terms may apply at signup.",
    termsUrl: "https://www.cluborange.org/signup?referral=pryszkie",
  },
} as const satisfies OpenLink;

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

const PlaywrightReferralCardRoute = () => {
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
      aria-label="Referral card Playwright fixtures"
      class={`page layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={pageStyle}
    >
      <section style={headerStyle}>
        <p style={eyebrowStyle}>Playwright fixture route</p>
        <h1 style={titleStyle}>Referral card fixtures</h1>
        <p style={descriptionStyle}>
          Stable referral-card fixtures for browser assertions and committed screenshot baselines.
        </p>
      </section>

      <section data-referral-card-fixture="cluborange-rich" style={fixtureSectionStyle}>
        <div style={headerStyle}>
          <h2 style={fixtureTitleStyle}>Club Orange referral card</h2>
          <p style={descriptionStyle}>
            Rich referral-card fixture covering the inline terms summary and the separate desktop
            terms rail.
          </p>
        </div>

        <RichLinkCard
          link={fixtureLink}
          viewModel={buildRichCardViewModel(fixtureSite, fixtureLink)}
          interaction="minimal"
          brandIconOptions={brandIconOptions}
          themeFingerprint={themeFingerprint}
        />
      </section>
    </main>
  );
};

export default PlaywrightReferralCardRoute;
