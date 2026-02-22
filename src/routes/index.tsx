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
import { buildRichCardViewModel, resolveRichCardVariant } from "../lib/ui/rich-card-policy";

const content = loadContent();
const composition = resolveComposition(content.site);
const layout = resolveLayoutPreferences(content.site);
const modePolicy = resolveModePolicy(content.site);
const themeSelection = resolveThemeSelection(content.site);
const themeDefinition = getThemeDefinition(themeSelection.active);

const sections = resolveLinkSections(content.links, content.groups, composition.grouping) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";

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
