import { LabeledInput, LabeledTextarea } from "@/components/ui/field";
import { LabeledSelect } from "@/components/ui/labeled-select";
import {
  STUDIO_VCARD_PHOTO_OPTIONS,
  STUDIO_VCARD_PROFILE_URL_OPTIONS,
  STUDIO_VCARD_VISIBILITY_OPTIONS,
  type StudioSiteData,
  resolveStudioVCardCustomUrlsValue,
  resolveStudioVCardFieldValue,
  resolveStudioVCardFilenameValue,
  resolveStudioVCardLinkIdsValue,
  resolveStudioVCardPhotoValue,
  resolveStudioVCardProfileUrlValue,
  resolveStudioVCardVisibilityValue,
  updateStudioVCardCustomUrls,
  updateStudioVCardEnabled,
  updateStudioVCardField,
  updateStudioVCardFilename,
  updateStudioVCardLinkIds,
  updateStudioVCardPhoto,
  updateStudioVCardProfileUrl,
} from "@/lib/editor-options";

interface SiteVCardEditorProps {
  site: Record<string, unknown>;
  onSiteRecordChange: (site: Record<string, unknown>) => void;
}

export default function SiteVCardEditor(props: SiteVCardEditorProps) {
  const studioSite = () => props.site as StudioSiteData;
  const updateField = (
    field: "email" | "note" | "organization" | "phone" | "role" | "title",
    value: string,
  ) => {
    props.onSiteRecordChange(updateStudioVCardField(props.site, field, value));
  };

  return (
    <div class="space-y-3 rounded-lg border border-slate-700 bg-slate-900/30 p-4">
      <h3 class="font-display text-xl font-semibold">vCard Download</h3>
      <div class="grid gap-3 md:grid-cols-2">
        <LabeledSelect
          id="editor-site-vcard-visibility"
          label="Download button"
          onChange={(value) =>
            props.onSiteRecordChange(updateStudioVCardEnabled(props.site, value === "true"))
          }
          options={STUDIO_VCARD_VISIBILITY_OPTIONS}
          value={resolveStudioVCardVisibilityValue(studioSite())}
        />
        <LabeledInput
          id="editor-site-vcard-filename"
          label="Filename"
          onInput={(event) =>
            props.onSiteRecordChange(
              updateStudioVCardFilename(props.site, event.currentTarget.value),
            )
          }
          value={resolveStudioVCardFilenameValue(studioSite())}
        />
        <LabeledSelect
          id="editor-site-vcard-profile-url"
          label="Profile URL"
          onChange={(value) =>
            props.onSiteRecordChange(updateStudioVCardProfileUrl(props.site, value === "true"))
          }
          options={STUDIO_VCARD_PROFILE_URL_OPTIONS}
          value={resolveStudioVCardProfileUrlValue(studioSite())}
        />
        <LabeledSelect
          id="editor-site-vcard-photo"
          label="Photo"
          onChange={(value) =>
            props.onSiteRecordChange(updateStudioVCardPhoto(props.site, value === "true"))
          }
          options={STUDIO_VCARD_PHOTO_OPTIONS}
          value={resolveStudioVCardPhotoValue(studioSite())}
        />
        <LabeledInput
          id="editor-site-vcard-email"
          label="Email"
          onInput={(event) => updateField("email", event.currentTarget.value)}
          value={resolveStudioVCardFieldValue(studioSite(), "email")}
        />
        <LabeledInput
          id="editor-site-vcard-phone"
          label="Phone"
          onInput={(event) => updateField("phone", event.currentTarget.value)}
          value={resolveStudioVCardFieldValue(studioSite(), "phone")}
        />
        <LabeledInput
          id="editor-site-vcard-organization"
          label="Organization"
          onInput={(event) => updateField("organization", event.currentTarget.value)}
          value={resolveStudioVCardFieldValue(studioSite(), "organization")}
        />
        <LabeledInput
          id="editor-site-vcard-title"
          label="Title"
          onInput={(event) => updateField("title", event.currentTarget.value)}
          value={resolveStudioVCardFieldValue(studioSite(), "title")}
        />
        <LabeledInput
          id="editor-site-vcard-role"
          label="Role"
          onInput={(event) => updateField("role", event.currentTarget.value)}
          value={resolveStudioVCardFieldValue(studioSite(), "role")}
        />
      </div>
      <LabeledTextarea
        id="editor-site-vcard-note"
        label="Note"
        onInput={(event) => updateField("note", event.currentTarget.value)}
        rows={3}
        value={resolveStudioVCardFieldValue(studioSite(), "note")}
      />
      <LabeledTextarea
        id="editor-site-vcard-link-ids"
        label="Included link IDs"
        onInput={(event) =>
          props.onSiteRecordChange(updateStudioVCardLinkIds(props.site, event.currentTarget.value))
        }
        rows={2}
        value={resolveStudioVCardLinkIdsValue(studioSite())}
      />
      <LabeledTextarea
        id="editor-site-vcard-custom-urls"
        label="Custom URLs"
        onInput={(event) =>
          props.onSiteRecordChange(
            updateStudioVCardCustomUrls(props.site, event.currentTarget.value),
          )
        }
        rows={3}
        value={resolveStudioVCardCustomUrlsValue(studioSite())}
      />
    </div>
  );
}
