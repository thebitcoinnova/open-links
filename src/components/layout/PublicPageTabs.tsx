import * as Tabs from "@kobalte/core/tabs";
import { For } from "solid-js";
import type { PublicPageView } from "../../lib/ui/public-page-view";

interface PublicPageTabDefinition {
  label: string;
  value: PublicPageView;
}

const PUBLIC_PAGE_TABS: PublicPageTabDefinition[] = [
  { value: "links", label: "Links" },
  { value: "analytics", label: "Analytics" },
];

export interface PublicPageTabsProps {
  activeView: PublicPageView;
  onViewChange: (view: PublicPageView) => void;
}

export const PublicPageTabs = (props: PublicPageTabsProps) => (
  <Tabs.Root
    class="public-page-tabs"
    value={props.activeView}
    onChange={(nextView) => props.onViewChange(nextView as PublicPageView)}
  >
    <Tabs.List aria-label="OpenLinks pages" class="public-page-tabs-list">
      <For each={PUBLIC_PAGE_TABS}>
        {(tab) => (
          <Tabs.Trigger class="public-page-tab-trigger" value={tab.value}>
            {tab.label}
          </Tabs.Trigger>
        )}
      </For>
      <Tabs.Indicator class="public-page-tab-indicator" />
    </Tabs.List>
  </Tabs.Root>
);

export default PublicPageTabs;
