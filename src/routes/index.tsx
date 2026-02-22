import { For, Show } from "solid-js";
import { loadContent } from "../lib/content/load-content";

const content = loadContent();

const groupedLinks = () => {
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
      <section class="hero">
        <h1>{content.profile.name}</h1>
        <p>{content.profile.headline}</p>
        <p>{content.profile.bio}</p>
      </section>

      <For each={sections}>
        {(section) => (
          <section>
            <Show when={section.label}>
              <h2 class="section-heading">{section.label}</h2>
            </Show>
            <div class="card-grid" aria-label={section.label}>
              <For each={section.links}>
                {(link) => (
                  <a class="card" href={link.url} target="_blank" rel="noreferrer">
                    <h3>{link.label}</h3>
                    <p>{link.description ?? link.url}</p>
                  </a>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </main>
  );
}
