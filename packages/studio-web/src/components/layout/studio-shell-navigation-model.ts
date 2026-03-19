export interface StudioShellNavLink {
  href: string;
  label: string;
}

export const STUDIO_SHELL_NAV_LINKS: readonly StudioShellNavLink[] = [
  { href: "/onboarding", label: "Onboarding" },
  { href: "/roadmap", label: "Roadmap" },
];

export const STUDIO_SHELL_NAV_TRIGGER_LABEL = "Open studio navigation";
export const STUDIO_SHELL_NAV_DIALOG_LABEL = "Studio navigation";

export const createStudioShellNavigationModel = () => ({
  dialogLabel: STUDIO_SHELL_NAV_DIALOG_LABEL,
  links: STUDIO_SHELL_NAV_LINKS,
  triggerLabel: STUDIO_SHELL_NAV_TRIGGER_LABEL,
});
