import { cn } from "@/lib/utils";
import type { JSX } from "solid-js";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      class={cn(
        "rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6 text-slate-100 shadow-lift backdrop-blur supports-[backdrop-filter]:bg-slate-900/60",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}
