import PageShell from "@/components/layout/PageShell";
import ButtonLink from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Rocket, ShieldCheck, WandSparkles } from "lucide-solid";
import { For } from "solid-js";

const features = [
  {
    title: "Free Linktree alternative",
    body: "Build a clean link-in-bio page without monthly fees or complicated setup.",
    icon: Rocket,
  },
  {
    title: "Simple drag-and-edit flow",
    body: "Update your profile, links, and look in a visual editor designed for non-technical users.",
    icon: WandSparkles,
  },
  {
    title: "Publish with confidence",
    body: "Save changes, see status clearly, and keep your page up to date without guesswork.",
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
            <CheckCircle2 size={14} /> OpenLinks Studio
          </p>
          <h1 class="font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            Your free Linktree alternative.
          </h1>
          <p class="max-w-2xl text-base text-slate-100/90 md:text-lg">
            Create a polished link-in-bio page in minutes. No coding, no subscriptions, just one
            simple place for all your links.
          </p>
          <div class="flex flex-wrap items-center gap-3">
            <ButtonLink class="bg-white text-ink hover:bg-slate-100" href="/onboarding" size="lg">
              Get started free
            </ButtonLink>
            <ButtonLink href="/roadmap" size="lg" variant="outline">
              View product roadmap
            </ButtonLink>
            <ButtonLink
              external
              href="https://github.com/pRizz/open-links"
              size="lg"
              variant="ghost"
            >
              Learn more
            </ButtonLink>
          </div>
        </div>
      </section>

      <section class="mt-10 grid gap-4 md:grid-cols-3">
        <For each={features}>
          {(feature) => (
            <Card>
              <feature.icon class="mb-4 text-pulse" size={24} />
              <h3 class="font-display text-lg font-bold">{feature.title}</h3>
              <p class="mt-2 text-sm text-slate-300">{feature.body}</p>
            </Card>
          )}
        </For>
      </section>

      <section class="mt-10 rounded-3xl border border-white/20 bg-white/10 p-6">
        <h2 class="font-display text-2xl font-bold text-white">How it works</h2>
        <ol class="mt-4 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            1. Sign in and answer a few quick setup questions.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            2. Pick your style and add your links.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            3. Preview your page before you publish.
          </li>
          <li class="rounded-xl border border-white/15 bg-white/5 p-4">
            4. Publish and share your new link-in-bio.
          </li>
        </ol>
      </section>
    </PageShell>
  );
}
