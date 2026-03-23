import { For, Show } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";
import { copyLink, resolveDocumentShareUrl, shareLink } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";
import BottomActionBar, { type BottomActionBarItem } from "../actions/BottomActionBar";

export interface ProfileHeaderProps {
  profile: ProfileData;
  analyticsActive?: boolean;
  analyticsAvailable?: boolean;
  onAnalyticsToggle?: () => void;
  onProfileQrOpen?: (payload: string) => void;
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

  const handleOpenProfileQr = () => {
    props.onProfileQrOpen?.(resolveDocumentShareUrl());
  };

  const actionItems = (): BottomActionBarItem[] => {
    const items: BottomActionBarItem[] = [];

    if ((analyticsAvailable() || analyticsActive()) && props.onAnalyticsToggle) {
      items.push({
        active: analyticsActive(),
        ariaLabel: analyticsActive() ? "Back to links" : "View follower analytics",
        kind: "analytics",
        label: analyticsActive() ? "Back" : "Stats",
        onClick: () => props.onAnalyticsToggle?.(),
        title: analyticsActive() ? "Back to links" : "View follower analytics",
      });
    }

    if (props.onProfileQrOpen) {
      items.push({
        ariaLabel: "Show profile QR code",
        kind: "qr",
        label: "QR",
        onClick: handleOpenProfileQr,
        title: "Show profile QR code",
      });
    }

    items.push(
      {
        ariaLabel: "Share profile",
        kind: "share",
        label: "Share",
        onClick: async () => {
          await handleShareProfile();
        },
        title: "Share profile",
      },
      {
        ariaLabel: "Copy profile link",
        kind: "copy",
        label: "Copy",
        onClick: async () => {
          await handleCopyProfileLink();
        },
        title: "Copy profile link",
      },
    );

    return items;
  };

  return (
    <section class="profile-header" aria-label="Profile">
      <Show when={props.profile.avatar && richness() !== "minimal"}>
        <img class="profile-avatar" src={props.profile.avatar} alt="" loading="lazy" />
      </Show>

      <div class="profile-copy">
        <div class="profile-title-row">
          <h1>{props.profile.name}</h1>
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
                <li class="profile-contact-item">
                  <span class="profile-contact-key">{key}</span>
                  <span class="profile-contact-value">{value}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <BottomActionBar
          class="profile-action-bar"
          items={actionItems()}
          label="Profile sharing actions"
        />
      </div>
    </section>
  );
};

export default ProfileHeader;
