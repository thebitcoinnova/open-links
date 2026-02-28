import { A } from "@solidjs/router";
import { For } from "solid-js";
import { CheckCircle2, Rocket, ShieldCheck, WandSparkles } from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PageShell from "@/components/layout/PageShell";

const features = [
  {
    title: "Guided GitHub onboarding",
    body: "Walk non-technical creators through account signup, app install, and fork provisioning.",
    icon: Rocket,
  },
  {
    title: "Visual OpenLinks editor",
    body: "Edit profile, links, and site settings with validation-aware forms and save feedback.",
    icon: WandSparkles,
  },
  {
    title: "Safe sync and publish",
    body: "Scheduled upstream sync with conflict signals and deploy status visibility after every save.",
    icon: ShieldCheck,
  },
];

export default function MarketingPage() {
  return (
    <PageShell>
      <section class="relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-cyan-400/15 via-white/10 to-rose-400/20 p-8 shadow-lift md:p-12">
        <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-rose-400/30 blur-3xl" />
        <div class="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div class="relative z-10 max-w-3xl space-y-6">
          <p class="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
            <CheckCircle2 size={14} /> Public self-serve onboarding
          </p>
          <h1 class="font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Launch an OpenLinks site without touching local git.
          </h1>
          <p class="max-w-2xl text-base text-slate-100/90 md:text-lg">
            OpenLinks Studio provisions your fork, guides setup, and gives you a polished browser
            editor that commits directly to your repository.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <A href="/onboarding">
              <Button size="lg" class="bg-white text-ink hover:bg-slate-100">
                Start onboarding
              </Button>
            </A>
            <A href="/roadmap">
              <Button size="lg" variant="outline">
                View phase checklist
              </Button>
            </A>
            <a href="https://github.com/pRizz/open-links" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="lg">
                View upstream template
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section class="mt-10 grid gap-4 md:grid-cols-3">
        <For each={features}>
          {(feature) => (
            <Card class="border-white/20 bg-white/90 text-ink">
              <feature.icon class="mb-4 text-pulse" size={24} />
              <h3 class="font-display text-lg font-bold">{feature.title}</h3>
              <p class="mt-2 text-sm text-slate-700">{feature.body}</p>
            </Card>
          )}
        </For>
      </section>

      <section class="mt-10 rounded-3xl border border-white/20 bg-white/10 p-6">
        <h2 class="font-display text-2xl font-bold text-white">How it works</h2>
        <ol class="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            1. Create or connect your GitHub account.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            2. Install your GitHub App permissions.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            3. Provision your OpenLinks fork in one click.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            4. Edit content and publish with live status.
          </li>
        </ol>
      </section>
    </PageShell>
  );
}
