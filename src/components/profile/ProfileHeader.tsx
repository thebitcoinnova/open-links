import { For, Show } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";
import { copyLink, resolveDocumentShareUrl, shareLink } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";
import BottomActionBar, { type BottomActionBarItem } from "../actions/BottomActionBar";
import MobileOverflowMenu, { type MobileOverflowMenuAction } from "../actions/MobileOverflowMenu";

export interface ProfileHeaderProps {
  profile: ProfileData;
  onProfileQrOpen?: (payload: string) => void;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

export const ProfileHeader = (props: ProfileHeaderProps) => {
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
      ...(props.onProfileQrOpen
        ? [
            {
              ariaLabel: "Show profile QR code",
              kind: "qr" as const,
              label: "QR",
              onClick: handleOpenProfileQr,
              title: "Show profile QR code",
            },
          ]
        : []),
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
  const mobilePrimaryActionItems = (): BottomActionBarItem[] => {
    const items = actionItems();
    const shareAction = items.find((item) => item.kind === "share");
    const qrAction = items.find((item) => item.kind === "qr");
    const copyAction = items.find((item) => item.kind === "copy");

    if (qrAction) {
      return [shareAction, qrAction].filter(Boolean) as BottomActionBarItem[];
    }

    return [shareAction, copyAction].filter(Boolean) as BottomActionBarItem[];
  };
  const mobileOverflowActions = (): MobileOverflowMenuAction[] => {
    const primaryKinds = new Set(mobilePrimaryActionItems().map((item) => item.kind));

    return actionItems()
      .filter(
        (item): item is Extract<BottomActionBarItem, { onClick: () => void | Promise<void> }> =>
          "onClick" in item && !primaryKinds.has(item.kind),
      )
      .map((item) => ({
        label: item.label,
        onSelect: item.onClick,
      }));
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
          class="profile-action-bar profile-action-bar-desktop"
          items={actionItems()}
          label="Profile sharing actions"
        />
        <Show when={mobilePrimaryActionItems().length > 0}>
          <div class="bottom-action-bar profile-action-bar profile-action-bar-mobile">
            <For each={mobilePrimaryActionItems()}>
              {(item) => (
                <button
                  type="button"
                  class="bottom-action-bar-action"
                  data-kind={item.kind}
                  aria-label={item.ariaLabel}
                  title={item.title ?? item.ariaLabel}
                  onClick={() => {
                    if ("onClick" in item) {
                      void item.onClick();
                    }
                  }}
                >
                  <span class="profile-mobile-action-label">{item.label}</span>
                </button>
              )}
            </For>
            <MobileOverflowMenu
              actions={mobileOverflowActions()}
              class="bottom-action-bar-action mobile-overflow-menu-trigger"
              contentClass="mobile-overflow-menu-content profile-action-overflow-menu"
              itemClass="mobile-overflow-menu-item"
              label="More profile actions"
            />
          </div>
        </Show>
      </div>
    </section>
  );
};

export default ProfileHeader;
