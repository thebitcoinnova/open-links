import type { SimpleIcon } from "simple-icons";
import type { Component } from "solid-js";

type IconProps = Record<string, unknown>;

// Utility and contact icons live here. Known-site brand geometry belongs in
// site-icon-graphics.ts so UI icons and QR badge composition share one source of truth.
// See brand-svg-sources.ts for the catalog that tracks brand-source decisions.

/** Generic mail icon (filled, 24x24). */
export const IconMail: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...props}
  >
    <title>Mail</title>
    <path d="M3.75 5.25A2.25 2.25 0 001.5 7.5v9a2.25 2.25 0 002.25 2.25h16.5A2.25 2.25 0 0022.5 16.5v-9a2.25 2.25 0 00-2.25-2.25H3.75zm.529 1.5h15.442L12 11.742 4.279 6.75zm16.63 1.147l-8.502 5.485a.75.75 0 01-.814 0L3.091 7.897A.747.747 0 003 8.25v8.25c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75V8.25a.747.747 0 00-.091-.353z" />
  </svg>
);

/** Three-line hamburger menu icon (24x24 stroke-based). */
export const IconMenu: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>Menu</title>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

/** Generic share icon (24x24 stroke-based). */
export const IconShare: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>Share</title>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 12v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
  </svg>
);

/** Generic copy icon (24x24 stroke-based). */
export const IconCopy: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>Copy</title>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 00-2 2v9" />
  </svg>
);

/** Generic QR code icon (24x24 stroke-based). */
export const IconQrCode: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>QR code</title>
    <path d="M4 4h6v6H4z" />
    <path d="M14 4h6v6h-6z" />
    <path d="M4 14h6v6H4z" />
    <path d="M14 14h2" />
    <path d="M18 14h2v2" />
    <path d="M14 18h2v2h-2z" />
    <path d="M18 18h2" />
    <path d="M20 20v0" />
  </svg>
);

/** Generic analytics icon (24x24 stroke-based). */
export const IconAnalytics: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>Analytics</title>
    <path d="M4 19h16" />
    <path d="M6 16v-3" />
    <path d="M10 16v-6" />
    <path d="M14 16V7" />
    <path d="M18 16V4" />
  </svg>
);

/** Generic open/external-link icon (24x24 stroke-based). */
export const IconOpen: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    {...props}
  >
    <title>Open</title>
    <path d="M14 5h5v5" />
    <path d="M10 14L19 5" />
    <path d="M19 14v4a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h4" />
  </svg>
);
