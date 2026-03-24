import { For, type JSX, Show, createEffect, createMemo, createSignal } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import {
  PAYMENT_CARD_EFFECT_DEBUG_PHASES,
  PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS,
  formatPaymentCardEffectDebugMetricValue,
  getPaymentCardEffectDebugTuningValue,
  isDefaultPaymentCardEffectDebugTuning,
  isDefaultPaymentCardEffectDebugTuningGroup,
  resetPaymentCardEffectDebugTuningGroup,
  resolvePaymentCardEffectDebugQueryParam,
  setPaymentCardEffectDebugTuningValue,
} from "../lib/payments/card-effect-debug-tuning";
import {
  PAYMENT_CARD_EFFECT_EASTER_EGG_PATH,
  PAYMENT_CARD_EFFECT_SAMPLES_PATH,
  applyPaymentCardEffectRouteStateSearchParams,
  cloneLinkWithBombasticity,
  getPaymentCardEffectFixture,
  parsePaymentCardEffectRouteState,
  paymentCardEffectDefaultBombasticity,
  paymentCardEffectDefaultDebugTuning,
  paymentCardEffectDemoSections,
  paymentCardEffectSamplesSite,
  resolvePaymentCardEffectPreviewBombasticity,
  resolvePaymentCardEffectPreviewPhase,
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

const controlsHeaderStyle = {
  display: "flex",
  "justify-content": "space-between",
  gap: "1rem",
  "align-items": "center",
  "flex-wrap": "wrap",
} satisfies JSX.CSSProperties;

const controlsHeaderCopyStyle = {
  display: "grid",
  gap: "0.3rem",
} satisfies JSX.CSSProperties;

const controlGroupsGridStyle = {
  display: "grid",
  gap: "0.95rem",
} satisfies JSX.CSSProperties;

const controlGroupStyle = {
  display: "grid",
  gap: "0.8rem",
  padding: "0.95rem 1rem",
  border: "1px solid color-mix(in srgb, var(--border-subtle) 76%, transparent 24%)",
  "border-radius": "var(--radius-md)",
  background: "color-mix(in srgb, var(--surface-panel) 90%, var(--surface-bg) 10%)",
} satisfies JSX.CSSProperties;

const controlGroupHeaderStyle = {
  display: "flex",
  "justify-content": "space-between",
  gap: "1rem",
  "align-items": "start",
  "flex-wrap": "wrap",
} satisfies JSX.CSSProperties;

const controlGroupCopyStyle = {
  display: "grid",
  gap: "0.25rem",
} satisfies JSX.CSSProperties;

const controlMetricsStyle = {
  display: "grid",
  gap: "0.9rem",
} satisfies JSX.CSSProperties;

const metricPanelStyle = {
  display: "grid",
  gap: "0.6rem",
  padding: "0.8rem 0.85rem",
  border: "1px solid color-mix(in srgb, var(--border-subtle) 72%, transparent 28%)",
  "border-radius": "var(--radius-sm)",
  background: "color-mix(in srgb, var(--surface-panel) 84%, var(--surface-bg) 16%)",
} satisfies JSX.CSSProperties;

const phaseGridStyle = {
  display: "grid",
  gap: "0.7rem",
  "grid-template-columns": "repeat(auto-fit, minmax(12rem, 1fr))",
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

const previewPhaseBadgeStyle = {
  display: "inline-flex",
  "align-items": "center",
  gap: "0.35rem",
  padding: "0.35rem 0.65rem",
  border: "1px solid color-mix(in srgb, var(--accent-strong) 26%, var(--border-subtle) 74%)",
  "border-radius": "999px",
  background: "color-mix(in srgb, var(--surface-panel) 88%, var(--surface-bg) 12%)",
  color: "var(--text-muted)",
  "font-size": "var(--type-caption)",
  "text-transform": "uppercase",
  "letter-spacing": "0.04em",
} satisfies JSX.CSSProperties;

const sectionResetButtonStyle = {
  appearance: "none",
  border: "1px solid color-mix(in srgb, var(--accent-strong) 28%, var(--border-subtle) 72%)",
  "border-radius": "999px",
  padding: "0.45rem 0.8rem",
  background: "color-mix(in srgb, var(--surface-panel) 85%, var(--surface-bg) 15%)",
  color: "var(--text-default)",
  "font-size": "var(--type-caption)",
  cursor: "pointer",
} satisfies JSX.CSSProperties;

const cardsGridStyle = (layoutMode: "grid" | "stack"): JSX.CSSProperties => ({
  display: "grid",
  gap: "1rem",
  "grid-template-columns":
    layoutMode === "grid" ? "repeat(auto-fit, minmax(18rem, 1fr))" : "minmax(0, 1fr)",
  "align-items": "start",
});

const formatPreviewBombasticity = (bombasticity: number): string => bombasticity.toFixed(2);

const PaymentCardEffectSamplesRoute = () => {
  const initialRouteState =
    typeof window === "undefined"
      ? {
          capture: false,
          bombasticity: paymentCardEffectDefaultBombasticity,
          debugTuning: paymentCardEffectDefaultDebugTuning,
        }
      : parsePaymentCardEffectRouteState(new URLSearchParams(window.location.search));
  const [previewBombasticity, setPreviewBombasticity] = createSignal(
    initialRouteState.bombasticity,
  );
  const [debugTuning, setDebugTuning] = createSignal(initialRouteState.debugTuning);
  const previewPhase = createMemo(() =>
    resolvePaymentCardEffectPreviewPhase(previewBombasticity()),
  );
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
          link: cloneLinkWithBombasticity(card.link, previewBombasticity()),
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
            link: cloneLinkWithBombasticity(fixture.link, previewBombasticity()),
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
    applyPaymentCardEffectRouteStateSearchParams({
      searchParams: nextUrl.searchParams,
      routeState: {
        capture: isCaptureMode(),
        fixtureId: routeState().fixtureId,
        bombasticity: previewBombasticity(),
        debugTuning: debugTuning(),
      },
    });

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
          current particle treatments plus a few practical example tip cards, and now lets you tune
          the low, mid, and max curves for each effect family in one place.
        </p>
      </section>

      <Show when={!isCaptureMode()}>
        <section style={controlsPanelStyle}>
          <div style={controlsHeaderStyle}>
            <div style={controlsHeaderCopyStyle}>
              <strong>Debug tuning controls</strong>
              <p style={controlHintStyle}>
                These sliders override the internal low, mid, and max curves without changing the
                public payment schema. As you drag a slider, the card preview jumps to that phase so
                the effect change is visible immediately, and non-default values still persist in
                the URL.
              </p>
            </div>

            <div style={controlsHeaderStyle}>
              <span
                data-payment-card-effect-preview-phase={previewPhase()}
                style={previewPhaseBadgeStyle}
              >
                <span>Previewing</span>
                <strong>{previewPhase()}</strong>
                <span>{formatPreviewBombasticity(previewBombasticity())}</span>
              </span>
              <button
                type="button"
                style={sectionResetButtonStyle}
                disabled={isDefaultPaymentCardEffectDebugTuning(debugTuning())}
                onClick={() => {
                  setDebugTuning(paymentCardEffectDefaultDebugTuning);
                  setPreviewBombasticity(paymentCardEffectDefaultBombasticity);
                }}
              >
                Reset all
              </button>
            </div>
          </div>

          <div style={controlGroupsGridStyle}>
            <For each={PAYMENT_CARD_EFFECT_DEBUG_TUNING_GROUPS}>
              {(group) => (
                <section
                  data-payment-card-effect-control-group={group.id}
                  style={controlGroupStyle}
                >
                  <div style={controlGroupHeaderStyle}>
                    <div style={controlGroupCopyStyle}>
                      <strong>{group.label}</strong>
                      <p style={controlHintStyle}>{group.description}</p>
                    </div>

                    <button
                      type="button"
                      style={sectionResetButtonStyle}
                      disabled={isDefaultPaymentCardEffectDebugTuningGroup({
                        tuning: debugTuning(),
                        groupId: group.id,
                      })}
                      onClick={() => {
                        setDebugTuning((currentTuning) =>
                          resetPaymentCardEffectDebugTuningGroup({
                            tuning: currentTuning,
                            groupId: group.id,
                          }),
                        );
                        setPreviewBombasticity(paymentCardEffectDefaultBombasticity);
                      }}
                    >
                      {`Reset ${group.label.toLowerCase()}`}
                    </button>
                  </div>

                  <div style={controlMetricsStyle}>
                    <For each={group.metrics}>
                      {(metric) => (
                        <section style={metricPanelStyle}>
                          <strong>{metric.label}</strong>
                          <div style={phaseGridStyle}>
                            <For each={PAYMENT_CARD_EFFECT_DEBUG_PHASES}>
                              {(phase) => {
                                const inputId = resolvePaymentCardEffectDebugQueryParam({
                                  groupId: group.id,
                                  metricId: metric.metricId,
                                  phase: phase.id,
                                });
                                const value = () =>
                                  getPaymentCardEffectDebugTuningValue({
                                    tuning: debugTuning(),
                                    groupId: group.id,
                                    metricId: metric.metricId,
                                    phase: phase.id,
                                  });

                                return (
                                  <div style={sliderRowStyle}>
                                    <label for={inputId} style={sliderLabelStyle}>
                                      <span>{phase.label}</span>
                                      <span>
                                        {formatPaymentCardEffectDebugMetricValue({
                                          metric,
                                          value: value(),
                                        })}
                                      </span>
                                    </label>
                                    <input
                                      id={inputId}
                                      type="range"
                                      min={String(metric.min)}
                                      max={String(metric.max)}
                                      step={String(metric.step)}
                                      value={formatPaymentCardEffectDebugMetricValue({
                                        metric,
                                        value: value(),
                                      })}
                                      style={sliderStyle}
                                      onInput={(event) => {
                                        setPreviewBombasticity(
                                          resolvePaymentCardEffectPreviewBombasticity(phase.id),
                                        );
                                        setDebugTuning((currentTuning) =>
                                          setPaymentCardEffectDebugTuningValue({
                                            tuning: currentTuning,
                                            groupId: group.id,
                                            metricId: metric.metricId,
                                            phase: phase.id,
                                            value: Number(event.currentTarget.value),
                                          }),
                                        );
                                      }}
                                    />
                                  </div>
                                );
                              }}
                            </For>
                          </div>
                        </section>
                      )}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>
        </section>

        <section style={notePanelStyle}>
          <strong>What to try</strong>
          <ul style={noteListStyle}>
            <li>Ambient, lightning, glitter, and wash now tune independently on this page.</li>
            <li>URL params only keep the non-default advanced overrides for easier sharing.</li>
            <li>
              The live card preview follows the low, mid, or max phase for the slider you most
              recently changed.
            </li>
            <li>Compare the isolated effects in the showcase section after changing one group.</li>
            <li>Open the multi-rail support card and toggle QR states.</li>
            <li>Use the hidden deployed path ending in {PAYMENT_CARD_EFFECT_EASTER_EGG_PATH}.</li>
            <li>
              Capture scripts still render the internal sample path and default tuning for stable
              screenshots and videos.
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
                        effectDebugTuning={debugTuning()}
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
