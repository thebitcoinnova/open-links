import type { EditorTab } from "@/components/editor/EditorWorkspace";
import type { LiveRegionTone } from "@/lib/accessibility";
import { api } from "@/lib/api";
import {
  type StudioConfirmAction,
  resolveEditorLinkAccordionValue,
  resolveStudioConfirmDialogCopy,
} from "@/lib/editor-options";
import type { RepoContentPayload, ValidationResult } from "@openlinks/studio-shared";
import { type Accessor, type Setter, createMemo, createResource, createSignal } from "solid-js";

const jsonPretty = (value: unknown): string => JSON.stringify(value, null, 2);

export interface SaveMessage {
  text: string;
  tone: LiveRegionTone;
}

const createEditorResources = (repoId: Accessor<string>) => {
  const [content, { mutate: setContent, refetch: refetchContent }] = createResource(repoId, (id) =>
    api.getRepoContent(id),
  );
  const [deployStatus, { refetch: refetchDeploy }] = createResource(repoId, (id) =>
    api.getDeployStatus(id),
  );
  const [ops, { refetch: refetchOps }] = createResource(repoId, (id) => api.getOperations(id));

  return { content, deployStatus, ops, refetchContent, refetchDeploy, refetchOps, setContent };
};

const createEditorBaselineState = (resources: ReturnType<typeof createEditorResources>) => {
  const [activeTab, setActiveTab] = createSignal<EditorTab>("profile");
  const [baseline, setBaseline] = createSignal("");
  const [advancedDraft, setAdvancedDraft] = createSignal({ profile: "", links: "", site: "" });
  const [expandedLinkSections, setExpandedLinkSections] = createSignal<string[]>([]);

  const captureBaseline = (payload: RepoContentPayload) => {
    setBaseline(JSON.stringify(payload));
    setAdvancedDraft({
      profile: jsonPretty(payload.profile),
      links: jsonPretty(payload.links),
      site: jsonPretty(payload.site),
    });
  };
  const initialized = createMemo(() => {
    const loaded = resources.content();
    if (loaded && !baseline()) {
      captureBaseline(loaded);
      const rawLinks = loaded.links as { links?: Record<string, unknown>[] };
      const firstLink = Array.isArray(rawLinks.links) ? rawLinks.links[0] : undefined;
      setExpandedLinkSections(firstLink ? [resolveEditorLinkAccordionValue(0, firstLink.id)] : []);
    }
    return loaded;
  });
  const dirty = createMemo(() => {
    const loaded = resources.content();
    return loaded ? JSON.stringify(loaded) !== baseline() : false;
  });

  return {
    activeTab,
    advancedDraft,
    captureBaseline,
    dirty,
    expandedLinkSections,
    initialized,
    setActiveTab,
    setAdvancedDraft,
    setExpandedLinkSections,
  };
};

const copyLinks = (loaded: RepoContentPayload): Record<string, unknown>[] => {
  const rawLinks = (loaded.links as { links?: unknown[] }).links;
  return Array.isArray(rawLinks)
    ? ([...(rawLinks as Record<string, unknown>[])] as Record<string, unknown>[])
    : [];
};

