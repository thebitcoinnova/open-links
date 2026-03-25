export type EntityType = "organization" | "person";

const capitalize = (value: string): string => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

export const resolveEntityType = (maybeEntityType?: unknown): EntityType =>
  maybeEntityType === "organization" ? "organization" : "person";

export const isPersonEntityType = (maybeEntityType?: unknown): boolean =>
  resolveEntityType(maybeEntityType) === "person";

export const resolveEntityPageNoun = (maybeEntityType?: unknown): "page" | "profile" =>
  resolveEntityType(maybeEntityType) === "organization" ? "page" : "profile";

export const resolveEntityPageLabel = (maybeEntityType?: unknown): string =>
  capitalize(resolveEntityPageNoun(maybeEntityType));

export const resolveEntityAnalyticsNoun = (maybeEntityType?: unknown): "audience" | "follower" =>
  resolveEntityType(maybeEntityType) === "organization" ? "audience" : "follower";

export const resolveEntityAnalyticsLabel = (maybeEntityType?: unknown): string =>
  `${capitalize(resolveEntityAnalyticsNoun(maybeEntityType))} Analytics`;
