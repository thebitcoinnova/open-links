import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";
import PaymentLinkCard from "../components/cards/PaymentLinkCard";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import SiteFooter from "../components/layout/SiteFooter";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import UtilityControlsMenu from "../components/layout/UtilityControlsMenu";
import ProfileHeader from "../components/profile/ProfileHeader";
import ThemeToggle from "../components/theme/ThemeToggle";
import { loadContent, resolveGeneratedContentImageUrl } from "../lib/content/load-content";
import { resolveBrandIconOptions } from "../lib/icons/brand-icon-options";
import { isPaymentCapableLink } from "../lib/payments/types";
import {
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "../lib/seo/resolve-seo-metadata";
import {
  type UiMode,
  applyThemeState,
  applyTypographyState,
  canToggleMode,
  persistModePreference,
  resolveInitialMode,
  resolveModePolicy,
} from "../lib/theme/mode-controller";
import { getThemeDefinition, resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveFooterPreferences } from "../lib/ui/footer-preferences";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import {
  buildRichCardViewModel,
  resolveRichCardVariant,
  resolveRichRenderMode,
} from "../lib/ui/rich-card-policy";
import { resolveTypographyPreferences } from "../lib/ui/typography-preferences";

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
  typographyScale: layout.typographyScale,
});

const sections = resolveLinkSections(
  content.links,
  content.groups,
  composition.grouping,
) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";

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
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
};

const applySeoMetadata = () => {
  const { metadata } = resolveSeoMetadata(content.site, content.profile, {
    fallbackOrigin: window.location.origin,
    resolveImagePath: (candidate) => {
      const resolved = resolveGeneratedContentImageUrl(candidate);
      if (!resolved) {
        return undefined;
      }

      return resolveBaseAwareAssetPath(
        resolved,
        resolveBasePathFromUrl(content.site.quality?.seo?.canonicalBaseUrl),
      );
    },
  });

  document.title = metadata.title;
  ensureCanonical(metadata.canonical);

  ensureMetaTag("name", "description", metadata.description);
  ensureMetaTag("property", "og:title", metadata.ogTitle);
  ensureMetaTag("property", "og:description", metadata.ogDescription);
  ensureMetaTag("property", "og:type", metadata.ogType);
  ensureMetaTag("property", "og:url", metadata.ogUrl);
  ensureMetaTag("property", "og:image", metadata.ogImage);

  ensureMetaTag("name", "twitter:card", metadata.twitterCard);
  ensureMetaTag("name", "twitter:title", metadata.twitterTitle);
  ensureMetaTag("name", "twitter:description", metadata.twitterDescription);
  ensureMetaTag("name", "twitter:image", metadata.twitterImage);
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
      brandIconSizeMode: brandIconOptions.sizeMode,
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
      style={
        { "--profile-avatar-scale": String(layout.profileAvatarScale) } as Record<string, string>
      }
    >
      <TopUtilityBar
        title={content.site.title}
        controlsLabel="Theme and mode controls"
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      >
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
            {themeDefinition?.label ?? themeSelection.active} ·{" "}
            {themeDefinition?.intensity ?? "mild"}
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

      <SiteFooter
        preferences={footerPreferences}
        buildTimestampIso={__OPENLINKS_BUILD_TIMESTAMP__}
        logoPath="branding/openlinks-logo/openlinks-logo.svg"
        logoAlt="OpenLinks logo"
      />
    </main>
  );
}
