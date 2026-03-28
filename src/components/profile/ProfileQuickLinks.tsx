import { For, Show } from "solid-js";
import type { SupportedSocialProfilePlatform } from "../../lib/content/social-profile-fields";
import { resolveKnownSiteIcon } from "../../lib/icons/known-site-icons";
import type { ResolvedProfileQuickLinksState } from "../../lib/ui/profile-quick-links";

export interface ProfileQuickLinksProps {
  quickLinks?: ResolvedProfileQuickLinksState;
}

const resolveQuickLinkIcon = (platform: SupportedSocialProfilePlatform) => {
  if (platform === "rumble") {
    return undefined;
  }

  return resolveKnownSiteIcon(platform);
};

export const ProfileQuickLinks = (props: ProfileQuickLinksProps) => (
  <Show when={props.quickLinks?.hasAny && (props.quickLinks?.items.length ?? 0) > 0}>
    <nav class="profile-quick-links" aria-label="Social quick links">
      <div class="profile-quick-links-scroll">
        <ul class="profile-quick-links-list">
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
                  >
                    <span class="sr-only">{item.label}</span>
                    <span class="profile-quick-links-icon" aria-hidden="true">
                      {IconComponent ? (
                        <IconComponent class="profile-quick-links-glyph" />
                      ) : (
                        item.label.charAt(0)
                      )}
                    </span>
                  </a>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
    </nav>
  </Show>
);

export default ProfileQuickLinks;
