import { cn } from "@/lib/utils";
import type { JSX } from "solid-js";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      class={cn(
        "rounded-2xl border border-slate-700/70 bg-slate-900/75 p-6 text-slate-100 shadow-lift backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-600/80 hover:shadow-[0_24px_50px_-24px_rgba(10,15,20,0.58)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 supports-[backdrop-filter]:bg-slate-900/60",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}
