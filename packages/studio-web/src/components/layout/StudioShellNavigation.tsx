import { cn } from "@/lib/utils";
import * as Dialog from "@kobalte/core/dialog";
import { A, useLocation } from "@solidjs/router";
import { Menu, X } from "lucide-solid";
import { For, createSignal } from "solid-js";
import { createStudioShellNavigationModel } from "./studio-shell-navigation-model";

const navLinkClass = (isActive: boolean) =>
  cn(
    "rounded-lg px-3 py-2 text-slate-200 transition hover:bg-white/10 hover:text-white",
    isActive && "bg-white/10 text-white",
  );

export default function StudioShellNavigation() {
  const location = useLocation();
  const [isOpen, setIsOpen] = createSignal(false);
  const navigation = createStudioShellNavigationModel();
  const isActive = (href: string) => location.pathname === href;
  const closeNavigation = () => {
    setIsOpen(false);
  };

  return (
    <>
      <nav aria-label="Studio pages" class="hidden items-center gap-2 text-sm md:flex">
        <For each={navigation.links}>
          {(link) => (
            <A class={navLinkClass(isActive(link.href))} href={link.href}>
              {link.label}
            </A>
          )}
        </For>
      </nav>

      <Dialog.Root open={isOpen()} onOpenChange={setIsOpen}>
        <Dialog.Trigger
          aria-label={navigation.triggerLabel}
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-lift transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse/60 md:hidden"
          type="button"
        >
          <Menu size={20} />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay class="fixed inset-0 z-40 bg-ink/65 backdrop-blur-sm" />
          <div class="fixed inset-0 z-50 flex items-start justify-end p-4 md:hidden">
            <Dialog.Content
              aria-label={navigation.dialogLabel}
              class="w-full max-w-xs rounded-3xl border border-white/15 bg-slate-950/95 p-5 text-slate-100 shadow-2xl focus:outline-none"
            >
              <div class="flex items-center justify-between gap-3">
                <Dialog.Title class="font-display text-lg font-bold text-white">
                  {navigation.dialogLabel}
                </Dialog.Title>
                <Dialog.CloseButton
                  aria-label="Close studio navigation"
                  class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse/60"
                  type="button"
                >
                  <X size={18} />
                </Dialog.CloseButton>
              </div>

              <nav aria-label={navigation.dialogLabel} class="mt-4 grid gap-2">
                <For each={navigation.links}>
                  {(link) => (
                    <A
                      class={cn(
                        "rounded-2xl border border-white/10 px-4 py-3 text-base text-slate-100 transition hover:border-white/20 hover:bg-white/10",
                        isActive(link.href) && "border-white/20 bg-white/10 text-white",
                      )}
                      href={link.href}
                      onClick={closeNavigation}
                    >
                      {link.label}
                    </A>
                  )}
                </For>
              </nav>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
