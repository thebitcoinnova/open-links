export interface KnownSiteDefinition {
  id: string;
  label: string;
  aliases: readonly string[];
  domains: readonly string[];
  brandColor: string;
}

export const normalizeKnownSiteAlias = (value: string): string => value.trim().toLowerCase();

const normalizeHost = (value: string): string =>
  normalizeKnownSiteAlias(value).replace(/^www\./, "");

export const KNOWN_SITES = [
  {
    id: "github",
    label: "GitHub",
    aliases: ["github", "gh"],
    domains: ["github.com", "gist.github.com"],
    brandColor: "#181717",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    aliases: ["linkedin", "li"],
    domains: ["linkedin.com", "lnkd.in"],
    brandColor: "#0A66C2",
  },
  {
    id: "x",
    label: "X",
    aliases: ["x", "x-twitter", "xtwitter"],
    domains: ["x.com", "twitter.com", "t.co"],
    brandColor: "#000000",
  },
  {
    id: "twitter",
    label: "Twitter",
    aliases: ["twitter"],
    domains: [],
    brandColor: "#1D9BF0",
  },
  {
    id: "youtube",
    label: "YouTube",
    aliases: ["youtube", "yt"],
    domains: ["youtube.com", "youtu.be"],
    brandColor: "#FF0000",
  },
  {
    id: "instagram",
    label: "Instagram",
    aliases: ["instagram", "ig"],
    domains: ["instagram.com"],
    brandColor: "#E4405F",
  },
  {
    id: "facebook",
    label: "Facebook",
    aliases: ["facebook", "fb"],
    domains: ["facebook.com", "fb.com"],
    brandColor: "#1877F2",
  },
  {
    id: "tiktok",
    label: "TikTok",
    aliases: ["tiktok"],
    domains: ["tiktok.com"],
    brandColor: "#000000",
  },
  {
    id: "reddit",
    label: "Reddit",
    aliases: ["reddit"],
    domains: ["reddit.com", "redd.it"],
    brandColor: "#FF4500",
  },
  {
    id: "discord",
    label: "Discord",
    aliases: ["discord"],
    domains: ["discord.com", "discord.gg"],
    brandColor: "#5865F2",
  },
  {
    id: "threads",
    label: "Threads",
    aliases: ["threads"],
    domains: ["threads.net"],
    brandColor: "#000000",
  },
  {
    id: "bluesky",
    label: "Bluesky",
    aliases: ["bluesky", "bsky"],
    domains: ["bsky.app"],
    brandColor: "#0285FF",
  },
  {
    id: "mastodon",
    label: "Mastodon",
    aliases: ["mastodon"],
    domains: ["mastodon.social"],
    brandColor: "#6364FF",
  },
  {
    id: "cluborange",
    label: "Club Orange",
    aliases: ["cluborange", "club-orange", "club orange", "orangepillapp", "orange-pill-app"],
    domains: ["cluborange.org"],
    brandColor: "#E86B10",
  },
  {
    id: "primal",
    label: "Primal",
    aliases: ["primal", "primalnet"],
    domains: ["primal.net"],
    brandColor: "#3861E4",
  },
  {
    id: "twitch",
    label: "Twitch",
    aliases: ["twitch"],
    domains: ["twitch.tv"],
    brandColor: "#9146FF",
  },
  {
    id: "snapchat",
    label: "Snapchat",
    aliases: ["snapchat"],
    domains: ["snapchat.com"],
    brandColor: "#FFFC00",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    aliases: ["pinterest"],
    domains: ["pinterest.com", "pin.it"],
    brandColor: "#E60023",
  },
  {
    id: "tumblr",
    label: "Tumblr",
    aliases: ["tumblr"],
    domains: ["tumblr.com"],
    brandColor: "#36465D",
  },
  {
    id: "vimeo",
    label: "Vimeo",
    aliases: ["vimeo"],
    domains: ["vimeo.com"],
    brandColor: "#1AB7EA",
  },
  {
    id: "spotify",
    label: "Spotify",
    aliases: ["spotify"],
    domains: ["spotify.com", "open.spotify.com"],
    brandColor: "#1DB954",
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    aliases: ["soundcloud"],
    domains: ["soundcloud.com"],
    brandColor: "#FF5500",
  },
  {
    id: "telegram",
    label: "Telegram",
    aliases: ["telegram"],
    domains: ["telegram.me", "t.me", "telegram.org"],
    brandColor: "#26A5E4",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    aliases: ["whatsapp", "wa"],
    domains: ["whatsapp.com", "wa.me"],
    brandColor: "#25D366",
  },
  {
    id: "wechat",
    label: "WeChat",
    aliases: ["wechat", "weixin"],
    domains: ["wechat.com", "weixin.qq.com"],
    brandColor: "#07C160",
  },
  {
    id: "line",
    label: "LINE",
    aliases: ["line"],
    domains: ["line.me"],
    brandColor: "#06C755",
  },
  {
    id: "messenger",
    label: "Messenger",
    aliases: ["messenger"],
    domains: ["messenger.com", "m.me"],
    brandColor: "#00B2FF",
  },
  {
    id: "skype",
    label: "Skype",
    aliases: ["skype"],
    domains: ["skype.com"],
    brandColor: "#00AFF0",
  },
  {
    id: "slack",
    label: "Slack",
    aliases: ["slack"],
    domains: ["slack.com"],
    brandColor: "#4A154B",
  },
  {
    id: "gitlab",
    label: "GitLab",
    aliases: ["gitlab"],
    domains: ["gitlab.com"],
    brandColor: "#FC6D26",
  },
  {
    id: "bitbucket",
    label: "Bitbucket",
    aliases: ["bitbucket"],
    domains: ["bitbucket.org"],
    brandColor: "#0052CC",
  },
  {
    id: "stackoverflow",
    label: "Stack Overflow",
    aliases: ["stackoverflow", "stack-overflow"],
    domains: ["stackoverflow.com", "stackexchange.com"],
    brandColor: "#F48024",
  },
  {
    id: "codepen",
    label: "CodePen",
    aliases: ["codepen"],
    domains: ["codepen.io"],
    brandColor: "#000000",
  },
  {
    id: "producthunt",
    label: "Product Hunt",
    aliases: ["producthunt", "ph"],
    domains: ["producthunt.com"],
    brandColor: "#DA552F",
  },
  {
    id: "dribbble",
    label: "Dribbble",
    aliases: ["dribbble"],
    domains: ["dribbble.com"],
    brandColor: "#EA4C89",
  },
  {
    id: "behance",
    label: "Behance",
    aliases: ["behance"],
    domains: ["behance.net"],
    brandColor: "#1769FF",
  },
  {
    id: "figma",
    label: "Figma",
    aliases: ["figma"],
    domains: ["figma.com"],
    brandColor: "#F24E1E",
  },
  {
    id: "medium",
    label: "Medium",
    aliases: ["medium"],
    domains: ["medium.com"],
    brandColor: "#12100E",
  },
  {
    id: "notion",
    label: "Notion",
    aliases: ["notion"],
    domains: ["notion.so", "notion.site"],
    brandColor: "#000000",
  },
  {
    id: "npm",
    label: "npm",
    aliases: ["npm"],
    domains: ["npmjs.com"],
    brandColor: "#CB3837",
  },
  {
    id: "pnpm",
    label: "pnpm",
    aliases: ["pnpm"],
    domains: ["pnpm.io"],
    brandColor: "#F69220",
  },
  {
    id: "yarn",
    label: "Yarn",
    aliases: ["yarn"],
    domains: ["yarnpkg.com"],
    brandColor: "#2C8EBB",
  },
  {
    id: "docker",
    label: "Docker",
    aliases: ["docker"],
    domains: ["docker.com", "hub.docker.com"],
    brandColor: "#2496ED",
  },
  {
    id: "linktree",
    label: "Linktree",
    aliases: ["linktree"],
    domains: ["linktr.ee", "linktree.com"],
    brandColor: "#43E55E",
  },
  {
    id: "patreon",
    label: "Patreon",
    aliases: ["patreon"],
    domains: ["patreon.com"],
    brandColor: "#FF424D",
  },
  {
    id: "kofi",
    label: "Ko-fi",
    aliases: ["kofi", "ko-fi"],
    domains: ["ko-fi.com"],
    brandColor: "#29ABE0",
  },
  {
    id: "paypal",
    label: "PayPal",
    aliases: ["paypal", "pp"],
    domains: ["paypal.com", "paypal.me"],
    brandColor: "#003087",
  },
  {
    id: "cashapp",
    label: "Cash App",
    aliases: ["cashapp", "cash-app"],
    domains: ["cash.app", "cashapp.com"],
    brandColor: "#00D64B",
  },
  {
    id: "stripe",
    label: "Stripe",
    aliases: ["stripe"],
    domains: ["stripe.com", "buy.stripe.com"],
    brandColor: "#635BFF",
  },
  {
    id: "strike",
    label: "Strike",
    aliases: ["strike"],
    domains: ["strike.me"],
    brandColor: "#111111",
  },
  {
    id: "coinbase",
    label: "Coinbase",
    aliases: ["coinbase", "cb"],
    domains: ["coinbase.com", "commerce.coinbase.com"],
    brandColor: "#0052FF",
  },
  {
    id: "bitcoin",
    label: "Bitcoin",
    aliases: ["bitcoin", "btc"],
    domains: [],
    brandColor: "#F7931A",
  },
  {
    id: "lightning",
    label: "Lightning",
    aliases: ["lightning", "ln"],
    domains: [],
    brandColor: "#F2A900",
  },
  {
    id: "ethereum",
    label: "Ethereum",
    aliases: ["ethereum", "eth"],
    domains: [],
    brandColor: "#627EEA",
  },
  {
    id: "solana",
    label: "Solana",
    aliases: ["solana", "sol"],
    domains: [],
    brandColor: "#14F195",
  },
  {
    id: "wallet",
    label: "Wallet",
    aliases: ["wallet", "crypto"],
    domains: [],
    brandColor: "#6B7280",
  },
  {
    id: "substack",
    label: "Substack",
    aliases: ["substack"],
    domains: ["substack.com"],
    brandColor: "#FF6719",
  },
  {
    id: "google",
    label: "Google",
    aliases: ["google"],
    domains: ["google.com"],
    brandColor: "#4285F4",
  },
  {
    id: "openai",
    label: "OpenAI",
    aliases: ["openai"],
    domains: ["openai.com", "chatgpt.com"],
    brandColor: "#000000",
  },
] as const satisfies readonly KnownSiteDefinition[];