const createEditorMutations = (
  resources: ReturnType<typeof createEditorResources>,
  baselineState: ReturnType<typeof createEditorBaselineState>,
  setSaveMessage: Setter<SaveMessage | null>,
) => {
  const updateRootRecord = (key: "profile" | "site", field: string, value: string) => {
    const loaded = resources.content();
    if (!loaded) return;
    resources.setContent({ ...loaded, [key]: { ...loaded[key], [field]: value } });
  };
  const updateSiteRecord = (site: Record<string, unknown>) => {
    const loaded = resources.content();
    if (loaded) resources.setContent({ ...loaded, site });
  };
  const commitLinks = (loaded: RepoContentPayload, links: Record<string, unknown>[]) => {
    resources.setContent({
      ...loaded,
      links: { ...(loaded.links as Record<string, unknown>), links },
    });
  };
  const updateLink = (index: number, field: string, value: string) => {
    const loaded = resources.content();
    if (!loaded) return;
    const links = copyLinks(loaded);
    links[index] = { ...(links[index] ?? {}), [field]: value };
    commitLinks(loaded, links);
  };
  const updateLinkMetadata = (index: number, field: string, value: string) => {
    const loaded = resources.content();
    if (!loaded) return;
    const links = copyLinks(loaded);
    const existing = links[index] ?? {};
    const metadata =
      typeof existing.metadata === "object" &&
      existing.metadata &&
      !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    if (value.trim()) metadata[field] = value;
    else delete metadata[field];
    links[index] = { ...existing, metadata: Object.keys(metadata).length ? metadata : undefined };
    commitLinks(loaded, links);
  };
  const addLink = () => {
    const loaded = resources.content();
    if (!loaded) return;
    const links = copyLinks(loaded);
    const id = `link-${Date.now()}`;
    links.push({ id, label: "New Link", url: "https://example.com", type: "simple" });
    commitLinks(loaded, links);
    baselineState.setExpandedLinkSections([resolveEditorLinkAccordionValue(links.length - 1, id)]);
  };
  const applyAdvancedJson = () => {
    const loaded = resources.content();
    if (!loaded) return;
    try {
      const draft = baselineState.advancedDraft();
      resources.setContent({
        ...loaded,
        profile: JSON.parse(draft.profile) as Record<string, unknown>,
        links: JSON.parse(draft.links) as Record<string, unknown>,
        site: JSON.parse(draft.site) as Record<string, unknown>,
      });
      setSaveMessage({ text: "Advanced JSON applied. Validate before saving.", tone: "status" });
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Invalid JSON draft",
        tone: "alert",
      });
    }
  };

  return {
    addLink,
    applyAdvancedJson,
    updateLink,
    updateLinkMetadata,
    updateProfile: (field: string, value: string) => updateRootRecord("profile", field, value),
    updateSite: (field: string, value: string) => updateRootRecord("site", field, value),
    updateSiteRecord,
  };
};

const createEditorOperations = (
  repoId: Accessor<string>,
  resources: ReturnType<typeof createEditorResources>,
  captureBaseline: (payload: RepoContentPayload) => void,
  setSaveMessage: Setter<SaveMessage | null>,
  setValidation: Setter<ValidationResult | null>,
) => {
  const save = async () => {
    const loaded = resources.content();
    if (!loaded) return;
    try {
      const result = await api.saveRepoContent(repoId(), loaded);
      setSaveMessage({
        text: `Saved ${result.commits.length} files. Deploy status: ${result.deployStatus.deploy}`,
        tone: "status",
      });
      captureBaseline(loaded);
      await Promise.all([
        resources.refetchDeploy(),
        resources.refetchOps(),
        resources.refetchContent(),
      ]);
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
      await Promise.all([resources.refetchOps(), resources.refetchDeploy()]);
    } catch (error) {
      setSaveMessage({
        text: error instanceof Error ? error.message : "Sync failed",
        tone: "alert",
      });
    }
  };
  const validate = async () => {
    const loaded = resources.content();
    if (!loaded) return;
    setSaveMessage(null);
    const result = await api.validateRepoContent(repoId(), loaded);
    setValidation(result);
    if (result.valid) setSaveMessage({ text: "Validation passed", tone: "status" });
  };

  return { save, triggerSync, validate };
};

export const createEditorPageController = (repoId: Accessor<string>) => {
  const resources = createEditorResources(repoId);
  const baselineState = createEditorBaselineState(resources);
  const [validation, setValidation] = createSignal<ValidationResult | null>(null);
  const [saveMessage, setSaveMessage] = createSignal<SaveMessage | null>(null);
  const [pendingConfirmAction, setPendingConfirmAction] = createSignal<StudioConfirmAction | null>(
    null,
  );
  const mutations = createEditorMutations(resources, baselineState, setSaveMessage);
  const operations = createEditorOperations(
    repoId,
    resources,
    baselineState.captureBaseline,
    setSaveMessage,
    setValidation,
  );
  const linksArray = createMemo(() => {
    const raw = resources.content()?.links as { links?: Record<string, unknown>[] } | undefined;
    return Array.isArray(raw?.links) ? raw.links : [];
  });
  const confirmDialogCopy = createMemo(() => {
    const action = pendingConfirmAction();
    return action ? resolveStudioConfirmDialogCopy(action) : null;
  });
  const confirmPendingAction = async () => {
    const action = pendingConfirmAction();
    if (!action) return;
    setPendingConfirmAction(null);
    await (action === "save" ? operations.save() : operations.triggerSync());
  };

  return {
    ...resources,
    ...baselineState,
    ...mutations,
    ...operations,
    confirmDialogCopy,
    confirmPendingAction,
    linksArray,
    pendingConfirmAction,
    saveMessage,
    setPendingConfirmAction,
    validation,
  };
};

export type EditorPageController = ReturnType<typeof createEditorPageController>;
