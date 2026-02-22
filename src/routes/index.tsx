import { For } from "solid-js";
import SimpleLinkCard from "../components/cards/SimpleLinkCard";
import LinkSection, { type LinkSectionData } from "../components/layout/LinkSection";
import ProfileHeader from "../components/profile/ProfileHeader";
import { loadContent } from "../lib/content/load-content";

const content = loadContent();

const groupedLinks = (): LinkSectionData[] => {
  const byGroup = new Map<string, typeof content.links>();

  for (const link of content.links) {
    const key = link.group ?? "ungrouped";
    const existing = byGroup.get(key) ?? [];
    existing.push(link);
    byGroup.set(key, existing);
  }

  if (content.groups.length === 0) {
    return [{ id: "ungrouped", label: "Links", links: content.links }];
  }

  const sections = content.groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      links: byGroup.get(group.id) ?? []
    }))
    .filter((section) => section.links.length > 0);

  const leftovers = byGroup.get("ungrouped") ?? [];
  if (leftovers.length > 0) {
    sections.push({ id: "ungrouped", label: "More", links: leftovers });
  }

  return sections;
};

export default function RouteIndex() {
  const sections = groupedLinks();

  return (
    <main class="page">
      <ProfileHeader profile={content.profile} />

      <For each={sections}>
        {(section) => (
          <LinkSection section={section}>
            {(link) => <SimpleLinkCard link={link} />}
          </LinkSection>
        )}
      </For>
    </main>
  );
}
