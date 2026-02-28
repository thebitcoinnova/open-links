import type { JSX } from "solid-js";
import { cn } from "@/lib/utils";

export function Card(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      class={cn(
        "rounded-2xl border border-white/30 bg-white/85 p-6 shadow-lift backdrop-blur supports-[backdrop-filter]:bg-white/70",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}
