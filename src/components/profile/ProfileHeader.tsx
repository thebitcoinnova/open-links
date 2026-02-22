import { For, Show } from "solid-js";
import type { ProfileData } from "../../lib/content/load-content";

export interface ProfileHeaderProps {
  profile: ProfileData;
  richness?: "minimal" | "standard" | "rich";
}

const orderedContactEntries = (contact?: Record<string, string>) =>
  Object.entries(contact ?? {}).sort((left, right) => left[0].localeCompare(right[0]));

export const ProfileHeader = (props: ProfileHeaderProps) => {
  const richness = () => props.richness ?? "standard";
  const contacts = () => orderedContactEntries(props.profile.contact);

  return (
    <section class="profile-header" aria-label="Profile">
      <Show when={props.profile.avatar && richness() !== "minimal"}>
        <img class="profile-avatar" src={props.profile.avatar} alt="" loading="lazy" />
      </Show>

      <div class="profile-copy">
        <h1>{props.profile.name}</h1>
        <Show when={props.profile.headline}>
          <p class="profile-headline">{props.profile.headline}</p>
        </Show>
        <Show when={props.profile.bio && richness() !== "minimal"}>
          <p class="profile-bio">{props.profile.bio}</p>
        </Show>

        <Show when={richness() === "rich"}>
          <div class="profile-meta" role="list">
            <Show when={props.profile.location}>
              <p role="listitem">Location: {props.profile.location}</p>
            </Show>
            <Show when={props.profile.pronouns}>
              <p role="listitem">Pronouns: {props.profile.pronouns}</p>
            </Show>
            <Show when={props.profile.status}>
              <p role="listitem">Status: {props.profile.status}</p>
            </Show>
          </div>
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
