import { For, Match, Switch } from "solid-js";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import TopUtilityBar from "../components/layout/TopUtilityBar";
import ProfileHeader from "../components/profile/ProfileHeader";
import { loadContent } from "../lib/content/load-content";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";

const content = loadContent();
const composition = resolveComposition(content.site);

const sections = resolveLinkSections(content.links, content.groups, composition.grouping) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";

const targetForLink = (url: string): "_blank" | "_self" => {
  const mode = content.site.ui?.linkTarget ?? "new-tab-external";

  if (mode === "same-tab") return "_self";
  if (mode === "new-tab-all") return "_blank";

  return url.startsWith("http://") || url.startsWith("https://") ? "_blank" : "_self";
};

export default function RouteIndex() {
  return (
    <main
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} density-${content.site.ui?.density ?? "medium"}`}
    >
      <TopUtilityBar title={content.site.title}>
        <span class="utility-pill">Mode: {content.site.ui?.modePolicy ?? "dark-toggle"}</span>
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
