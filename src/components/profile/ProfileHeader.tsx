import { For, Show, createSignal, onCleanup } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";
import { IconShare } from "../../lib/icons/custom-icons";

export interface ProfileHeaderProps {
  profile: ProfileData;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

const STATUS_RESET_DELAY_MS = 3000;

const resolveShareUrl = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  const canonicalHref = document
    .querySelector<HTMLLinkElement>('link[rel="canonical"]')
    ?.getAttribute("href")
    ?.trim();

  if (!canonicalHref) {
    return window.location.href;
  }

  try {
    return new URL(canonicalHref, window.location.href).toString();
  } catch {
    return window.location.href;
  }
};

const fallbackCopyText = (value: string): boolean => {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.inset = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  return copied;
};

const copyToClipboard = async (value: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return fallbackCopyText(value);
    }
  }

  return fallbackCopyText(value);
};

export const ProfileHeader = (props: ProfileHeaderProps) => {
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
    const shareUrl = resolveShareUrl();

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: props.profile.name,
          text: props.profile.headline,
          url: shareUrl,
        });
        setTimedShareStatus("Share opened");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const copied = await copyToClipboard(shareUrl);
    setTimedShareStatus(copied ? "Link copied" : "Share failed");
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
            <button
              type="button"
              class="profile-share-button"
              aria-label="Share profile"
              title="Share profile"
              onClick={() => handleShareProfile()}
            >
              <IconShare class="profile-share-button-icon" aria-hidden="true" />
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
