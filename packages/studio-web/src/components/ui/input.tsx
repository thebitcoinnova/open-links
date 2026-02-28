import { cn } from "@/lib/utils";
import type { JSX } from "solid-js";

export function Input(props: JSX.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      class={cn(
        "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-pulse focus:outline-none focus:ring-2 focus:ring-pulse/35",
        props.class,
      )}
    />
  );
}

export function Textarea(props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      class={cn(
        "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-pulse focus:outline-none focus:ring-2 focus:ring-pulse/35",
        props.class,
      )}
    />
  );
}
