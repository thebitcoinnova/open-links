import { createEffect, createSignal } from "solid-js";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import type { SiteData } from "../lib/content/load-content";
import {
  applyThemeState,
  applyTypographyState,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

export const PLAYWRIGHT_NAVIGATION_MENU_PATH = "/__playwright/navigation-menu";

const fixtureSite = {
  title: "Navigation Menu Fixtures",
  description: "Stable utility menu fixtures for Playwright coverage.",
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
  },
} as const satisfies SiteData;

const themeSelection = resolveThemeSelection(fixtureSite);
const layout = resolveLayoutPreferences(fixtureSite);
const modePolicy = resolveModePolicy(fixtureSite);
const typography = resolveTypographyPreferences({
  site: fixtureSite,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale,
});

const pageStyle = {
  "padding-top": "2.5rem",
} satisfies Record<string, string>;

const headerStyle = {
  display: "grid",
  gap: "0.6rem",
} satisfies Record<string, string>;

const eyebrowStyle = {
  margin: "0",
  color: "var(--text-muted)",
  "font-size": "var(--type-caption)",
  "letter-spacing": "0.08em",
  "text-transform": "uppercase",
} satisfies Record<string, string>;

const titleStyle = {
  margin: "0",
  "font-family": "var(--font-display)",
  "font-size": "var(--type-title)",
} satisfies Record<string, string>;

const descriptionStyle = {
  margin: "0",
  color: "var(--text-muted)",
  "max-width": "36rem",
} satisfies Record<string, string>;

const contentStyle = {
  display: "grid",
  gap: "0.9rem",
} satisfies Record<string, string>;

const panelStyle = {
  display: "grid",
  gap: "0.55rem",
  padding: "1rem",
  border: "1px solid color-mix(in srgb, var(--border-subtle) 74%, transparent 26%)",
  "border-radius": "var(--radius-md)",
  background: "color-mix(in srgb, var(--surface-panel) 86%, transparent 14%)",
} satisfies Record<string, string>;

const PlaywrightNavigationMenuRoute = () => {
  const [activeNavigationItem, setActiveNavigationItem] = createSignal<"analytics" | "home">(
    "analytics",
  );

  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: "dark",
      policy: modePolicy,
      density: layout.density,
    });
    applyTypographyState(typography);

    if (typeof document !== "undefined") {
      document.title = fixtureSite.title;
    }
  });

  return (
    <main
      aria-label="Navigation menu Playwright fixtures"
      class={`page layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
      style={pageStyle}
    >
      <section style={headerStyle}>
        <p style={eyebrowStyle}>Playwright fixture route</p>
        <h1 style={titleStyle}>Navigation menu fixtures</h1>
        <p style={descriptionStyle}>
          Stable utility menu content for mobile layout and interaction assertions.
        </p>
      </section>

      <TopUtilityBar
        title={fixtureSite.title}
        controlsLabel="Site menu and display controls"
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      >
        <UtilityControlsMenu
          activeNavigationItem={activeNavigationItem()}
          analyticsHref="#analytics"
          analyticsSupportingText="Open follower analytics and audience history."
          cardModeLabel="Rich + simple"
          homeHref="#home"
          isOffline
          label="site menu and display controls"
          mode="dark"
          modePolicyLabel="Dark mode fixed"
          onAnalyticsSelect={(event) => {
            event.preventDefault();
            setActiveNavigationItem("analytics");
          }}
          onHomeSelect={(event) => {
            event.preventDefault();
            setActiveNavigationItem("home");
          }}
          panelLabel="Site menu and display controls"
          testingGalleryHref="#testing-gallery"
          testingGalleryLabel="Payment card effects gallery"
          themeIntensity={themeSelection.activeDefinition.intensity}
          themeLabel={themeSelection.activeDefinition.label}
        />
      </TopUtilityBar>

      <section style={contentStyle}>
        <article style={panelStyle}>
          <h2 style={titleStyle}>Fixture notes</h2>
          <p style={descriptionStyle}>
            Use this route to verify that stacked menu rows stay readable on narrow screens and that
            selecting a navigation destination closes the drawer.
          </p>
        </article>
      </section>
    </main>
  );
};

export default PlaywrightNavigationMenuRoute;
