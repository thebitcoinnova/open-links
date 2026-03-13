import { For, Show } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";
import { IconAnalytics, IconCopy, IconShare } from "../../lib/icons/custom-icons";
import { copyLink, resolveDocumentShareUrl, shareLink } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";

export interface ProfileHeaderProps {
  profile: ProfileData;
  analyticsActive?: boolean;
  analyticsAvailable?: boolean;
  onAnalyticsToggle?: () => void;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const analyticsActive = () => props.analyticsActive ?? false;
  const analyticsAvailable = () => props.analyticsAvailable ?? false;
  const richness = () => props.richness ?? "standard";
  const contacts = () => orderedContactEntries(props.profile.contact);

  const handleShareProfile = async () => {
    showActionToast(
      await shareLink({
        copiedMessage: `${props.profile.name} link shared`,
        failedMessage: `Could not share ${props.profile.name}`,
        mode: "url-only",
        sharedMessage: `${props.profile.name} link shared`,
        text: props.profile.headline,
        title: props.profile.name,
        url: resolveDocumentShareUrl(),
      }),
    );
  };

  const handleCopyProfileLink = async () => {
    showActionToast(
      await copyLink({
        copiedMessage: "Profile link copied",
        failedMessage: "Could not copy profile link",
        url: resolveDocumentShareUrl(),
      }),
    );
  };

  return (
    <section class="profile-header" aria-label="Profile">
      <Show when={props.profile.avatar && richness() !== "minimal"}>
        <img class="profile-avatar" src={props.profile.avatar} alt="" loading="lazy" />
      </Show>

      <div class="profile-copy">
        <div class="profile-actions" aria-label="Profile sharing actions">
          <div class="profile-title-row">
            <h1>{props.profile.name}</h1>
            <Show when={analyticsAvailable() && props.onAnalyticsToggle}>
              <button
                type="button"
                class="profile-analytics-button"
                data-active={analyticsActive() ? "true" : "false"}
                aria-label={analyticsActive() ? "Back to links" : "View follower analytics"}
                title={analyticsActive() ? "Back to links" : "View follower analytics"}
                onClick={() => props.onAnalyticsToggle?.()}
              >
                <IconAnalytics class="profile-action-button-icon" aria-hidden="true" />
              </button>
            </Show>
            <span class="profile-sharing-actions">
              <button
                type="button"
                class="profile-share-button"
                aria-label="Share profile"
                title="Share profile"
                onClick={() => handleShareProfile()}
              >
                <IconShare class="profile-action-button-icon" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="profile-copy-button"
                aria-label="Copy profile link"
                title="Copy profile link"
                onClick={() => handleCopyProfileLink()}
              >
                <IconCopy class="profile-action-button-icon" aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>

        <Show when={props.profile.headline}>
          <p class="profile-headline">{props.profile.headline}</p>
        </Show>
        <Show when={props.profile.bio && richness() !== "minimal"}>
          <p class="profile-bio">{props.profile.bio}</p>
        </Show>

        <Show when={richness() === "rich"}>
          <ul class="profile-meta">
            <Show when={props.profile.location}>
              <li>Location: {props.profile.location}</li>
            </Show>
            <Show when={props.profile.pronouns}>
              <li>Pronouns: {props.profile.pronouns}</li>
            </Show>
            <Show when={props.profile.status}>
              <li>Status: {props.profile.status}</li>
            </Show>
          </ul>
        </Show>

        <Show when={richness() === "rich" && contacts().length > 0}>
          <ul class="profile-contact-list">
            <For each={contacts()}>
              {([key, value]) => (
                <li>
                  <span>{key}</span>
                  <span>{value}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </section>
  );
};

export default ProfileHeader;
