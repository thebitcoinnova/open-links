import { For, type JSX, createEffect } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  paymentCardEffectDemoSections,
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

const notePanelStyle = {
  display: "grid",
  gap: "0.45rem",
  padding: "1rem 1.1rem",
  border: "1px solid color-mix(in srgb, var(--border-subtle) 78%, transparent 22%)",
  "border-radius": "var(--radius-md)",
  background: "color-mix(in srgb, var(--surface-panel) 92%, var(--surface-bg) 8%)",
} satisfies JSX.CSSProperties;

const noteListStyle = {
  margin: "0",
  padding: "0 0 0 1.1rem",
  color: "var(--text-muted)",
  display: "grid",
  gap: "0.25rem",
} satisfies JSX.CSSProperties;

const cardsGridStyle = (layoutMode: "grid" | "stack"): JSX.CSSProperties => ({
  display: "grid",
  gap: "1rem",
  "grid-template-columns":
    layoutMode === "grid" ? "repeat(auto-fit, minmax(18rem, 1fr))" : "minmax(0, 1fr)",
  "align-items": "start",
});

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
        <p style={eyebrowStyle}>Easter egg route</p>
        <h1 style={titleStyle}>Tip card sparks</h1>
        <p style={descriptionStyle}>
          If you found this page, you found the hidden payment-card playground. It showcases the
          current particle treatments plus a few practical example tip cards.
        </p>
      </section>

      <section style={notePanelStyle}>
        <strong>What to try</strong>
        <ul style={noteListStyle}>
          <li>Compare the isolated effects in the showcase section.</li>
          <li>Open the multi-rail support card and toggle QR states.</li>
          <li>Use the hidden deployed path ending in {PAYMENT_CARD_EFFECT_EASTER_EGG_PATH}.</li>
          <li>
            The screenshot generator still renders the internal sample path for stable captures.
          </li>
        </ul>
      </section>

      <For each={paymentCardEffectDemoSections}>
        {(section) => (
          <section data-payment-card-effect-section={section.id} style={fixtureSectionStyle}>
            <div style={headerStyle}>
              <h2 style={fixtureTitleStyle}>{section.title}</h2>
              <p style={descriptionStyle}>{section.description}</p>
            </div>

            <div style={cardsGridStyle(section.layout ?? "stack")}>
              <For each={section.cards}>
                {(fixture) => (
                  <section data-payment-card-effect-sample={fixture.id} style={fixtureSectionStyle}>
                    <div style={headerStyle}>
                      <h3 style={fixtureTitleStyle}>{fixture.title}</h3>
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
            </div>
          </section>
        )}
      </For>
    </main>
  );
};

export default PaymentCardEffectSamplesRoute;
