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
export const STUDIO_SHELL_NAV_OVERLAY_CLASS = "studio-shell-navigation-overlay";
export const STUDIO_SHELL_NAV_POSITIONER_CLASS = "studio-shell-navigation-positioner";
export const STUDIO_SHELL_NAV_DRAWER_CLASS = "studio-shell-navigation-drawer";

export const createStudioShellNavigationModel = () => ({
  dialogLabel: STUDIO_SHELL_NAV_DIALOG_LABEL,
  links: STUDIO_SHELL_NAV_LINKS,
  triggerLabel: STUDIO_SHELL_NAV_TRIGGER_LABEL,
});
