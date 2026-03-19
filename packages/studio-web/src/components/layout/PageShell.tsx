import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import StudioShellNavigation from "./StudioShellNavigation";

interface PageShellProps {
  class?: string;
  children: JSX.Element;
}

const toAssetUrl = (assetPath: string): string => {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = assetPath.replace(/^\/+/, "");
  return `${normalizedBase}${normalizedPath}`;
};

const STUDIO_LOGO_PATH = toAssetUrl("branding/openlinks-logo/openlinks-logo.svg");

export default function PageShell(props: PageShellProps) {
  return (
    <div class="min-h-screen bg-gradient-to-br from-ink via-slate-900 to-slate-800 text-slate-100">
      <header class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 md:px-8">
        <A href="/" class="flex items-center gap-2 font-display text-lg tracking-tight text-white">
          <img src={STUDIO_LOGO_PATH} alt="" aria-hidden="true" class="openlinks-studio-logo" />
          <span>OpenLinks Studio</span>
        </A>
        <StudioShellNavigation />
      </header>
      <main class={`mx-auto w-full max-w-6xl px-4 pb-20 md:px-8 ${props.class ?? ""}`}>
        {props.children}
      </main>
      <footer class="mx-auto w-full max-w-6xl px-4 pb-10 md:px-8">
        <div class="flex flex-col items-center gap-2 text-center">
          <img src={STUDIO_LOGO_PATH} alt="OpenLinks Studio logo" class="openlinks-studio-logo" />
          <p class="text-xs uppercase tracking-[0.14em] text-slate-400">OpenLinks Studio</p>
        </div>
      </footer>
    </div>
  );
}
