import { For, Show } from "solid-js";
import {
  isPersonEntityType,
  resolveEntityPageLabel,
  resolveEntityPageNoun,
} from "../../lib/content/entity-type";
import type { ProfileData } from "../../lib/content/load-content";
import { copyLink, resolveDocumentShareUrl, shareLink } from "../../lib/share/share-link";
import { showActionToast } from "../../lib/ui/action-toast";
import BottomActionBar, {
  BottomActionBarActionContent,
  type BottomActionBarButtonItem,
  type BottomActionKind,
} from "../actions/BottomActionBar";
import MobileOverflowMenu, { type MobileOverflowMenuAction } from "../actions/MobileOverflowMenu";

export interface ProfileHeaderProps {
  profile: ProfileData;
  onProfileQrOpen?: (payload: string) => void;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

export interface MobileProfileActionLayout {
  inlineKinds: BottomActionKind[];
  overflowKinds: BottomActionKind[];
}

const orderedProfileActionKinds: BottomActionKind[] = ["qr", "share", "copy"];

export const resolveMobileProfileActionLayout = (
  kinds: BottomActionKind[],
): MobileProfileActionLayout => {
  const uniqueKinds = Array.from(new Set(kinds));
  const orderedKinds = [
    ...orderedProfileActionKinds.filter((kind) => uniqueKinds.includes(kind)),
    ...uniqueKinds.filter((kind) => !orderedProfileActionKinds.includes(kind)),
  ];
  const inlineKinds = orderedKinds.slice(0, 2);
  const overflowKinds = orderedKinds.slice(2);

  if (overflowKinds.length === 1) {
    return {
      inlineKinds: orderedKinds,
      overflowKinds: [],
    };
  }

  return {
    inlineKinds,
    overflowKinds,
  };
};

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const richness = () => props.richness ?? "standard";
  const contacts = () => orderedContactEntries(props.profile.contact);
  const pageNoun = () => resolveEntityPageNoun(props.profile.entityType);
  const pageLabel = () => resolveEntityPageLabel(props.profile.entityType);

  const handleShareProfile = async () => {
    showActionToast(
      await shareLink({
        copiedMessage: `${props.profile.name} ${pageNoun()} shared`,
        failedMessage: `Could not share ${props.profile.name} ${pageNoun()}`,
        mode: "url-only",
        sharedMessage: `${props.profile.name} ${pageNoun()} shared`,
        text: props.profile.headline,
        title: props.profile.name,
        url: resolveDocumentShareUrl(),
      }),
    );
  };

  const handleCopyProfileLink = async () => {
    showActionToast(
      await copyLink({
        copiedMessage: `${pageLabel()} link copied`,
        failedMessage: `Could not copy ${pageNoun()} link`,
        url: resolveDocumentShareUrl(),
      }),
    );
  };

  const handleOpenProfileQr = () => {
    props.onProfileQrOpen?.(resolveDocumentShareUrl());
  };

  const actionItems = (): BottomActionBarButtonItem[] => {
    const items: BottomActionBarButtonItem[] = [];

    items.push(
      ...(props.onProfileQrOpen
        ? [
            {
              ariaLabel: `Show ${pageNoun()} QR code`,
              kind: "qr" as const,
              label: "QR",
              onClick: handleOpenProfileQr,
              title: `Show ${pageNoun()} QR code`,
            },
          ]
        : []),
      {
        ariaLabel: `Share ${pageNoun()}`,
        kind: "share",
        label: "Share",
        onClick: async () => {
          await handleShareProfile();
        },
        title: `Share ${pageNoun()}`,
      },
      {
        ariaLabel: `Copy ${pageNoun()} link`,
        kind: "copy",
        label: "Copy",
        onClick: async () => {
          await handleCopyProfileLink();
        },
        title: `Copy ${pageNoun()} link`,
      },
    );

    return items;
  };
  const mobileActionLayout = (): MobileProfileActionLayout =>
    resolveMobileProfileActionLayout(actionItems().map((item) => item.kind));

  const mobileInlineActionItems = (): BottomActionBarButtonItem[] => {
    const items = actionItems();

    return mobileActionLayout()
      .inlineKinds.map((kind) => items.find((item) => item.kind === kind))
      .filter((item): item is BottomActionBarButtonItem => Boolean(item));
  };
  const mobileOverflowActions = (): MobileOverflowMenuAction[] => {
    const items = actionItems();

    return mobileActionLayout()
      .overflowKinds.map((kind) => items.find((item) => item.kind === kind))
      .filter((item): item is BottomActionBarButtonItem => Boolean(item))
      .map((item) => ({
        label: item.label,
        onSelect: item.onClick,
      }));
  };

  return (
    <section class="profile-header" aria-label={pageLabel()}>
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
            <Show when={isPersonEntityType(props.profile.entityType) && props.profile.pronouns}>
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
          label={`${pageLabel()} sharing actions`}
        />
        <Show when={mobileInlineActionItems().length > 0}>
          <div class="bottom-action-bar profile-action-bar profile-action-bar-mobile">
            <For each={mobileInlineActionItems()}>
              {(item) => (
                <button
                  type="button"
                  class="bottom-action-bar-action"
                  data-kind={item.kind}
                  aria-label={item.ariaLabel}
                  title={item.title ?? item.ariaLabel}
                  onClick={() => {
                    void item.onClick();
                  }}
                >
                  <BottomActionBarActionContent kind={item.kind} label={item.label} />
                </button>
              )}
            </For>
            <MobileOverflowMenu
              actions={mobileOverflowActions()}
              class="bottom-action-bar-action mobile-overflow-menu-trigger"
              contentClass="mobile-overflow-menu-content profile-action-overflow-menu"
              itemClass="mobile-overflow-menu-item"
              label={`More ${pageNoun()} actions`}
            />
          </div>
        </Show>
      </div>
    </section>
  );
};

export default ProfileHeader;
