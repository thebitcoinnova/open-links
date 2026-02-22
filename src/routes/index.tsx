import { For, Match, Switch } from "solid-js";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import ProfileHeader from "../components/profile/ProfileHeader";
import { loadContent } from "../lib/content/load-content";
import { resolveComposition, resolveLinkSections } from "../lib/ui/composition";

const content = loadContent();
const composition = resolveComposition(content.site);

const sections = resolveLinkSections(content.links, content.groups, composition.grouping) as LinkSectionData[];
const showGroupHeading = composition.grouping !== "none";

export default function RouteIndex() {
  return (
    <main
      class={`page composition-${composition.mode} profile-${composition.profileEmphasis} density-${content.site.ui?.density ?? "medium"}`}
    >
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
                    {(link) => <SimpleLinkCard link={link} />}
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
