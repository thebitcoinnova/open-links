import { For, type JSX, Show, createEffect, createMemo, createSignal } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  PAYMENT_CARD_EFFECT_BOMBASTICITY_QUERY_PARAM,
  PAYMENT_CARD_EFFECT_CAPTURE_QUERY_PARAM,
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  PAYMENT_CARD_EFFECT_FIXTURE_QUERY_PARAM,
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  cloneLinkWithBombasticity,
  getPaymentCardEffectFixture,
  parsePaymentCardEffectRouteState,
  paymentCardEffectDefaultBombasticity,
  paymentCardEffectDemoSections,
  paymentCardEffectSamplesSite,
  serializePaymentCardEffectBombasticity,
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

const controlsPanelStyle = {
  display: "grid",
  gap: "0.85rem",
  padding: "1rem 1.1rem",
  border: "1px solid color-mix(in srgb, var(--border-subtle) 78%, transparent 22%)",
  "border-radius": "var(--radius-md)",
  background: "color-mix(in srgb, var(--surface-panel) 94%, var(--surface-bg) 6%)",
} satisfies JSX.CSSProperties;

const sliderRowStyle = {
  display: "grid",
  gap: "0.55rem",
} satisfies JSX.CSSProperties;

const sliderLabelStyle = {
  display: "flex",
  "justify-content": "space-between",
  gap: "1rem",
  "align-items": "center",
  "font-size": "var(--type-caption)",
} satisfies JSX.CSSProperties;

const sliderStyle = {
  width: "100%",
  "accent-color": "var(--accent-strong)",
} satisfies JSX.CSSProperties;

const controlHintStyle = {
  margin: "0",
  color: "var(--text-muted)",
  "font-size": "var(--type-caption)",
} satisfies JSX.CSSProperties;

const cardsGridStyle = (layoutMode: "grid" | "stack"): JSX.CSSProperties => ({
  display: "grid",
  gap: "1rem",
  "grid-template-columns":
    layoutMode === "grid" ? "repeat(auto-fit, minmax(18rem, 1fr))" : "minmax(0, 1fr)",
  "align-items": "start",
});

const PaymentCardEffectSamplesRoute = () => {
  const initialRouteState =
    typeof window === "undefined"
      ? {
          capture: false,
          bombasticity: paymentCardEffectDefaultBombasticity,
        }
      : parsePaymentCardEffectRouteState(new URLSearchParams(window.location.search));
  const [bombasticity, setBombasticity] = createSignal(initialRouteState.bombasticity);
  const routeState = createMemo(() =>
    typeof window === "undefined"
      ? initialRouteState
      : parsePaymentCardEffectRouteState(new URLSearchParams(window.location.search)),
  );
  const selectedFixture = createMemo(() => getPaymentCardEffectFixture(routeState().fixtureId));
  const isCaptureMode = createMemo(() => routeState().capture);
  const displayedSections = createMemo(() => {
    const fixture = selectedFixture();

    if (!fixture) {
      return paymentCardEffectDemoSections.map((section) => ({
        ...section,
        cards: section.cards.map((card) => ({
          ...card,
          link: cloneLinkWithBombasticity(card.link, bombasticity()),
        })),
      }));
    }

    return [
      {
        id: "capture-fixture",
        title: fixture.title,
        description: fixture.description,
        layout: "stack" as const,
        cards: [
          {
            ...fixture,
            link: cloneLinkWithBombasticity(fixture.link, bombasticity()),
          },
        ],
      },
    ];
  });

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

  createEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(
      PAYMENT_CARD_EFFECT_BOMBASTICITY_QUERY_PARAM,
      serializePaymentCardEffectBombasticity(bombasticity()),
    );

    if (isCaptureMode()) {
      nextUrl.searchParams.set(PAYMENT_CARD_EFFECT_CAPTURE_QUERY_PARAM, "1");
    }

    const fixtureId = routeState().fixtureId;

    if (fixtureId) {
      nextUrl.searchParams.set(PAYMENT_CARD_EFFECT_FIXTURE_QUERY_PARAM, fixtureId);
    }

    window.history.replaceState({}, "", nextUrl);
  });

  return (
    <main
      aria-label="Payment card effect samples"
      class={`page layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={pageStyle}
    >
      <section style={headerStyle}>
        <p style={eyebrowStyle}>{isCaptureMode() ? "Capture route" : "Easter egg route"}</p>
        <h1 style={titleStyle}>Tip card sparks</h1>
        <p style={descriptionStyle}>
          If you found this page, you found the hidden payment-card playground. It showcases the
          current particle treatments plus a few practical example tip cards, and now lets you scrub
          their bombasticity in one place.
        </p>
      </section>

      <Show when={!isCaptureMode()}>
        <section style={controlsPanelStyle}>
          <div style={sliderRowStyle}>
            <label for="payment-card-bombasticity-slider" style={sliderLabelStyle}>
              <strong>Bombasticity</strong>
              <span>{serializePaymentCardEffectBombasticity(bombasticity())}</span>
            </label>
            <input
              id="payment-card-bombasticity-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={serializePaymentCardEffectBombasticity(bombasticity())}
              style={sliderStyle}
              onInput={(event) => {
                setBombasticity(Number(event.currentTarget.value));
              }}
            />
            <p style={controlHintStyle}>
              One slider now drives every sample card effect on this page. Try 0 for totally calm
              and 1 for maximum chaos.
            </p>
          </div>
        </section>

        <section style={notePanelStyle}>
          <strong>What to try</strong>
          <ul style={noteListStyle}>
            <li>Scrub bombasticity from 0.00 to 1.00 and compare all cards at once.</li>
            <li>Compare the isolated effects in the showcase section.</li>
            <li>Open the multi-rail support card and toggle QR states.</li>
            <li>Use the hidden deployed path ending in {PAYMENT_CARD_EFFECT_EASTER_EGG_PATH}.</li>
            <li>
              The screenshot and video generators still render the internal sample path for stable
              captures.
            </li>
          </ul>
        </section>
      </Show>

      <For each={displayedSections()}>
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
