import { createEffect, createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import RichLinkCard from "../components/cards/RichLinkCard";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import ProfileHeader from "../components/profile/ProfileHeader";
import { loadContent } from "../lib/content/load-content";
import ThemeToggle from "../components/theme/ThemeToggle";
import {
  applyThemeState,
  canToggleMode,
  persistModePreference,
  resolveInitialMode,
  resolveModePolicy,
  type UiMode
} from "../lib/theme/mode-controller";
import { getThemeDefinition, resolveThemeSelection } from "../lib/theme/theme-registry";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";
import { resolveLayoutPreferences } from "../lib/ui/layout-preferences";
import {
  buildRichCardViewModel,
  resolveRichCardVariant,
  resolveRichRenderMode
} from "../lib/ui/rich-card-policy";

const content = loadContent();
const composition = resolveComposition(content.site);
const layout = resolveLayoutPreferences(content.site);
const richRenderMode = resolveRichRenderMode(content.site);
const modePolicy = resolveModePolicy(content.site);
const themeSelection = resolveThemeSelection(content.site);
const themeDefinition = getThemeDefinition(themeSelection.active);

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

  const ogTitle = firstString(overrides.ogTitle, defaults.ogTitle, title) ?? title;
  const ogDescription = firstString(overrides.ogDescription, defaults.ogDescription, description) ?? description;
  const ogUrl = toAbsoluteUrl(firstString(overrides.ogUrl, defaults.ogUrl, canonical) ?? canonical, baseOrigin);
  const ogImage = toAbsoluteUrl(imagePath, baseOrigin);

  const twitterCard = firstString(overrides.twitterCard, defaults.twitterCard, "summary_large_image") ?? "summary_large_image";
  const twitterTitle = firstString(overrides.twitterTitle, defaults.twitterTitle, ogTitle) ?? ogTitle;
  const twitterDescription =
    firstString(overrides.twitterDescription, defaults.twitterDescription, ogDescription) ?? ogDescription;
  const twitterImage = toAbsoluteUrl(imagePath, baseOrigin);

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

const targetForLink = (url: string): "_blank" | "_self" => {
  const mode = content.site.ui?.linkTarget ?? "new-tab-external";

  if (mode === "same-tab") return "_self";
  if (mode === "new-tab-all") return "_blank";

  return url.startsWith("http://") || url.startsWith("https://") ? "_blank" : "_self";
};

const renderCard = (link: (typeof content.links)[number]) => {
  const target = targetForLink(link.url);

  if (resolveRichCardVariant(content.site, link) === "rich") {
    return (
      <RichLinkCard
        link={link}
        viewModel={buildRichCardViewModel(content.site, link)}
        target={target}
        interaction="minimal"
      />
    );
  }

  return <SimpleLinkCard link={link} target={target} interaction="minimal" />;
};

export default function RouteIndex() {
  const [mode, setMode] = createSignal<UiMode>("dark");
  const canToggle = createMemo(() => canToggleMode(modePolicy));

  onMount(() => {
    setMode(resolveInitialMode(modePolicy));
    applySeoMetadata();
  });

  createEffect(() => {
    applyThemeState({
      themeId: themeSelection.active,
      mode: mode(),
      policy: modePolicy,
      density: layout.density
    });
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
    </main>
  );
}
