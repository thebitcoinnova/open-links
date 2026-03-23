import { For, type JSX, createEffect } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  paymentCardEffectSampleFixtures,
  paymentCardEffectSamplesSite,
} from "../lib/payments/card-effect-samples";
import {
  applyThemeState,
  applyTypographyState,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

export { PAYMENT_CARD_EFFECT_SAMPLES_PATH };

const themeSelection = resolveThemeSelection(paymentCardEffectSamplesSite);
const layout = resolveLayoutPreferences(paymentCardEffectSamplesSite);
const brandIconOptions = resolveBrandIconOptions(paymentCardEffectSamplesSite);
const modePolicy = resolveModePolicy(paymentCardEffectSamplesSite);
const typography = resolveTypographyPreferences({
  site: paymentCardEffectSamplesSite,
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
  "max-width": "44rem",
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

const fixtureFrameStyle = {
  width: "min(100%, 34rem)",
} satisfies JSX.CSSProperties;

const PaymentCardEffectSamplesRoute = () => {
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
      document.title = paymentCardEffectSamplesSite.title;
    }
  });

  return (
    <main
      aria-label="Payment card effect samples"
      class={`page layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={pageStyle}
    >
      <section style={headerStyle}>
        <p style={eyebrowStyle}>Internal sample gallery</p>
        <h1 style={titleStyle}>Payment card effect samples</h1>
        <p style={descriptionStyle}>
          Stable effect cards used to generate committed sample screenshots for payment-card visual
          effects.
        </p>
      </section>

      <For each={paymentCardEffectSampleFixtures}>
        {(fixture) => (
          <section data-payment-card-effect-sample={fixture.id} style={fixtureSectionStyle}>
            <div style={headerStyle}>
              <h2 style={fixtureTitleStyle}>{fixture.title}</h2>
              <p style={descriptionStyle}>{fixture.description}</p>
            </div>

            <div style={fixtureFrameStyle}>
              <PaymentLinkCard
                link={fixture.link}
                site={paymentCardEffectSamplesSite}
                interaction="minimal"
                brandIconOptions={brandIconOptions}
                themeFingerprint={themeFingerprint}
              />
            </div>
          </section>
        )}
      </For>
    </main>
  );
};

export default PaymentCardEffectSamplesRoute;
