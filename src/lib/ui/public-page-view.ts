export type PublicPageView = "analytics" | "links";

export const resolvePublicPageView = (analyticsOpen: boolean): PublicPageView =>
  analyticsOpen ? "analytics" : "links";
