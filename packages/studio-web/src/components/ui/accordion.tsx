import { cn } from "@/lib/utils";
import * as Accordion from "@kobalte/core/accordion";
import type { ParentProps } from "solid-js";

export interface SimpleAccordionProps extends ParentProps {
  class?: string;
  onChange: (value: string[]) => void;
  value: string[];
}

export interface SimpleAccordionItemProps extends ParentProps {
  class?: string;
  contentClass?: string;
  summary: string;
  summaryDetail?: string;
  summaryMeta?: string;
  value: string;
}

export function SimpleAccordion(props: SimpleAccordionProps) {
  return (
    <Accordion.Root
      collapsible
      class={cn("space-y-3", props.class)}
      value={props.value}
      onChange={props.onChange}
    >
      {props.children}
    </Accordion.Root>
  );
}

export function SimpleAccordionItem(props: SimpleAccordionItemProps) {
  return (
    <Accordion.Item
      class={cn(
        "overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50 data-[expanded]:border-slate-500/80",
        props.class,
      )}
      value={props.value}
    >
      <Accordion.Header class="m-0">
        <Accordion.Trigger class="flex w-full items-center justify-between gap-3 px-4 py-4 text-left outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-pulse/60">
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-slate-100">{props.summary}</span>
            <span class="mt-1 block truncate text-xs text-slate-400">
              {props.summaryDetail ?? props.summaryMeta ?? "Configured link"}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-wide text-slate-300">
              {props.summaryMeta ?? "link"}
            </span>
            <span class="mt-2 block text-xs text-slate-500">v</span>
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content
        class={cn(
          "overflow-hidden border-t border-slate-800 px-4 py-4 data-[expanded]:animate-[studio-accordion-down_200ms_ease-out] data-[closed]:animate-[studio-accordion-up_200ms_ease-out]",
          props.contentClass,
        )}
      >
        {props.children}
      </Accordion.Content>
    </Accordion.Item>
  );
}
