import SiteEditorSection from "@/components/editor/SiteEditorSection";
import { SimpleAccordion, SimpleAccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledTextarea } from "@/components/ui/field";
import { LabeledSelect } from "@/components/ui/labeled-select";
import {
  STUDIO_LINK_TYPE_OPTIONS,
  resolveEditorLinkAccordionSummary,
  resolveEditorLinkAccordionValue,
} from "@/lib/editor-options";
import type { RepoContentPayload } from "@openlinks/studio-shared";
import { For, Show } from "solid-js";
import type { EditorPageController } from "./editor-page-controller";

interface EditorTabProps {
  controller: EditorPageController;
  content: RepoContentPayload;
}

export const ProfileEditorTab = (props: EditorTabProps) => (
  <>
    <h2 class="font-display text-2xl font-bold">Profile</h2>
    <LabeledInput
      id="editor-profile-name"
      label="Name"
      onInput={(event) => props.controller.updateProfile("name", event.currentTarget.value)}
      value={String(props.content.profile.name ?? "")}
    />
    <LabeledInput
      id="editor-profile-headline"
      label="Headline"
      onInput={(event) => props.controller.updateProfile("headline", event.currentTarget.value)}
      value={String(props.content.profile.headline ?? "")}
    />
    <LabeledInput
      id="editor-profile-avatar"
      label="Avatar URL"
      onInput={(event) => props.controller.updateProfile("avatar", event.currentTarget.value)}
      value={String(props.content.profile.avatar ?? "")}
    />
    <LabeledTextarea
      id="editor-profile-bio"
      label="Bio"
      onInput={(event) => props.controller.updateProfile("bio", event.currentTarget.value)}
      rows={4}
      value={String(props.content.profile.bio ?? "")}
    />
  </>
);

const RichLinkProfileDescription = (props: {
  controller: EditorPageController;
  index: number;
  link: Record<string, unknown>;
}) => (
  <Show when={String(props.link.type ?? "simple") === "rich"}>
    <div class="mt-3">
      <LabeledTextarea
        id={`editor-link-${props.index}-profile-description`}
        label="Profile description"
        maybeDescription="Used for supported social profile links."
        onInput={(event) =>
          props.controller.updateLinkMetadata(
            props.index,
            "profileDescription",
            event.currentTarget.value,
          )
        }
        rows={3}
        value={String(
          ((props.link.metadata as Record<string, unknown> | undefined)?.profileDescription ??
            "") as string,
        )}
      />
    </div>
  </Show>
);

const LinkEditorFields = (props: {
  controller: EditorPageController;
  index: number;
  link: Record<string, unknown>;
}) => (
  <>
    <div class="grid gap-3 md:grid-cols-2">
      <LabeledInput
        id={`editor-link-${props.index}-id`}
        label="Link ID"
        onInput={(event) =>
          props.controller.updateLink(props.index, "id", event.currentTarget.value)
        }
        value={String(props.link.id ?? "")}
      />
      <LabeledInput
        id={`editor-link-${props.index}-label`}
        label="Link label"
        onInput={(event) =>
          props.controller.updateLink(props.index, "label", event.currentTarget.value)
        }
        value={String(props.link.label ?? "")}
      />
      <LabeledInput
        id={`editor-link-${props.index}-url`}
        label="Link URL"
        onInput={(event) =>
          props.controller.updateLink(props.index, "url", event.currentTarget.value)
        }
        value={String(props.link.url ?? "")}
      />
      <LabeledSelect
        id={`editor-link-${props.index}-type`}
        label="Link type"
        onChange={(value) => props.controller.updateLink(props.index, "type", value)}
        options={STUDIO_LINK_TYPE_OPTIONS}
        value={String(props.link.type ?? "simple")}
      />
    </div>
    <RichLinkProfileDescription {...props} />
  </>
);

export const LinksEditorTab = (props: EditorTabProps) => (
  <>
    <div class="flex items-center justify-between">
      <h2 class="font-display text-2xl font-bold">Links</h2>
      <Button variant="outline" onClick={props.controller.addLink}>
        Add link
      </Button>
    </div>
    <SimpleAccordion
      value={props.controller.expandedLinkSections()}
      onChange={props.controller.setExpandedLinkSections}
    >
      <For each={props.controller.linksArray()}>
        {(link, index) => {
          const summary = () => resolveEditorLinkAccordionSummary(index(), link);
          return (
            <SimpleAccordionItem
              value={resolveEditorLinkAccordionValue(index(), link.id)}
              summary={summary().summary}
              summaryDetail={summary().detail}
              summaryMeta={summary().meta}
            >
              <LinkEditorFields controller={props.controller} index={index()} link={link} />
            </SimpleAccordionItem>
          );
        }}
      </For>
    </SimpleAccordion>
  </>
);

export const SiteEditorTab = (props: EditorTabProps) => (
  <SiteEditorSection
    content={props.content}
    onContentChange={props.controller.setContent}
    onSiteFieldChange={props.controller.updateSite}
    onSiteRecordChange={props.controller.updateSiteRecord}
  />
);

const AdvancedJsonField = (props: {
  controller: EditorPageController;
  field: "links" | "profile" | "site";
  label: string;
}) => (
  <LabeledTextarea
    class="font-mono"
    id={`editor-advanced-${props.field}`}
    label={`${props.label} JSON`}
    maybeDescription={`Advanced editor for data/${props.field}.json.`}
    onInput={(event) =>
      props.controller.setAdvancedDraft((previous) => ({
        ...previous,
        [props.field]: event.currentTarget.value,
      }))
    }
    rows={8}
    value={props.controller.advancedDraft()[props.field]}
  />
);

export const AdvancedEditorTab = (props: EditorTabProps) => (
  <>
    <h2 class="font-display text-2xl font-bold">Advanced JSON</h2>
    <p class="text-sm text-slate-300">Use only if you need fields not exposed in guided forms.</p>
    <AdvancedJsonField controller={props.controller} field="profile" label="Profile" />
    <AdvancedJsonField controller={props.controller} field="links" label="Links" />
    <AdvancedJsonField controller={props.controller} field="site" label="Site" />
    <Button variant="outline" onClick={props.controller.applyAdvancedJson}>
      Apply JSON
    </Button>
  </>
);
