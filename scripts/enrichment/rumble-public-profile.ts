import { resolveHandleFromUrl } from "../../src/lib/identity/handle-resolver";
import {
  attributeMap,
  decodeEntities,
  detectPlaceholderSignals,
  resolveCompleteness,
  safeTrim,
  toAbsoluteUrl,
  toSourceLabel,
} from "./document-primitives";
import { parseMetadata } from "./parse-metadata";
import { parseAudienceCount } from "./social-profile-counts";
import type { NormalizedEnrichmentResult } from "./strategy-types";

const RUMBLE_PLACEHOLDER_RULES = [
  { label: "rumble_410_gone", pattern: /<title>\s*410 Gone\s*<\/title>|>\s*410 Gone\s*</i },
  {
    label: "rumble_not_found",
    pattern: /<title>\s*404\b[^<]*<\/title>|this page is unavailable|page not found/i,
  },
] as const;

const stripHtml = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  const withoutTags = value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
  return safeTrim(withoutTags.replace(/\s+/g, " "));
};

const CLASS_ATTR_PATTERN = String.raw`class=(?:"[^"]*\b%s\b[^"]*"|'[^']*\b%s\b[^']*'|[^\s>]*\b%s\b[^\s>]*)`;

const extractRumbleProfileImage = (html: string, sourceUrl: string): string | undefined => {
  for (const match of html.matchAll(/<img\s+[^>]*>/gi)) {
    const tag = match[0] ?? "";
    const attrs = attributeMap(tag);
    const classes = attrs.class?.split(/\s+/).filter(Boolean) ?? [];
    if (!classes.includes("channel-header--img")) {
      continue;
    }

    return toAbsoluteUrl(attrs.src, sourceUrl);
  }

  return undefined;
};

const extractRumbleFollowersCountRaw = (html: string): string | undefined => {
  const headerPattern = new RegExp(
    `<div[^>]*${CLASS_ATTR_PATTERN.replaceAll("%s", "channel-header--title")}[^>]*>[\\s\\S]{0,2500}?<span[^>]*>\\s*([^<]*?\\bFollowers\\b)\\s*<\\/span>`,
    "i",
  );
  const match = html.match(headerPattern);
  return safeTrim(match?.[1]);
};

const extractRumbleProfileDescription = (html: string): string | undefined => {
  const descriptionPattern = new RegExp(
    `<div[^>]*${CLASS_ATTR_PATTERN.replaceAll("%s", "channel-about--description")}[^>]*>[\\s\\S]{0,8000}?<p[^>]*>([\\s\\S]*?)<\\/p>`,
    "i",
  );
  const match = html.match(descriptionPattern);
  return stripHtml(match?.[1]);
};

export const resolveRumbleAboutUrl = (sourceUrl: string): string => {
  const parsed = new URL(sourceUrl);
  const segments = parsed.pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "";

  if (first === "user" || first === "c") {
    const rawHandle = segments[1];
    if (!rawHandle) {
      throw new Error(`Rumble public augmentation requires a profile handle in '${sourceUrl}'.`);
    }

    return new URL(`/${first}/${rawHandle}/about`, parsed.origin).toString();
  }

  if (!first) {
    throw new Error(`Rumble public augmentation only supports profile URLs. Got '${sourceUrl}'.`);
  }

  return new URL(`/${first}/about`, parsed.origin).toString();
};

export const parseRumblePublicProfile = (
  sourceUrl: string,
  html: string,
): NormalizedEnrichmentResult => {
  const parsed = parseMetadata(html, sourceUrl);
  const title = safeTrim(parsed.metadata.title);
  const genericDescription = safeTrim(parsed.metadata.description);
  const profileDescription = extractRumbleProfileDescription(html);
  const ogImage = safeTrim(parsed.metadata.ogImage);
  const twitterImage = safeTrim(parsed.metadata.twitterImage);
  const profileImage = extractRumbleProfileImage(html, sourceUrl);
  const image = safeTrim(parsed.metadata.image) ?? profileImage;
  const followersCountRaw = extractRumbleFollowersCountRaw(html);
  const placeholderSignals = detectPlaceholderSignals(
    `${title ?? ""}\n${genericDescription ?? ""}\n${html}`,
    [...RUMBLE_PLACEHOLDER_RULES],
  );

  if (placeholderSignals.length > 0) {
    throw new Error(
      `Rumble public augmentation captured placeholder content: ${placeholderSignals.join(", ")}.`,
    );
  }

  const handleResolution = resolveHandleFromUrl({ url: sourceUrl });
  const description = genericDescription ?? profileDescription;

  return resolveCompleteness({
    title,
    description,
    profileDescription,
    image,
    ogImage,
    twitterImage,
    profileImage,
    handle: handleResolution.reason === "resolved" ? handleResolution.handle : undefined,
    followersCount: parseAudienceCount(followersCountRaw),
    followersCountRaw: followersCountRaw ? decodeEntities(followersCountRaw) : undefined,
    sourceLabel: toSourceLabel(sourceUrl),
  });
};
