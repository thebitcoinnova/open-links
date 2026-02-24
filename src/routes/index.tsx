import { createEffect, createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import SiteFooter from "../components/layout/SiteFooter";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import ProfileHeader from "../components/profile/ProfileHeader";
import { loadContent, resolveGeneratedContentImageUrl } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import { isPaymentCapableLink } from "../lib/payments/types";
import ThemeToggle from "../components/theme/ThemeToggle";
import {
  applyTypographyState,
  applyThemeState,
  canToggleMode,
  persistModePreference,
  resolveInitialMode,
  resolveModePolicy,
  type UiMode
} from "../lib/theme/mode-controller";
import { getThemeDefinition, resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveFooterPreferences } from "../lib/ui/footer-preferences";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";
import {
  buildRichCardViewModel,
  resolveRichCardVariant,
  resolveRichRenderMode
} from "../lib/ui/rich-card-policy";

const content = loadContent();
const composition = resolveComposition(content.site);
const layout = resolveLayoutPreferences(content.site);
const footerPreferences = resolveFooterPreferences(content.site);
const richRenderMode = resolveRichRenderMode(content.site);
const modePolicy = resolveModePolicy(content.site);
const brandIconOptions = resolveBrandIconOptions(content.site);
const themeSelection = resolveThemeSelection(content.site);
const themeDefinition = getThemeDefinition(themeSelection.active);
const typography = resolveTypographyPreferences({
  site: content.site,
  activeTheme: themeSelection.active,
  typographyScale: layout.typographyScale
});

const sections = resolveLinkSections(content.links, content.groups, composition.grouping) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";

const firstString = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const toAbsoluteUrl = (value: string, fallbackBase: string): string => {
  try {
    return new URL(value).toString();
  } catch {
    return new URL(value.startsWith("/") ? value : `/${value}`, fallbackBase).toString();
  }
};

const ensureMetaTag = (attr: "name" | "property", key: string, contentValue: string) => {
  const selector = `meta[${attr}=\"${key}\"]`;
  let meta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attr, key);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", contentValue);
};

const ensureCanonical = (href: string) => {
  let link = document.head.querySelector<HTMLLinkElement>("link[rel=\"canonical\"]");

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
};

const applySeoMetadata = () => {
  const seo = content.site.quality?.seo;
  const defaults = seo?.defaults ?? {};
  const overrides = seo?.overrides?.profile ?? {};

  const baseOrigin = firstString(seo?.canonicalBaseUrl, window.location.origin) ?? window.location.origin;

  const title =
    firstString(
      overrides.title,
      defaults.title,
      content.profile.name ? `${content.profile.name} | ${content.site.title}` : undefined,
      content.site.title
    ) ?? "OpenLinks";

  const description =
    firstString(overrides.description, defaults.description, content.profile.bio, content.site.description) ??
    "OpenLinks profile";

  const canonicalInput = firstString(overrides.canonical, defaults.canonical, content.site.baseUrl, "/") ?? "/";
  const canonical = toAbsoluteUrl(canonicalInput, baseOrigin);

  const imagePath =
    firstString(
      overrides.twitterImage,
      overrides.ogImage,
      defaults.twitterImage,
      defaults.ogImage,
      seo?.socialImageFallback,
      "/openlinks-social-fallback.svg"
    ) ?? "/openlinks-social-fallback.svg";
  const resolvedImagePath =
    resolveGeneratedContentImageUrl(imagePath) ??
    resolveGeneratedContentImageUrl("/openlinks-social-fallback.svg") ??
    "/openlinks-social-fallback.svg";

  const ogTitle = firstString(overrides.ogTitle, defaults.ogTitle, title) ?? title;
  const ogDescription = firstString(overrides.ogDescription, defaults.ogDescription, description) ?? description;
  const ogUrl = toAbsoluteUrl(firstString(overrides.ogUrl, defaults.ogUrl, canonical) ?? canonical, baseOrigin);
  const ogImage = toAbsoluteUrl(resolvedImagePath, baseOrigin);

  const twitterCard = firstString(overrides.twitterCard, defaults.twitterCard, "summary_large_image") ?? "summary_large_image";
  const twitterTitle = firstString(overrides.twitterTitle, defaults.twitterTitle, ogTitle) ?? ogTitle;
  const twitterDescription =
    firstString(overrides.twitterDescription, defaults.twitterDescription, ogDescription) ?? ogDescription;
  const twitterImage = toAbsoluteUrl(resolvedImagePath, baseOrigin);

  document.title = title;
  ensureCanonical(canonical);

  ensureMetaTag("name", "description", description);
  ensureMetaTag("property", "og:title", ogTitle);
  ensureMetaTag("property", "og:description", ogDescription);
  ensureMetaTag("property", "og:type", firstString(overrides.ogType, defaults.ogType, "website") ?? "website");
  ensureMetaTag("property", "og:url", ogUrl);
  ensureMetaTag("property", "og:image", ogImage);

  ensureMetaTag("name", "twitter:card", twitterCard);
  ensureMetaTag("name", "twitter:title", twitterTitle);
  ensureMetaTag("name", "twitter:description", twitterDescription);
  ensureMetaTag("name", "twitter:image", twitterImage);
};

