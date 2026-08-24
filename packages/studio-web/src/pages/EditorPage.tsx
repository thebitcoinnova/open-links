import EditorWorkspace, { type EditorTab } from "@/components/editor/EditorWorkspace";
import PageShell from "@/components/layout/PageShell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { RepoContentPayload } from "@openlinks/studio-shared";
import { useParams } from "@solidjs/router";
import { type JSX, Show } from "solid-js";
import EditorPageSidebar from "./EditorPageSidebar";
import {
  AdvancedEditorTab,
  LinksEditorTab,
  ProfileEditorTab,
  SiteEditorTab,
} from "./EditorPageTabs";
import { type EditorPageController, createEditorPageController } from "./editor-page-controller";

const buildContentByTab = (
  controller: EditorPageController,
  content: RepoContentPayload,
): Record<EditorTab, JSX.Element> => ({
  profile: <ProfileEditorTab controller={controller} content={content} />,
  links: <LinksEditorTab controller={controller} content={content} />,
  site: <SiteEditorTab controller={controller} content={content} />,
  advanced: <AdvancedEditorTab controller={controller} content={content} />,
});

const LoadedEditorWorkspace = (props: {
  content: RepoContentPayload;
  controller: EditorPageController;
}) => (
  <EditorWorkspace
    activeTab={props.controller.activeTab()}
    contentByTab={buildContentByTab(props.controller, props.content)}
    dirty={props.controller.dirty()}
    onTabChange={props.controller.setActiveTab}
    sidebar={<EditorPageSidebar controller={props.controller} />}
  />
);

export default function EditorPage() {
  const params = useParams();
  const controller = createEditorPageController(() => params.repoId ?? "");

  return (
    <PageShell>
      <Show
        when={controller.initialized()}
        fallback={<p class="text-sm text-slate-400">Loading repository content...</p>}
      >
        {(content) => <LoadedEditorWorkspace controller={controller} content={content()} />}
      </Show>
      <Show when={controller.confirmDialogCopy()}>
        {(dialog) => (
          <ConfirmDialog
            open={Boolean(controller.pendingConfirmAction())}
            title={dialog().title}
            description={dialog().description}
            confirmLabel={dialog().confirmLabel}
            onCancel={() => controller.setPendingConfirmAction(null)}
            onConfirm={controller.confirmPendingAction}
          />
        )}
      </Show>
    </PageShell>
  );
}
