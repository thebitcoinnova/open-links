import type { JSX } from "solid-js";
import { A } from "@solidjs/router";

interface PageShellProps {
  class?: string;
  children: JSX.Element;
}

export default function PageShell(props: PageShellProps) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-ink via-slate-900 to-slate-800 text-slate-100">
      <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <A href="/" class="font-display text-lg tracking-tight text-white">
          OpenLinks Studio
        </A>
        <nav class="flex items-center gap-2 text-sm">
          <A href="/onboarding" class="rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10">
            Onboarding
          </A>
          <A href="/roadmap" class="rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10">
            Roadmap
          </A>
        </nav>
      </header>
      <main class={`mx-auto w-full max-w-6xl px-4 pb-20 md:px-8 ${props.class ?? ""}`}>
        {props.children}
      </main>
    </div>
  );
}
