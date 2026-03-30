export const UPSTREAM_REPOSITORY_HOMEPAGE = "https://openlinks.us/";

export const buildDefaultForkRepositoryHomepage = (owner: string, repo: string): string =>
  `https://${owner}.github.io/${repo}/`;

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeComparableUrl = (value: string | null | undefined): string | null =>
  normalizeUrl(value)?.replace(/\/+$/u, "") ?? null;

export const shouldReplaceInheritedRepositoryHomepage = (
  homepageUrl: string | null | undefined,
) => {
  const normalized = normalizeComparableUrl(homepageUrl);
  return normalized === null || normalized === normalizeComparableUrl(UPSTREAM_REPOSITORY_HOMEPAGE);
};

export const resolveRepositoryHomepageUpdate = (input: {
  currentHomepageUrl?: string | null;
  fallbackForkHomepageUrl: string;
  preferredPrimaryHomepageUrl?: string | null;
}): string | null => {
  const preferred = normalizeUrl(input.preferredPrimaryHomepageUrl);
  const currentComparable = normalizeComparableUrl(input.currentHomepageUrl);
  const preferredComparable = normalizeComparableUrl(preferred);

  if (preferred) {
    if (shouldReplaceInheritedRepositoryHomepage(input.currentHomepageUrl)) {
      return preferred;
    }

    if (currentComparable === preferredComparable) {
      return null;
    }

    return null;
  }

  if (shouldReplaceInheritedRepositoryHomepage(input.currentHomepageUrl)) {
    return normalizeUrl(input.fallbackForkHomepageUrl);
  }

  return null;
};
