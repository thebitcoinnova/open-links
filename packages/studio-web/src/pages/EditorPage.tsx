import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import type { RepoContentPayload, ValidationResult } from "@openlinks/studio-shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import PageShell from "@/components/layout/PageShell";
import { api } from "@/lib/api";

type EditorTab = "profile" | "links" | "site" | "advanced";

const jsonPretty = (value: unknown): string => JSON.stringify(value, null, 2);

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
  const [saveMessage, setSaveMessage] = createSignal<string | null>(null);
  const [advancedDraft, setAdvancedDraft] = createSignal<{
    profile: string;
    links: string;
    site: string;
  }>({
    profile: "",
    links: "",
    site: "",
  });

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
      setSaveMessage("Advanced JSON applied. Validate before saving.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Invalid JSON draft");
    }
  };

  const validate = async () => {
    const loaded = content();
    if (!loaded) return;
    const result = await api.validateRepoContent(repoId(), loaded);
    setValidation(result);
    if (result.valid) {
      setSaveMessage("Validation passed");
    }
  };

  const save = async () => {
    const loaded = content();
    if (!loaded) return;

    try {
      const result = await api.saveRepoContent(repoId(), loaded);
      setSaveMessage(
        `Saved ${result.commits.length} files. Deploy status: ${result.deployStatus.deploy}`,
      );
      captureBaseline(loaded);
      await Promise.all([refetchDeploy(), refetchOps(), refetchContent()]);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Save failed");
    }
  };

  const triggerSync = async () => {
    try {
      const result = await api.syncRepo(repoId());
      setSaveMessage(`Sync result: ${result.status} (${result.message})`);
      await Promise.all([refetchOps(), refetchDeploy()]);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Sync failed");
    }
  };

  const linksArray = createMemo(() => {
    const loaded = content();
    const raw = loaded?.links as { links?: Record<string, unknown>[] } | undefined;
    return Array.isArray(raw?.links) ? raw.links : [];
  });

  return (
    <PageShell>
      <section class="grid gap-4 lg:grid-cols-[220px,1fr,320px]">
        <Card class="space-y-2 bg-white text-ink">
          <p class="text-xs uppercase tracking-widest text-slate-500">Sections</p>
          <For each={["profile", "links", "site", "advanced"] as EditorTab[]}>
            {(tab) => (
              <button
                type="button"
                class={`rounded-lg px-3 py-2 text-left text-sm ${activeTab() === tab ? "bg-ink text-white" : "hover:bg-slate-100"}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            )}
          </For>
          <div class="pt-2 text-xs text-slate-500">
            Dirty state: {dirty() ? "unsaved changes" : "clean"}
          </div>
        </Card>

        <Card class="space-y-4 bg-white text-ink">
          <Show
            when={initialized()}
            fallback={<p class="text-sm text-slate-500">Loading repository content...</p>}
          >
            {(loaded) => (
              <>
                <Show when={activeTab() === "profile"}>
                  <h2 class="font-display text-2xl font-bold">Profile</h2>
                  <Input
                    value={String(loaded().profile.name ?? "")}
                    onInput={(event) => updateProfile("name", event.currentTarget.value)}
                    placeholder="Name"
                  />
                  <Input
                    value={String(loaded().profile.headline ?? "")}
                    onInput={(event) => updateProfile("headline", event.currentTarget.value)}
                    placeholder="Headline"
                  />
                  <Input
                    value={String(loaded().profile.avatar ?? "")}
                    onInput={(event) => updateProfile("avatar", event.currentTarget.value)}
                    placeholder="Avatar URL"
                  />
                  <Textarea
                    rows={4}
                    value={String(loaded().profile.bio ?? "")}
                    onInput={(event) => updateProfile("bio", event.currentTarget.value)}
                    placeholder="Bio"
                  />
                </Show>

                <Show when={activeTab() === "links"}>
                  <div class="flex items-center justify-between">
                    <h2 class="font-display text-2xl font-bold">Links</h2>
                    <Button variant="outline" onClick={addLink}>
                      Add link
                    </Button>
                  </div>
                  <div class="space-y-3">
                    <For each={linksArray()}>
                      {(link, index) => (
                        <div class="rounded-xl border border-slate-200 p-3">
                          <div class="grid gap-2 md:grid-cols-2">
                            <Input
                              value={String(link.id ?? "")}
                              onInput={(event) =>
                                updateLink(index(), "id", event.currentTarget.value)
                              }
                              placeholder="id"
                            />
                            <Input
                              value={String(link.label ?? "")}
                              onInput={(event) =>
                                updateLink(index(), "label", event.currentTarget.value)
                              }
                              placeholder="label"
                            />
                            <Input
                              value={String(link.url ?? "")}
                              onInput={(event) =>
                                updateLink(index(), "url", event.currentTarget.value)
                              }
                              placeholder="url"
                            />
                            <Input
                              value={String(link.type ?? "simple")}
                              onInput={(event) =>
                                updateLink(index(), "type", event.currentTarget.value)
                              }
                              placeholder="type"
                            />
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={activeTab() === "site"}>
                  <h2 class="font-display text-2xl font-bold">Site</h2>
                  <Input
                    value={String(loaded().site.title ?? "")}
                    onInput={(event) => updateSite("title", event.currentTarget.value)}
                    placeholder="Site title"
                  />
                  <Input
                    value={String(loaded().site.description ?? "")}
                    onInput={(event) => updateSite("description", event.currentTarget.value)}
                    placeholder="Site description"
                  />
                  <Input
                    value={String((loaded().site.theme as { active?: string })?.active ?? "")}
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
                    placeholder="Theme active"
                  />
                </Show>

                <Show when={activeTab() === "advanced"}>
                  <h2 class="font-display text-2xl font-bold">Advanced JSON</h2>
                  <p class="text-sm text-slate-600">
                    Use only if you need fields not exposed in guided forms.
                  </p>
                  <Textarea
                    rows={8}
                    value={advancedDraft().profile}
                    onInput={(event) =>
                      setAdvancedDraft((previous) => ({
                        ...previous,
                        profile: event.currentTarget.value,
                      }))
                    }
                  />
                  <Textarea
                    rows={8}
                    value={advancedDraft().links}
                    onInput={(event) =>
                      setAdvancedDraft((previous) => ({
                        ...previous,
                        links: event.currentTarget.value,
                      }))
                    }
                  />
                  <Textarea
                    rows={8}
                    value={advancedDraft().site}
                    onInput={(event) =>
                      setAdvancedDraft((previous) => ({
                        ...previous,
                        site: event.currentTarget.value,
                      }))
                    }
                  />
                  <Button variant="outline" onClick={applyAdvancedJson}>
                    Apply JSON
                  </Button>
                </Show>
              </>
            )}
          </Show>
        </Card>

        <Card class="space-y-4 bg-white text-ink">
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
            <p class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              {saveMessage()}
            </p>
          </Show>

          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <p class="font-semibold">Deployment</p>
            <Show
              when={deployStatus()}
              fallback={<p class="text-slate-500">No deployment data yet.</p>}
            >
              {(status) => (
                <ul class="mt-2 space-y-1 text-xs text-slate-700">
                  <li>CI: {status().ci}</li>
                  <li>Deploy: {status().deploy}</li>
                  <li>Pages URL: {status().pagesUrl ?? "not detected"}</li>
                </ul>
              )}
            </Show>
          </div>

          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <p class="font-semibold">Validation</p>
            <Show
              when={validation()}
              fallback={<p class="text-slate-500">Run validation to see issues.</p>}
            >
              {(result) => (
                <>
                  <p class={`mt-1 text-xs ${result().valid ? "text-green-700" : "text-rose-700"}`}>
                    {result().valid ? "Valid" : `${result().errors.length} error(s)`}
                  </p>
                  <For each={result().errors.slice(0, 8)}>
                    {(item) => (
                      <p class="mt-1 text-xs text-rose-700">
                        [{item.source}] {item.path}: {item.message}
                      </p>
                    )}
                  </For>
                </>
              )}
            </Show>
          </div>

          <div class="rounded-xl border border-slate-200 p-3 text-sm">
            <p class="font-semibold">Recent operations</p>
            <Show when={ops()} fallback={<p class="text-slate-500">No operations loaded.</p>}>
              {(value) => (
                <For each={value().operations.slice(0, 8)}>
                  {(op) => (
                    <p class="mt-1 text-xs text-slate-700">
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
