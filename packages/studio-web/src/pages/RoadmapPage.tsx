import PageShell from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { type TaskStatus, phaseChecklist } from "@/lib/phase-checklist";
import { For } from "solid-js";

const statusLabel: Record<TaskStatus, string> = {
  todo: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const statusClass: Record<TaskStatus, string> = {
  todo: "bg-slate-700/70 text-slate-100",
  in_progress: "bg-amber-500/25 text-amber-200",
  done: "bg-emerald-500/25 text-emerald-200",
};

const doneCount = phaseChecklist
  .flatMap((phase) => phase.tasks)
  .filter((task) => task.status === "done").length;

const totalCount = phaseChecklist.flatMap((phase) => phase.tasks).length;

export default function RoadmapPage() {
  return (
    <PageShell>
      <section class="rounded-3xl border border-white/20 bg-white/10 p-6 text-white">
        <h1 class="font-display text-3xl font-bold">Studio Phase Checklist</h1>
        <p class="mt-2 text-sm text-slate-200">
          Live delivery tracker for OpenLinks Studio. Source of truth doc:{" "}
          <code>docs/studio-phase-checklist.md</code>
        </p>
        <p class="mt-4 text-sm text-slate-100">
          Progress: <span class="font-semibold">{doneCount}</span> /{" "}
          <span class="font-semibold">{totalCount}</span> tasks completed.
        </p>
      </section>

      <section class="mt-6 grid gap-4">
        <For each={phaseChecklist}>
          {(phase) => (
            <Card>
              <h2 class="font-display text-2xl font-bold">{phase.title}</h2>
              <p class="mt-1 text-sm text-slate-300">{phase.summary}</p>

              <ul class="mt-4 space-y-2">
                <For each={phase.tasks}>
                  {(task) => (
                    <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
                      <span>{task.label}</span>
                      <div class="flex items-center gap-2">
                        <span class="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                          {task.priority}
                        </span>
                        <span
                          class={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[task.status]}`}
                        >
                          {statusLabel[task.status]}
                        </span>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Card>
          )}
        </For>
      </section>
    </PageShell>
  );
}
