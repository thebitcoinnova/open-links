import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { OpenLink } from "../../lib/content/load-content";

export interface LinkSectionData {
  id: string;
  label?: string;
  links: OpenLink[];
}

export interface LinkSectionProps {
  section: LinkSectionData;
  showHeading?: boolean;
  groupingStyle?: "subtle" | "none" | "bands";
  children: (link: OpenLink) => JSX.Element;
}

export const LinkSection = (props: LinkSectionProps) => {
  const showHeading = () => props.showHeading ?? true;
  const groupingStyle = () => props.groupingStyle ?? "subtle";

  return (
    <section
      class={`link-section grouping-${groupingStyle()}`}
      data-grouping={groupingStyle()}
      aria-label={props.section.label ?? "Links"}
    >
      <Show when={showHeading() && props.section.label}>
        <h2 class="section-heading">{props.section.label}</h2>
      </Show>
      <div class="card-grid">
        <For each={props.section.links}>{(link) => props.children(link)}</For>
      </div>
    </section>
  );
};

export default LinkSection;
