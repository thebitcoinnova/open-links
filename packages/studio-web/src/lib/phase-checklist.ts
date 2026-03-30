export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";

export interface PhaseTask {
  id: string;
  label: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface PhaseChecklist {
  id: string;
  title: string;
  summary: string;
  tasks: PhaseTask[];
}

export const phaseChecklist: PhaseChecklist[] = [
  {
    id: "phase-1",
    title: "Phase 1: Foundation",
    summary: "Platform scaffolding, workspace wiring, data model, and runtime setup.",
    tasks: [
      { id: "p1-1", label: "Monorepo package structure", status: "done", priority: "P0" },
      { id: "p1-2", label: "Database schema + migrations", status: "done", priority: "P0" },
      { id: "p1-3", label: "Docker + compose development setup", status: "done", priority: "P1" },
      { id: "p1-4", label: "Bun-first workspace + checks", status: "done", priority: "P1" },
      {
        id: "p1-5",
        label: "Docker dependency-drift guardrails (lockfile + CI path gate)",
        status: "done",
        priority: "P1",
      },
      {
        id: "p1-6",
        label: "Studio web package build no longer depends on root app source imports",
        status: "done",
        priority: "P1",
      },
    ],
  },
  {
    id: "phase-2",
    title: "Phase 2: Auth + Sessions",
    summary: "GitHub OAuth, app install validation, token/session lifecycle.",
    tasks: [
      { id: "p2-1", label: "OAuth start/callback endpoints", status: "done", priority: "P0" },
      { id: "p2-2", label: "Encrypted token persistence", status: "done", priority: "P0" },
      { id: "p2-3", label: "Refresh and retry hardening", status: "in_progress", priority: "P1" },
    ],
  },
  {
    id: "phase-3",
    title: "Phase 3: Onboarding",
    summary: "Guided no-code path: account guidance, app install, fork provisioning.",
    tasks: [
      { id: "p3-1", label: "Onboarding wizard UI", status: "done", priority: "P0" },
      { id: "p3-2", label: "Onboarding status/blockers endpoint", status: "done", priority: "P0" },
      {
        id: "p3-3",
        label: "Publishing verification UX improvements",
        status: "in_progress",
        priority: "P1",
      },
    ],
  },
  {
    id: "phase-4",
    title: "Phase 4: CRUD Editor",
    summary: "Guided editing for profile/links/site with advanced JSON mode.",
    tasks: [
      { id: "p4-1", label: "Guided forms for core files", status: "done", priority: "P0" },
      { id: "p4-2", label: "Advanced JSON editor", status: "done", priority: "P0" },
      {
        id: "p4-5",
        label: "Kobalte-backed editor navigation and mobile shell drawer refactor",
        status: "done",
        priority: "P1",
      },
      {
        id: "p4-3",
        label: "Expanded site.ui coverage, including analytics page visibility",
        status: "in_progress",
        priority: "P1",
      },
      {
        id: "p4-4",
        label: "Profile description field editing for rich social links",
        status: "in_progress",
        priority: "P1",
      },
      {
        id: "p4-6",
        label: "Kobalte select, accordion, and save/sync confirm UX polish",
        status: "done",
        priority: "P1",
      },
    ],
  },
  {
    id: "phase-5",
    title: "Phase 5: Save + Deploy Visibility",
    summary: "Schema validation, commit pipeline, operation logs, deploy feedback.",
    tasks: [
      { id: "p5-1", label: "Validation + commit pipeline", status: "done", priority: "P0" },
      { id: "p5-2", label: "Deploy status panel", status: "done", priority: "P0" },
      { id: "p5-3", label: "Conflict remediation UX", status: "todo", priority: "P1" },
    ],
  },
  {
    id: "phase-6",
    title: "Phase 6: Sync Worker",
    summary: "Scheduled upstream sync, conflict handling, and retry controls.",
    tasks: [
      { id: "p6-1", label: "Internal sync trigger + worker", status: "done", priority: "P0" },
      { id: "p6-2", label: "Conflict state management", status: "done", priority: "P0" },
      {
        id: "p6-3",
        label: "Railway schedule + observability",
        status: "in_progress",
        priority: "P1",
      },
      {
        id: "p6-4",
        label: "Shared fork-owned sync helper parity between Studio sync and repo automation",
        status: "done",
        priority: "P1",
      },
    ],
  },
  {
    id: "phase-7",
    title: "Phase 7: Security + Launch",
    summary: "Hardening, anti-abuse, tests, and operational readiness.",
    tasks: [
      { id: "p7-1", label: "Captcha and anti-abuse controls", status: "done", priority: "P0" },
      { id: "p7-2", label: "Webhook verification hardening", status: "done", priority: "P0" },
      { id: "p7-3", label: "Integration test suite", status: "done", priority: "P0" },
      {
        id: "p7-4",
        label: "Production env placeholder fail-fast preflight",
        status: "done",
        priority: "P0",
      },
      {
        id: "p7-5",
        label: "Accessibility remediation for onboarding/editor interaction semantics",
        status: "done",
        priority: "P1",
      },
      {
        id: "p7-6",
        label: "Security review checklist and incident runbook",
        status: "done",
        priority: "P1",
      },
      {
        id: "p7-7",
        label: "Launch checklist and production incident playbook",
        status: "done",
        priority: "P1",
      },
    ],
  },
];
