export const DEFAULT_GITHUB_REPOSITORY_OWNER = "pRizz";
export const DEFAULT_GITHUB_REPOSITORY_NAME = "open-links";
export const DEFAULT_GITHUB_REPOSITORY_REF = "main";
export const DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG = `${DEFAULT_GITHUB_REPOSITORY_OWNER}/${DEFAULT_GITHUB_REPOSITORY_NAME}`;

const BARE_REPOSITORY_SLUG_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/u;
const SSH_REPOSITORY_SLUG_PATTERN =
  /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:\.git)?$/iu;
const INVALID_GIT_REF_CHARACTERS_PATTERN = /[\s\\~^:?*\[]/u;

export const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export function parseGitHubRepositorySlug(input: string) {
  const normalizedInput = input.trim();

  if (BARE_REPOSITORY_SLUG_PATTERN.test(normalizedInput)) {
    return normalizedInput.replace(/\.git$/u, "");
  }

  const sshMatch = normalizedInput.match(SSH_REPOSITORY_SLUG_PATTERN);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2].replace(/\.git$/u, "")}`;
  }

  const httpsSlug = parseGitHubRepositorySlugFromHttpsUrl(normalizedInput);
  if (httpsSlug) {
    return httpsSlug;
  }

  throw new Error(`Could not parse a GitHub repository slug from: ${input}`);
}

const parseGitHubRepositorySlugFromHttpsUrl = (input: string): string | undefined => {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      return undefined;
    }

    const match = url.pathname
      .replace(/\/+$/u, "")
      .match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+(?:\.git)?)$/u);
    if (!match) {
      return undefined;
    }

    return `${match[1]}/${match[2].replace(/\.git$/u, "")}`;
  } catch {
    return undefined;
  }
};

export const normalizeGitHubRepositorySlug = (maybeRepositorySlug?: string): string | undefined => {
  const trimmedRepositorySlug = trimToUndefined(maybeRepositorySlug);
  if (!trimmedRepositorySlug) {
    return undefined;
  }

  try {
    return parseGitHubRepositorySlug(trimmedRepositorySlug);
  } catch {
    return undefined;
  }
};

export const resolveGitHubRepositorySlug = (
  maybeRepositorySlug?: string,
  fallback = DEFAULT_UPSTREAM_GITHUB_REPOSITORY_SLUG,
): string => normalizeGitHubRepositorySlug(maybeRepositorySlug) ?? fallback;

export const normalizeGitHubRepositoryRef = (maybeRepositoryRef?: string): string | undefined => {
  const trimmedRepositoryRef = trimToUndefined(maybeRepositoryRef);
  if (!trimmedRepositoryRef) {
    return undefined;
  }

  if (trimmedRepositoryRef.startsWith("/") || trimmedRepositoryRef.endsWith("/")) {
    return undefined;
  }

  if (trimmedRepositoryRef.startsWith(".") || trimmedRepositoryRef.endsWith(".")) {
    return undefined;
  }

  if (trimmedRepositoryRef.includes("..") || trimmedRepositoryRef.includes("//")) {
    return undefined;
  }

  if (trimmedRepositoryRef.includes("@{") || trimmedRepositoryRef.endsWith(".lock")) {
    return undefined;
  }

  if (INVALID_GIT_REF_CHARACTERS_PATTERN.test(trimmedRepositoryRef)) {
    return undefined;
  }

  return trimmedRepositoryRef;
};

export const resolveGitHubRepositoryRef = (
  maybeRepositoryRef?: string,
  fallback = DEFAULT_GITHUB_REPOSITORY_REF,
): string => normalizeGitHubRepositoryRef(maybeRepositoryRef) ?? fallback;
