import { resolveHandleFromUrl } from "../identity/handle-resolver";

export type SupportedSocialProfilePlatform =
  | "facebook"
  | "github"
  | "instagram"
  | "linkedin"
  | "primal"
  | "x"
  | "youtube";
export type SocialProfileMetricField = "followersCount" | "followingCount" | "subscribersCount";
export type SocialProfileMetricRawField =
  | "followersCountRaw"
  | "followingCountRaw"
  | "subscribersCountRaw";
export type SocialProfileMetadataField =
  | "profileImage"
  | SocialProfileMetricField
  | SocialProfileMetricRawField;
export type ExpectedSocialProfileField = "profileImage" | SocialProfileMetricField;

export interface SocialProfileMetadataFields {
  profileImage?: string;
  followersCount?: number;
  followersCountRaw?: string;
  followingCount?: number;
  followingCountRaw?: string;
  subscribersCount?: number;
  subscribersCountRaw?: string;
}

export interface SupportedSocialProfileTarget {
  platform: SupportedSocialProfilePlatform;
  handle: string;
  expectedFields: readonly ExpectedSocialProfileField[];
}

export interface SocialProfileMetadataLike extends SocialProfileMetadataFields {
  image?: string;
}

const EXPECTED_SOCIAL_PROFILE_FIELDS_BY_PLATFORM = {
  facebook: ["profileImage"],
  github: ["profileImage", "followersCount", "followingCount"],
  instagram: ["profileImage", "followersCount", "followingCount"],
  linkedin: ["profileImage"],
  primal: ["profileImage"],
  x: ["profileImage"],
  youtube: ["profileImage", "subscribersCount"],
} as const satisfies Record<SupportedSocialProfilePlatform, readonly ExpectedSocialProfileField[]>;

export const SOCIAL_PROFILE_METADATA_FIELDS = [
  "profileImage",
  "followersCount",
  "followersCountRaw",
  "followingCount",
  "followingCountRaw",
  "subscribersCount",
  "subscribersCountRaw",
] as const satisfies readonly SocialProfileMetadataField[];

const hasDefinedProfileValue = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== undefined;
};

const hasMetricValue = (
  metadata: SocialProfileMetadataLike,
  field: SocialProfileMetricField,
): boolean => {
  if (hasDefinedProfileValue(metadata[field])) {
    return true;
  }

  const rawField = `${field}Raw` as SocialProfileMetricRawField;
  return hasDefinedProfileValue(metadata[rawField]);
};

export const mergeMetadataWithManualSocialProfileOverrides = <T extends object>(
  manual: T | undefined,
  generated: T | undefined,
): T | undefined => {
  if (!manual && !generated) {
    return undefined;
  }

  const merged = {
    ...(manual ?? {}),
    ...(generated ?? {}),
  } as T;

  if (!manual) {
    return merged;
  }

  const mergedRecord = merged as Record<string, unknown>;
  const manualRecord = manual as Record<string, unknown>;

  for (const field of SOCIAL_PROFILE_METADATA_FIELDS) {
    const value = manualRecord[field];
    if (hasDefinedProfileValue(value)) {
      mergedRecord[field] = value;
    }
  }

  return merged;
};

export const normalizeSupportedSocialProfileMetadata = <T extends SocialProfileMetadataLike>(
  metadata: T | undefined,
  target: SupportedSocialProfileTarget | null | undefined,
): T | undefined => {
  if (!metadata || !target) {
    return metadata;
  }

  if (hasDefinedProfileValue(metadata.profileImage)) {
    return metadata;
  }

  if (!hasDefinedProfileValue(metadata.image)) {
    return metadata;
  }

  return {
    ...metadata,
    profileImage: metadata.image,
  } as T;
};

export const resolveSupportedSocialProfile = (input: {
  url?: string;
  icon?: string;
}): SupportedSocialProfileTarget | null => {
  const resolution = resolveHandleFromUrl(input);
  if (resolution.reason !== "resolved" || !resolution.handle) {
    return null;
  }

  if (
    resolution.extractorId !== "facebook" &&
    resolution.extractorId !== "github" &&
    resolution.extractorId !== "instagram" &&
    resolution.extractorId !== "linkedin" &&
    resolution.extractorId !== "primal" &&
    resolution.extractorId !== "x" &&
    resolution.extractorId !== "youtube"
  ) {
    return null;
  }

  return {
    platform: resolution.extractorId,
    handle: resolution.handle,
    expectedFields: EXPECTED_SOCIAL_PROFILE_FIELDS_BY_PLATFORM[resolution.extractorId],
  };
};

export const resolveMissingSupportedSocialProfileFields = (
  metadata: SocialProfileMetadataLike | undefined,
  target: SupportedSocialProfileTarget,
): ExpectedSocialProfileField[] => {
  const resolvedMetadata = normalizeSupportedSocialProfileMetadata(metadata ?? {}, target) ?? {};
  const missing: ExpectedSocialProfileField[] = [];

  for (const field of target.expectedFields) {
    if (field === "profileImage") {
      if (!hasDefinedProfileValue(resolvedMetadata.profileImage)) {
        missing.push(field);
      }
      continue;
    }

    if (!hasMetricValue(resolvedMetadata, field)) {
      missing.push(field);
    }
  }

  return missing;
};
