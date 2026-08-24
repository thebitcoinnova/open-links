import { Button } from "@/components/ui/button";
import StatusNotice from "@/components/ui/status-notice";
import { For, Show } from "solid-js";
import type { EditorPageController } from "./editor-page-controller";

const DeploymentStatus = (props: { controller: EditorPageController }) => (
  <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
    <p class="font-semibold">Deployment</p>
    <Show
      when={props.controller.deployStatus()}
      fallback={<p class="text-slate-400">No deployment data yet.</p>}
    >
      {(status) => (
        <ul class="mt-2 space-y-1 text-xs text-slate-300">
          <li>CI: {status().ci}</li>
          <li>Deploy: {status().deploy}</li>
          <li>Pages URL: {status().pagesUrl ?? "not detected"}</li>
        </ul>
      )}
    </Show>
  </div>
);

const ValidationStatus = (props: { controller: EditorPageController }) => (
  <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
    <p class="font-semibold">Validation</p>
    <Show
      when={props.controller.validation()}
      fallback={<p class="text-slate-400">Run validation to see issues.</p>}
    >
      {(result) => (
        <StatusNotice class="mt-2" tone={result().valid ? "status" : "alert"}>
          <p class={`font-medium ${result().valid ? "text-emerald-300" : "text-rose-300"}`}>
            {result().valid ? "Valid" : `${result().errors.length} error(s)`}
          </p>
          <Show when={!result().valid}>
            <ul class="mt-2 list-disc space-y-1 pl-4 text-rose-300">
              <For each={result().errors.slice(0, 8)}>
                {(item) => (
                  <li>
                    [{item.source}] {item.path}: {item.message}
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </StatusNotice>
      )}
    </Show>
  </div>
);

const RecentOperations = (props: { controller: EditorPageController }) => (
  <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
    <p class="font-semibold">Recent operations</p>
    <Show
      when={props.controller.ops()}
      fallback={<p class="text-slate-400">No operations loaded.</p>}
    >
      {(value) => (
        <For each={value().operations.slice(0, 8)}>
          {(op) => (
            <p class="mt-1 text-xs text-slate-300">
              {op.operation} · {op.status}
            </p>
          )}
        </For>
      )}
    </Show>
  </div>
);

export default function EditorPageSidebar(props: { controller: EditorPageController }) {
  const refreshStatus = () =>
    Promise.all([props.controller.refetchDeploy(), props.controller.refetchOps()]);

  return (
    <>
      <h2 class="font-display text-xl font-bold">Publish Controls</h2>
      <div class="flex flex-wrap gap-2">
        <Button onClick={props.controller.validate}>Validate</Button>
        <Button
          variant="outline"
          onClick={() => props.controller.setPendingConfirmAction("save")}
          disabled={!props.controller.dirty()}
        >
          Save to main
        </Button>
        <Button variant="outline" onClick={() => props.controller.setPendingConfirmAction("sync")}>
          Sync upstream
        </Button>
        <Button variant="outline" onClick={refreshStatus}>
          Refresh status
        </Button>
      </div>
      <Show when={props.controller.saveMessage()}>
        {(message) => <StatusNotice tone={message().tone}>{message().text}</StatusNotice>}
      </Show>
      <DeploymentStatus controller={props.controller} />
      <ValidationStatus controller={props.controller} />
      <RecentOperations controller={props.controller} />
    </>
  );
}
