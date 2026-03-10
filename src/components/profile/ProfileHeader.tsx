import { For, Show, createSignal, onCleanup } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";
import { IconAnalytics, IconShare } from "../../lib/icons/custom-icons";
import { resolveDocumentShareUrl, shareLink } from "../../lib/share/share-link";

export interface ProfileHeaderProps {
  profile: ProfileData;
  analyticsActive?: boolean;
  analyticsAvailable?: boolean;
  onAnalyticsToggle?: () => void;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

const STATUS_RESET_DELAY_MS = 3000;

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const analyticsActive = () => props.analyticsActive ?? false;
  const analyticsAvailable = () => props.analyticsAvailable ?? false;
  const richness = () => props.richness ?? "standard";
  const contacts = () => orderedContactEntries(props.profile.contact);
  const [shareStatus, setShareStatus] = createSignal("");
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const setTimedShareStatus = (message: string) => {
    setShareStatus(message);
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
    resetTimer = setTimeout(() => setShareStatus(""), STATUS_RESET_DELAY_MS);
  };

  const handleShareProfile = async () => {
    const result = await shareLink({
      mode: "url-only",
      text: props.profile.headline,
      title: props.profile.name,
      url: resolveDocumentShareUrl(),
    });

    if (result.status !== "dismissed") {
      setTimedShareStatus(result.message);
    }
  };

  onCleanup(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
    }
  });

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
            <button
              type="button"
              class="profile-share-button"
              aria-label="Share profile"
              title="Share profile"
              onClick={() => handleShareProfile()}
            >
              <IconShare class="profile-action-button-icon" aria-hidden="true" />
            </button>
          </div>
          <Show when={shareStatus()}>
            <output class="profile-share-status" aria-live="polite">
              {shareStatus()}
            </output>
          </Show>
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
