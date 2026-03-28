import { type Component, For } from "solid-js";
import type { KnownSiteId } from "./known-sites-data";
import { type SiteIconGraphic, resolveKnownSiteGraphic } from "./site-icon-graphics";

export type KnownSiteIconComponent = Component<Record<string, unknown>>;

const createGraphicIcon = (graphic: SiteIconGraphic): KnownSiteIconComponent => {
  return (props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={graphic.viewBox}
      fill="currentColor"
      stroke="none"
      {...props}
    >
      <title>{graphic.title}</title>
      <For each={graphic.paths}>
        {(path) =>
          typeof path === "string" ? (
            <path d={path} />
          ) : (
            <path d={path.d} fill-rule={path.fillRule} clip-rule={path.clipRule} />
          )
        }
      </For>
    </svg>
  );
};

const knownSiteIcons = {} as Record<KnownSiteId, KnownSiteIconComponent>;

for (const siteId of [
  "github",
  "linkedin",
  "x",
  "twitter",
  "youtube",
  "instagram",
  "facebook",
  "tiktok",
  "reddit",
  "discord",
  "threads",
  "bluesky",
  "mastodon",
  "cluborange",
  "primal",
  "rumble",
  "twitch",
  "snapchat",
  "pinterest",
  "tumblr",
  "vimeo",
  "spotify",
  "soundcloud",
  "telegram",
  "whatsapp",
  "wechat",
  "line",
  "messenger",
  "skype",
  "slack",
  "gitlab",
  "bitbucket",
  "stackoverflow",
  "codepen",
  "producthunt",
  "dribbble",
  "behance",
  "figma",
  "medium",
  "notion",
  "npm",
  "pnpm",
  "yarn",
  "docker",
  "linktree",
  "patreon",
  "kofi",
  "paypal",
  "cashapp",
  "stripe",
  "strike",
  "coinbase",
  "bitcoin",
  "lightning",
  "ethereum",
  "solana",
  "wallet",
  "substack",
  "google",
  "openai",
] as const satisfies readonly KnownSiteId[]) {
  knownSiteIcons[siteId] = createGraphicIcon(resolveKnownSiteGraphic(siteId));
}

export const resolveKnownSiteIcon = (siteId: KnownSiteId): KnownSiteIconComponent =>
  knownSiteIcons[siteId];
