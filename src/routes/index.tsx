import { createEffect, createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
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

const content = loadContent();
const composition = resolveComposition(content.site);
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
      density: content.site.ui?.density
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
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} density-${content.site.ui?.density ?? "medium"}`}
    >
      <TopUtilityBar title={content.site.title}>
        <Show
          when={canToggle()}
          fallback={
            <span class="utility-pill">
              {modePolicy === "static-dark" ? "Dark mode fixed" : "Light mode fixed"}
            </span>
          }
        >
          <ThemeToggle mode={mode()} onToggle={handleModeToggle} />
        </Show>
        <span class="utility-pill">
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
                  <LinkSection section={section} showHeading={showGroupHeading}>
                    {(link) => (
                      <SimpleLinkCard
                        link={link}
                        target={targetForLink(link.url)}
                        interaction="minimal"
                      />
                    )}
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