export type KnownSiteId = (typeof KNOWN_SITES)[number]["id"];
export type KnownSite = (typeof KNOWN_SITES)[number];
export type KnownSiteIconOverrides = Partial<Record<KnownSiteId, KnownSiteId>>;

const aliasLookup = new Map<string, KnownSite>();
const domainLookup = new Map<string, KnownSite>();
const normalizedDomains: Array<{ domain: string; site: KnownSite }> = [];
const idLookup = new Map<KnownSiteId, KnownSite>();

for (const site of KNOWN_SITES) {
  idLookup.set(site.id, site);

  for (const alias of site.aliases) {
    aliasLookup.set(normalizeKnownSiteAlias(alias), site);
  }

  for (const domain of site.domains) {
    const normalizedDomain = normalizeHost(domain);
    domainLookup.set(normalizedDomain, site);
    normalizedDomains.push({ domain: normalizedDomain, site });
  }
}

normalizedDomains.sort((left, right) => right.domain.length - left.domain.length);

export const KNOWN_SITE_ALIASES = new Set(aliasLookup.keys());

export const resolveKnownSiteFromIcon = (icon?: string): KnownSite | undefined => {
  if (!icon) {
    return undefined;
  }
  return aliasLookup.get(normalizeKnownSiteAlias(icon));
};

