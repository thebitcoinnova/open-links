import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LabeledInput, LabeledTextarea } from "@/components/ui/field";
import StatusNotice from "@/components/ui/status-notice";
import { type LiveRegionTone, resolveNextTabValue } from "@/lib/accessibility";
import { api } from "@/lib/api";
import type { RepoContentPayload, ValidationResult } from "@openlinks/studio-shared";
import { useParams } from "@solidjs/router";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";

type EditorTab = "profile" | "links" | "site" | "advanced";

const jsonPretty = (value: unknown): string => JSON.stringify(value, null, 2);
const EDITOR_TABS = [
  "profile",
  "links",
  "site",
  "advanced",
] as const satisfies readonly EditorTab[];
const editorTabId = (tab: EditorTab): string => `editor-tab-${tab}`;
const editorPanelId = (tab: EditorTab): string => `editor-panel-${tab}`;

export default function EditorPage() {
  const params = useParams();
  const repoId = () => params.repoId ?? "";
  const [content, { mutate: setContent, refetch: refetchContent }] = createResource(repoId, (id) =>
    api.getRepoContent(id),
  );
  const [deployStatus, { refetch: refetchDeploy }] = createResource(repoId, (id) =>
    api.getDeployStatus(id),
  );
  const [ops, { refetch: refetchOps }] = createResource(repoId, (id) => api.getOperations(id));
  const [activeTab, setActiveTab] = createSignal<EditorTab>("profile");
  const [baseline, setBaseline] = createSignal<string>("");
  const [validation, setValidation] = createSignal<ValidationResult | null>(null);
  const [saveMessage, setSaveMessage] = createSignal<{
    text: string;
    tone: LiveRegionTone;
  } | null>(null);
  const [advancedDraft, setAdvancedDraft] = createSignal<{
    profile: string;
    links: string;
    site: string;
  }>({
    profile: "",
    links: "",
    site: "",
  });
  const tabRefs: Partial<Record<EditorTab, HTMLButtonElement | undefined>> = {};

  const captureBaseline = (payload: RepoContentPayload) => {
    setBaseline(JSON.stringify(payload));
    setAdvancedDraft({
      profile: jsonPretty(payload.profile),
      links: jsonPretty(payload.links),
      site: jsonPretty(payload.site),
    });
  };

  const initialized = createMemo(() => {
    const loaded = content();
    if (loaded && !baseline()) {
      captureBaseline(loaded);
    }
    return loaded;
  });

  const dirty = createMemo(() => {
    const loaded = content();
    if (!loaded) return false;
    return JSON.stringify(loaded) !== baseline();
  });

  const updateProfile = (field: string, value: string) => {
    const loaded = content();
    if (!loaded) return;
    setContent({ ...loaded, profile: { ...loaded.profile, [field]: value } });
  };

  const updateSite = (field: string, value: string) => {
    const loaded = content();
    if (!loaded) return;
    setContent({ ...loaded, site: { ...loaded.site, [field]: value } });
  };

  const updateLink = (index: number, field: string, value: string) => {
    const loaded = content();
    if (!loaded) return;

    const linksArr = Array.isArray((loaded.links as { links?: unknown[] }).links)
      ? ([...(loaded.links as { links: Record<string, unknown>[] }).links] as Record<
          string,
          unknown
        >[])
      : [];

    const existing = linksArr[index] ?? {};
    linksArr[index] = { ...existing, [field]: value };

    setContent({
      ...loaded,
      links: { ...(loaded.links as Record<string, unknown>), links: linksArr },
    });
  };

  const updateLinkMetadata = (index: number, field: string, value: string) => {
    const loaded = content();
    if (!loaded) return;

    const linksArr = Array.isArray((loaded.links as { links?: unknown[] }).links)
      ? ([...(loaded.links as { links: Record<string, unknown>[] }).links] as Record<
          string,
          unknown
        >[])
      : [];

    const existing = linksArr[index] ?? {};
    const existingMetadata =
      typeof existing.metadata === "object" &&
      existing.metadata !== null &&
      !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};

    if (value.trim().length === 0) {
      delete existingMetadata[field];
    } else {
      existingMetadata[field] = value;
    }

    linksArr[index] = {
      ...existing,
      metadata: Object.keys(existingMetadata).length > 0 ? existingMetadata : undefined,
    };

    setContent({
      ...loaded,
      links: { ...(loaded.links as Record<string, unknown>), links: linksArr },
    });
  };

  const addLink = () => {
    const loaded = content();
    if (!loaded) return;

    const linksArr = Array.isArray((loaded.links as { links?: unknown[] }).links)
      ? ([...(loaded.links as { links: Record<string, unknown>[] }).links] as Record<
          string,
          unknown
        >[])
      : [];

    linksArr.push({
      id: `link-${Date.now()}`,
      label: "New Link",
      url: "https://example.com",
      type: "simple",
    });

    setContent({
      ...loaded,
      links: { ...(loaded.links as Record<string, unknown>), links: linksArr },
    });
  };

  const applyAdvancedJson = () => {
    const loaded = content();
    if (!loaded) return;

    try {
      const profile = JSON.parse(advancedDraft().profile) as Record<string, unknown>;
      const links = JSON.parse(advancedDraft().links) as Record<string, unknown>;
      const site = JSON.parse(advancedDraft().site) as Record<string, unknown>;
      setContent({ ...loaded, profile, links, site });
      setSaveMessage({ text: "Advanced JSON applied. Validate before saving.", tone: "status" });
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Invalid JSON draft",
        tone: "alert",
      });
    }
  };

  const validate = async () => {
    const loaded = content();
    if (!loaded) return;
    setSaveMessage(null);
    const result = await api.validateRepoContent(repoId(), loaded);
    setValidation(result);
    if (result.valid) {
      setSaveMessage({ text: "Validation passed", tone: "status" });
    }
  };

  const save = async () => {
    const loaded = content();
    if (!loaded) return;

    try {
      const result = await api.saveRepoContent(repoId(), loaded);
      setSaveMessage({
        text: `Saved ${result.commits.length} files. Deploy status: ${result.deployStatus.deploy}`,
        tone: "status",
      });
      captureBaseline(loaded);
      await Promise.all([refetchDeploy(), refetchOps(), refetchContent()]);
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Save failed",
        tone: "alert",
      });
    }
  };

  const triggerSync = async () => {
    try {
      const result = await api.syncRepo(repoId());
      setSaveMessage({
        text: `Sync result: ${result.status} (${result.message})`,
        tone: result.status === "failed" || result.status === "conflict" ? "alert" : "status",
      });
      await Promise.all([refetchOps(), refetchDeploy()]);
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Sync failed",
        tone: "alert",
      });
    }
  };

  const linksArray = createMemo(() => {
    const loaded = content();
    const raw = loaded?.links as { links?: Record<string, unknown>[] } | undefined;
    return Array.isArray(raw?.links) ? raw.links : [];
  });

  const focusTab = (tab: EditorTab) => {
    setActiveTab(tab);
    tabRefs[tab]?.focus();
  };

  return (
    <PageShell>
      <section class="grid gap-4 lg:grid-cols-[220px,1fr,320px]">
        <Card class="space-y-2">
          <p class="text-xs uppercase tracking-widest text-slate-400" id="editor-sections-label">
            Sections
          </p>
          <div aria-labelledby="editor-sections-label" class="space-y-2" role="tablist">
            <For each={EDITOR_TABS}>
              {(tab) => (
                <button
                  ref={(element) => {
                    tabRefs[tab] = element;
                  }}
                  aria-controls={editorPanelId(tab)}
                  aria-selected={activeTab() === tab}
                  class={`rounded-lg px-3 py-2 text-left text-sm ${activeTab() === tab ? "bg-slate-100 text-ink" : "hover:bg-white/10"}`}
                  id={editorTabId(tab)}
                  onClick={() => setActiveTab(tab)}
                  onKeyDown={(event) => {
                    const nextTab = resolveNextTabValue(EDITOR_TABS, tab, event.key);
                    if (!nextTab) {
                      return;
                    }

                    event.preventDefault();
                    focusTab(nextTab);
                  }}
                  role="tab"
                  tabIndex={activeTab() === tab ? 0 : -1}
                  type="button"
                >
                  {tab}
                </button>
              )}
            </For>
          </div>
          <div class="pt-2 text-xs text-slate-400">
            Dirty state: {dirty() ? "unsaved changes" : "clean"}
          </div>
        </Card>

        <Card class="space-y-4">
          <Show
            when={initialized()}
            fallback={<p class="text-sm text-slate-400">Loading repository content...</p>}
          >
            {(loaded) => (
              <>
                <Show when={activeTab() === "profile"}>
                  <section
                    aria-labelledby={editorTabId("profile")}
                    class="space-y-4"
                    id={editorPanelId("profile")}
                    role="tabpanel"
                  >
                    <h2 class="font-display text-2xl font-bold">Profile</h2>
                    <LabeledInput
                      id="editor-profile-name"
                      label="Name"
                      onInput={(event) => updateProfile("name", event.currentTarget.value)}
                      value={String(loaded().profile.name ?? "")}
                    />
                    <LabeledInput
                      id="editor-profile-headline"
                      label="Headline"
                      onInput={(event) => updateProfile("headline", event.currentTarget.value)}
                      value={String(loaded().profile.headline ?? "")}
                    />
                    <LabeledInput
                      id="editor-profile-avatar"
                      label="Avatar URL"
                      onInput={(event) => updateProfile("avatar", event.currentTarget.value)}
                      value={String(loaded().profile.avatar ?? "")}
                    />
                    <LabeledTextarea
                      id="editor-profile-bio"
                      label="Bio"
                      onInput={(event) => updateProfile("bio", event.currentTarget.value)}
                      rows={4}
                      value={String(loaded().profile.bio ?? "")}
                    />
                  </section>
                </Show>

                <Show when={activeTab() === "links"}>
                  <section
                    aria-labelledby={editorTabId("links")}
                    class="space-y-4"
                    id={editorPanelId("links")}
                    role="tabpanel"
                  >
                    <div class="flex items-center justify-between">
                      <h2 class="font-display text-2xl font-bold">Links</h2>
                      <Button variant="outline" onClick={addLink}>
                        Add link
                      </Button>
                    </div>
                    <div class="space-y-3">
                      <For each={linksArray()}>
                        {(link, index) => (
                          <fieldset class="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                            <legend class="px-1 text-sm font-semibold text-slate-100">
                              Link {index() + 1}
                            </legend>
                            <div class="grid gap-3 md:grid-cols-2">
                              <LabeledInput
                                id={`editor-link-${index()}-id`}
                                label="Link ID"
                                onInput={(event) =>
                                  updateLink(index(), "id", event.currentTarget.value)
                                }
                                value={String(link.id ?? "")}
                              />
                              <LabeledInput
                                id={`editor-link-${index()}-label`}
                                label="Link label"
                                onInput={(event) =>
                                  updateLink(index(), "label", event.currentTarget.value)
                                }
                                value={String(link.label ?? "")}
                              />
                              <LabeledInput
                                id={`editor-link-${index()}-url`}
                                label="Link URL"
                                onInput={(event) =>
                                  updateLink(index(), "url", event.currentTarget.value)
                                }
                                value={String(link.url ?? "")}
                              />
                              <LabeledInput
                                id={`editor-link-${index()}-type`}
                                label="Link type"
                                onInput={(event) =>
                                  updateLink(index(), "type", event.currentTarget.value)
                                }
                                value={String(link.type ?? "simple")}
                              />
                            </div>
                            <Show when={String(link.type ?? "simple") === "rich"}>
                              <div class="mt-3">
                                <LabeledTextarea
                                  id={`editor-link-${index()}-profile-description`}
                                  label="Profile description"
                                  maybeDescription="Used for supported social profile links."
                                  onInput={(event) =>
                                    updateLinkMetadata(
                                      index(),
                                      "profileDescription",
                                      event.currentTarget.value,
                                    )
                                  }
                                  rows={3}
                                  value={String(
                                    ((link.metadata as Record<string, unknown> | undefined)
                                      ?.profileDescription ?? "") as string,
                                  )}
                                />
                              </div>
                            </Show>
                          </fieldset>
                        )}
                      </For>
                    </div>
                  </section>
                </Show>

                <Show when={activeTab() === "site"}>
                  <section
                    aria-labelledby={editorTabId("site")}
                    class="space-y-4"
                    id={editorPanelId("site")}
                    role="tabpanel"
                  >
                    <h2 class="font-display text-2xl font-bold">Site</h2>
                    <LabeledInput
                      id="editor-site-title"
                      label="Site title"
                      onInput={(event) => updateSite("title", event.currentTarget.value)}
                      value={String(loaded().site.title ?? "")}
                    />
                    <LabeledInput
                      id="editor-site-description"
                      label="Site description"
                      onInput={(event) => updateSite("description", event.currentTarget.value)}
                      value={String(loaded().site.description ?? "")}
                    />
                    <LabeledInput
                      id="editor-site-theme-active"
                      label="Active theme"
                      onInput={(event) => {
                        const currentTheme = (loaded().site.theme as Record<string, unknown>) ?? {};
                        setContent({
                          ...loaded(),
                          site: {
                            ...loaded().site,
                            theme: {
                              ...currentTheme,
                              active: event.currentTarget.value,
                            },
                          },
                        });
                      }}
                      value={String((loaded().site.theme as { active?: string })?.active ?? "")}
                    />
                  </section>
                </Show>

                <Show when={activeTab() === "advanced"}>
                  <section
                    aria-labelledby={editorTabId("advanced")}
                    class="space-y-4"
                    id={editorPanelId("advanced")}
                    role="tabpanel"
                  >
                    <h2 class="font-display text-2xl font-bold">Advanced JSON</h2>
                    <p class="text-sm text-slate-300">
                      Use only if you need fields not exposed in guided forms.
                    </p>
                    <LabeledTextarea
                      class="font-mono"
                      id="editor-advanced-profile"
                      label="Profile JSON"
                      maybeDescription="Advanced editor for data/profile.json."
                      onInput={(event) =>
                        setAdvancedDraft((previous) => ({
                          ...previous,
                          profile: event.currentTarget.value,
                        }))
                      }
                      rows={8}
                      value={advancedDraft().profile}
                    />
                    <LabeledTextarea
                      class="font-mono"
                      id="editor-advanced-links"
                      label="Links JSON"
                      maybeDescription="Advanced editor for data/links.json."
                      onInput={(event) =>
                        setAdvancedDraft((previous) => ({
                          ...previous,
                          links: event.currentTarget.value,
                        }))
                      }
                      rows={8}
                      value={advancedDraft().links}
                    />
                    <LabeledTextarea
                      class="font-mono"
                      id="editor-advanced-site"
                      label="Site JSON"
                      maybeDescription="Advanced editor for data/site.json."
                      onInput={(event) =>
                        setAdvancedDraft((previous) => ({
                          ...previous,
                          site: event.currentTarget.value,
                        }))
                      }
                      rows={8}
                      value={advancedDraft().site}
                    />
                    <Button variant="outline" onClick={applyAdvancedJson}>
                      Apply JSON
                    </Button>
                  </section>
                </Show>
              </>
            )}
          </Show>
        </Card>

        <Card class="space-y-4">
          <h2 class="font-display text-xl font-bold">Publish Controls</h2>
          <div class="flex flex-wrap gap-2">
            <Button onClick={validate}>Validate</Button>
            <Button variant="outline" onClick={save} disabled={!dirty()}>
              Save to main
            </Button>
            <Button variant="outline" onClick={triggerSync}>
              Sync upstream
            </Button>
            <Button variant="outline" onClick={() => Promise.all([refetchDeploy(), refetchOps()])}>
              Refresh status
            </Button>
          </div>

          <Show when={saveMessage()}>
            {(message) => <StatusNotice tone={message().tone}>{message().text}</StatusNotice>}
          </Show>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
            <p class="font-semibold">Deployment</p>
            <Show
              when={deployStatus()}
              fallback={<p class="text-slate-400">No deployment data yet.</p>}
            >
              {(status) => (
                <ul class="mt-2 space-y-1 text-xs text-slate-300">
                  <li>CI: {status().ci}</li>
                  <li>Deploy: {status().deploy}</li>
                  <li>Pages URL: {status().pagesUrl ?? "not detected"}</li>
                </ul>
              )}
            </Show>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
            <p class="font-semibold">Validation</p>
            <Show
              when={validation()}
              fallback={<p class="text-slate-400">Run validation to see issues.</p>}
            >
              {(result) => (
                <StatusNotice class="mt-2" tone={result().valid ? "status" : "alert"}>
                  <>
                    <p
                      class={`font-medium ${result().valid ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {result().valid ? "Valid" : `${result().errors.length} error(s)`}
                    </p>
                    <Show when={!result().valid}>
                      <ul class="mt-2 list-disc space-y-1 pl-4 text-rose-300">
                        <For each={result().errors.slice(0, 8)}>
                          {(item) => (
                            <li>
                              [{item.source}] {item.path}: {item.message}
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </>
                </StatusNotice>
              )}
            </Show>
          </div>

          <div class="rounded-xl border border-slate-700 bg-slate-900/40 p-3 text-sm">
            <p class="font-semibold">Recent operations</p>
            <Show when={ops()} fallback={<p class="text-slate-400">No operations loaded.</p>}>
              {(value) => (
                <For each={value().operations.slice(0, 8)}>
                  {(op) => (
                    <p class="mt-1 text-xs text-slate-300">
                      {op.operation} · {op.status}
                    </p>
                  )}
                </For>
              )}
            </Show>
          </div>
        </Card>
      </section>
    </PageShell>
  );
}
