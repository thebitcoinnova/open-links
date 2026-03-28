import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { SupportedSocialProfilePlatform } from "../../lib/content/social-profile-fields";
import { resolveKnownSiteIcon } from "../../lib/icons/known-site-icons";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";

export interface ProfileQuickLinksProps {
  quickLinks?: ResolvedProfileQuickLinksState;
}

const stripListStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-wrap": "wrap",
  gap: "0.55rem",
  "justify-content": "center",
  margin: "0",
  padding: "0",
  "list-style": "none",
};

const stripLinkStyle: JSX.CSSProperties = {
  "--profile-quick-link-box-size": "2.3rem",
  "--profile-quick-link-glyph-size": "1.05rem",
  display: "inline-grid",
  width: "var(--profile-quick-link-box-size)",
  height: "var(--profile-quick-link-box-size)",
  "place-items": "center",
  color: "var(--text-primary)",
  "text-decoration": "none",
};

const stripIconStyle: JSX.CSSProperties = {
  width: "var(--profile-quick-link-box-size)",
  height: "var(--profile-quick-link-box-size)",
  display: "inline-grid",
  "place-items": "center",
  "border-radius": "999px",
  background: "color-mix(in srgb, var(--surface-pill) 82%, transparent 18%)",
  color: "color-mix(in srgb, var(--text-primary) 88%, var(--accent) 12%)",
  "box-shadow": "0 10px 24px color-mix(in srgb, var(--accent) 8%, transparent)",
};

const stripGlyphStyle: JSX.CSSProperties = {
  width: "var(--profile-quick-link-glyph-size)",
  height: "var(--profile-quick-link-glyph-size)",
};

const resolveQuickLinkIcon = (platform: SupportedSocialProfilePlatform) => {
  if (platform === "rumble") {
    return undefined;
  }

  return resolveKnownSiteIcon(platform);
};

export const ProfileQuickLinks = (props: ProfileQuickLinksProps) => (
  <Show when={props.quickLinks?.hasAny && (props.quickLinks?.items.length ?? 0) > 0}>
    <nav class="profile-quick-links" aria-label="Social quick links">
      <ul class="profile-quick-links-list" style={stripListStyle}>
        <For each={props.quickLinks?.items ?? []}>
          {(item) => {
            const IconComponent = resolveQuickLinkIcon(item.platform);

            return (
              <li class="profile-quick-links-item">
                <a
                  class="profile-quick-links-link"
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  style={stripLinkStyle}
                >
                  <span class="sr-only">{item.label}</span>
                  <span class="profile-quick-links-icon" aria-hidden="true" style={stripIconStyle}>
                    {IconComponent ? (
                      <IconComponent style={stripGlyphStyle} />
                    ) : (
                      <span style={stripGlyphStyle}>{item.label.charAt(0)}</span>
                    )}
                  </span>
                </a>
              </li>
            );
          }}
        </For>
      </ul>
    </nav>
  </Show>
);

export default ProfileQuickLinks;
