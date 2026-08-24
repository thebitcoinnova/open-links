export interface LinktreeAccountRecord {
  pageTitle?: unknown;
  description?: unknown;
  profilePictureUrl?: unknown;
  socialLinks?: unknown;
}

export interface LinktreeContentLinkRecord {
  title?: unknown;
  url?: unknown;
  position?: unknown;
  type?: unknown;
  thumbnail?: unknown;
  metaData?: unknown;
  locked?: unknown;
}

export interface LinktreeNextDataPageProps {
  account?: LinktreeAccountRecord;
  links?: LinktreeContentLinkRecord[];
}

export interface LinktreeNextDataPayload {
  props?: { pageProps?: LinktreeNextDataPageProps };
}

export interface LinktreeBootstrapLink {
  label: string;
  url: string;
  sourceOrder: number;
  linktreeType?: string;
  thumbnailUrl?: string;
}

export interface LinktreeBootstrapProfile {
  name?: string;
  bio?: string;
  avatar?: string;
  socialLinks: LinktreeBootstrapLink[];
}

export interface LinktreeBootstrapSnapshot {
  kind: "linktree";
  sourceUrl: string;
  fetchedUrl: string;
  title?: string;
  description?: string;
  avatar?: string;
  linkCount: number;
  socialLinkCount: number;
  links: Array<{
    label: string;
    url: string;
    linktreeType?: string;
    thumbnailUrl?: string;
  }>;
  socialLinks: Array<{ label: string; url: string; linktreeType?: string }>;
  warnings: string[];
}

export interface LinktreeBootstrapResult {
  kind: "linktree";
  sourceUrl: string;
  fetchedUrl: string;
  profile: LinktreeBootstrapProfile;
  links: LinktreeBootstrapLink[];
  snapshot: LinktreeBootstrapSnapshot;
  warnings: string[];
}

export interface ParseLinktreeBootstrapHtmlInput {
  sourceUrl: string;
  fetchedUrl?: string;
  html: string;
}

export interface FetchLinktreeBootstrapInput {
  sourceUrl: string;
  timeoutMs?: number;
  retries?: number;
}
