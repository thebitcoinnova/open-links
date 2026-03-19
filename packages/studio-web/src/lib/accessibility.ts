export type LiveRegionTone = "alert" | "status";

export const resolveLiveRegionProps = (tone: LiveRegionTone) =>
  tone === "alert"
    ? ({ "aria-live": "assertive", role: "alert" } as const)
    : ({ "aria-live": "polite", role: "status" } as const);