export const resolveKnownSiteById = (siteId: KnownSiteId): KnownSite | undefined =>
  idLookup.get(siteId);

export const resolveKnownSiteId = (value?: string): KnownSiteId | undefined =>
  resolveKnownSiteFromIcon(value)?.id;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const normalizeKnownSiteIconOverrides = (value: unknown): KnownSiteIconOverrides => {
  if (!isRecord(value)) {
    return {};
  }

  const normalized: KnownSiteIconOverrides = {};

  for (const [sourceAlias, targetAlias] of Object.entries(value)) {
    if (typeof targetAlias !== "string") {
      continue;
    }

    const sourceSiteId = resolveKnownSiteId(sourceAlias);
    const targetSiteId = resolveKnownSiteId(targetAlias);

    if (!sourceSiteId || !targetSiteId) {
      continue;
    }

    normalized[sourceSiteId] = targetSiteId;
  }

  return normalized;
};

const extractHost = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return undefined;
  }
};

export const resolveKnownSiteFromUrl = (url: string): KnownSite | undefined => {
  const host = extractHost(url);
  if (!host) {
    return undefined;
  }

  const exactMatch = domainLookup.get(host);
  if (exactMatch) {
    return exactMatch;
  }

  for (const entry of normalizedDomains) {
    if (host.endsWith(`.${entry.domain}`)) {
      return entry.site;
    }
  }

  return undefined;
};

export const resolveKnownSite = (icon?: string, url?: string): KnownSite | undefined => {
  const fromIcon = resolveKnownSiteFromIcon(icon);
  if (fromIcon) {
    return fromIcon;
  }

  if (!url) {
    return undefined;
  }

  return resolveKnownSiteFromUrl(url);
};
