const ANALYTICS_QUERY_KEY = "analytics";
const ANALYTICS_QUERY_VALUE = "all";

export const readAnalyticsPageStateFromUrl = (url: URL): boolean =>
  url.searchParams.get(ANALYTICS_QUERY_KEY) === ANALYTICS_QUERY_VALUE;

export const readAnalyticsPageState = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return readAnalyticsPageStateFromUrl(new URL(window.location.href));
  } catch {
    return false;
  }
};

const updateAnalyticsPageState = (open: boolean, mode: "push" | "replace") => {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = new URL(window.location.href);
  if (open) {
    nextUrl.searchParams.set(ANALYTICS_QUERY_KEY, ANALYTICS_QUERY_VALUE);
  } else {
    nextUrl.searchParams.delete(ANALYTICS_QUERY_KEY);
  }

  if (mode === "replace") {
    window.history.replaceState({}, "", nextUrl);
    return;
  }

  window.history.pushState({}, "", nextUrl);
};

export const writeAnalyticsPageState = (open: boolean) => {
  updateAnalyticsPageState(open, "push");
};

export const replaceAnalyticsPageState = (open: boolean) => {
  updateAnalyticsPageState(open, "replace");
};
