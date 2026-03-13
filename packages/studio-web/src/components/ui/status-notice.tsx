import { type LiveRegionTone, resolveLiveRegionProps } from "@/lib/accessibility";
import { cn } from "@/lib/utils";
import type { JSX } from "solid-js";

interface StatusNoticeProps {
  children: JSX.Element;
  class?: string;
  tone?: LiveRegionTone;
}

export function StatusNotice(props: StatusNoticeProps) {
  const liveRegionProps = resolveLiveRegionProps(props.tone ?? "status");

  return (
    <div
      {...liveRegionProps}
      class={cn(
        "rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-200",
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}

export default StatusNotice;
