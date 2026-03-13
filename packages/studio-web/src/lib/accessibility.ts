export type LiveRegionTone = "alert" | "status";

export const resolveLiveRegionProps = (tone: LiveRegionTone) =>
  tone === "alert"
    ? ({ "aria-live": "assertive", role: "alert" } as const)
    : ({ "aria-live": "polite", role: "status" } as const);

export const resolveNextTabValue = <TabValue extends string>(
  tabs: readonly TabValue[],
  currentTab: TabValue,
  key: string,
): TabValue | null => {
  const currentIndex = tabs.indexOf(currentTab);
  if (currentIndex < 0) {
    return null;
  }

  if (key === "ArrowLeft" || key === "ArrowUp") {
    return tabs[(currentIndex - 1 + tabs.length) % tabs.length] ?? null;
  }

  if (key === "ArrowRight" || key === "ArrowDown") {
    return tabs[(currentIndex + 1) % tabs.length] ?? null;
  }

  if (key === "Home") {
    return tabs[0] ?? null;
  }

  if (key === "End") {
    return tabs[tabs.length - 1] ?? null;
  }

  return null;
};
