import { Card } from "@/components/ui/card";
import * as Tabs from "@kobalte/core/tabs";
import type { JSX } from "solid-js";
import { For } from "solid-js";

export type EditorTab = "profile" | "links" | "site" | "advanced";

interface EditorTabDefinition {
  label: string;
  value: EditorTab;
}

export const EDITOR_TABS: readonly EditorTabDefinition[] = [
  { value: "profile", label: "Profile" },
  { value: "links", label: "Links" },
  { value: "site", label: "Site" },
  { value: "advanced", label: "Advanced" },
];

export const resolveEditorTabIds = (tab: EditorTab) => ({
  contentId: `editor-panel-${tab}`,
  triggerId: `editor-tab-${tab}`,
});

export interface EditorWorkspaceProps {
  activeTab: EditorTab;
  contentByTab: Record<EditorTab, JSX.Element>;
  dirty: boolean;
  onTabChange: (value: EditorTab) => void;
  sidebar: JSX.Element;
}

export default function EditorWorkspace(props: EditorWorkspaceProps) {
  return (
    <Tabs.Root
      orientation="vertical"
      value={props.activeTab}
      onChange={(nextTab) => props.onTabChange(nextTab as EditorTab)}
    >
      <section class="grid gap-4 lg:grid-cols-[220px,1fr,320px]">
        <Card class="space-y-2">
          <p class="text-xs uppercase tracking-widest text-slate-400" id="editor-sections-label">
            Sections
          </p>
          <Tabs.List aria-labelledby="editor-sections-label" class="flex flex-col gap-2">
            <For each={EDITOR_TABS}>
              {(tab) => {
                const ids = resolveEditorTabIds(tab.value);

                return (
                  <Tabs.Trigger
                    class="rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10 data-[selected]:bg-slate-100 data-[selected]:text-ink"
                    id={ids.triggerId}
                    value={tab.value}
                  >
                    {tab.label}
                  </Tabs.Trigger>
                );
              }}
            </For>
          </Tabs.List>
          <div class="pt-2 text-xs text-slate-400">
            Dirty state: {props.dirty ? "unsaved changes" : "clean"}
          </div>
        </Card>

        <Card class="space-y-4">
          <For each={EDITOR_TABS}>
            {(tab) => {
              const ids = resolveEditorTabIds(tab.value);

              return (
                <Tabs.Content
                  aria-labelledby={ids.triggerId}
                  class="space-y-4"
                  id={ids.contentId}
                  value={tab.value}
                >
                  {props.contentByTab[tab.value]}
                </Tabs.Content>
              );
            }}
          </For>
        </Card>

        <Card class="space-y-4">{props.sidebar}</Card>
      </section>
    </Tabs.Root>
  );
}