const targetForLink = (url?: string): "_blank" | "_self" => {
  const mode = content.site.ui?.linkTarget ?? "new-tab-external";

  if (mode === "same-tab") return "_self";
  if (mode === "new-tab-all") return "_blank";

  if (!url) return "_self";

  return url.startsWith("http://") || url.startsWith("https://") ? "_blank" : "_self";
};

export default function RouteIndex() {
  const [mode, setMode] = createSignal<UiMode>("dark");
  const canToggle = createMemo(() => canToggleMode(modePolicy));
  const themeFingerprint = () => `${themeSelection.active}:${mode()}`;

  const renderCard = (link: (typeof content.links)[number]) => {
    const target = targetForLink(link.url);

    if (isPaymentCapableLink(link)) {
      return (
        <PaymentLinkCard
          link={link}
          site={content.site}
          target={target}
          interaction="minimal"
          brandIconOptions={brandIconOptions}
          themeFingerprint={themeFingerprint()}
        />
      );
    }

    if (resolveRichCardVariant(content.site, link) === "rich") {
      return (
        <RichLinkCard
          link={link}
          viewModel={buildRichCardViewModel(content.site, link)}
          target={target}
          interaction="minimal"
          brandIconOptions={brandIconOptions}
          themeFingerprint={themeFingerprint()}
        />
      );
    }

    return (
      <SimpleLinkCard
        link={link}
        target={target}
        interaction="minimal"
        brandIconOptions={brandIconOptions}
        themeFingerprint={themeFingerprint()}
      />
    );
  };

  onMount(() => {
    setMode(resolveInitialMode(modePolicy));
    applySeoMetadata();
  });

  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: mode(),
      policy: modePolicy,
      density: layout.density,
      brandIconSizeMode: brandIconOptions.sizeMode
    });
    applyTypographyState(typography);
  });

  const handleModeToggle = () => {
    if (!canToggle()) {
      return;
    }

    const nextMode: UiMode = mode() === "dark" ? "light" : "dark";
    setMode(nextMode);
    persistModePreference(modePolicy, nextMode);
  };

  return (
    <main
      aria-label="OpenLinks profile and links"
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} layout-${layout.desktopColumns} typography-${layout.typographyScale} targets-${layout.targetSize}`}
    >
      <TopUtilityBar title={content.site.title} controlsLabel="Theme and mode controls">
        <UtilityControlsMenu panelLabel="Theme and mode controls">
          <Show
            when={canToggle()}
            fallback={
              <span class="utility-pill" aria-live="polite">
                {modePolicy === "static-dark" ? "Dark mode fixed" : "Light mode fixed"}
              </span>
            }
          >
            <ThemeToggle mode={mode()} onToggle={handleModeToggle} />
          </Show>
          <span class="utility-pill" aria-live="polite">
            {themeDefinition?.label ?? themeSelection.active} · {themeDefinition?.intensity ?? "mild"}
          </span>
          <span class="utility-pill" aria-live="polite">
            Cards: {richRenderMode === "simple" ? "simple only" : "rich + simple"}
          </span>
        </UtilityControlsMenu>
      </TopUtilityBar>

      <For each={composition.blocks}>
        {(block) => (
          <Switch>
            <Match when={block === "profile"}>
              <ProfileHeader profile={content.profile} richness={composition.profileRichness} />
            </Match>
            <Match when={block === "links"}>
              <For each={sections}>
                {(section) => (
                  <LinkSection
                    section={section}
                    showHeading={showGroupHeading}
                    groupingStyle={composition.grouping}
                  >
                    {(link) => renderCard(link)}
                  </LinkSection>
                )}
              </For>
            </Match>
          </Switch>
        )}
      </For>

      <SiteFooter preferences={footerPreferences} buildTimestampIso={__OPENLINKS_BUILD_TIMESTAMP__} />
    </main>
  );
}
