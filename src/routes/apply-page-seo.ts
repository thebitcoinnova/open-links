import type { ProfileData, SiteData } from "../lib/content/load-content";
import { resolveGeneratedContentImageUrl } from "../lib/content/load-content";
import {
  resolveBaseAwareAssetPath,
  resolveBasePathFromUrl,
  resolveSeoMetadata,
} from "../lib/seo/resolve-seo-metadata";

const ensureMetaTag = (attr: "name" | "property", key: string, contentValue: string) => {
  const selector = `meta[${attr}="${key}"]`;
  let maybeMeta = document.head.querySelector<HTMLMetaElement>(selector);

  if (!maybeMeta) {
    maybeMeta = document.createElement("meta");
    maybeMeta.setAttribute(attr, key);
    document.head.appendChild(maybeMeta);
  }

  maybeMeta.setAttribute("content", contentValue);
};

const ensureCanonical = (href: string) => {
  let maybeLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!maybeLink) {
    maybeLink = document.createElement("link");
    maybeLink.setAttribute("rel", "canonical");
    document.head.appendChild(maybeLink);
  }

  maybeLink.setAttribute("href", href);
};

export const applyPageSeoMetadata = (input: {
  canonicalOrigin: string;
  profile: ProfileData;
  site: SiteData;
}) => {
  const canonicalBaseUrl =
    input.canonicalOrigin.trim().length > 0
      ? input.canonicalOrigin
      : input.site.quality?.seo?.canonicalBaseUrl;
  const seoSite =
    canonicalBaseUrl && canonicalBaseUrl !== input.site.quality?.seo?.canonicalBaseUrl
      ? {
          ...input.site,
          quality: {
            ...input.site.quality,
            seo: {
              ...input.site.quality?.seo,
              canonicalBaseUrl,
            },
          },
        }
      : input.site;
  const { metadata } = resolveSeoMetadata(seoSite, input.profile, {
    fallbackOrigin: window.location.origin,
    resolveImagePath: (candidate, context) => {
      const maybeResolved = resolveGeneratedContentImageUrl({
        candidate,
        slotId: context.slotId,
      });
      if (!maybeResolved) {
        return undefined;
      }

      return resolveBaseAwareAssetPath(maybeResolved, resolveBasePathFromUrl(canonicalBaseUrl));
    },
  });

  document.title = metadata.title;
  ensureCanonical(metadata.canonical);
  ensureMetaTag("name", "description", metadata.description);
  ensureMetaTag("property", "og:title", metadata.ogTitle);
  ensureMetaTag("property", "og:description", metadata.ogDescription);
  ensureMetaTag("property", "og:type", metadata.ogType);
  ensureMetaTag("property", "og:url", metadata.ogUrl);
  ensureMetaTag("property", "og:image", metadata.ogImage);
  ensureMetaTag("name", "twitter:card", metadata.twitterCard);
  ensureMetaTag("name", "twitter:title", metadata.twitterTitle);
  ensureMetaTag("name", "twitter:description", metadata.twitterDescription);
  ensureMetaTag("name", "twitter:image", metadata.twitterImage);
};
