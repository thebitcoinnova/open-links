import type { SimpleIcon } from "simple-icons";
import type { Component } from "solid-js";

type IconProps = Record<string, unknown>;

/** Convert a Simple Icons object into a SolidJS component (24x24 viewBox, fill-only). */
export const createSimpleIcon = (icon: SimpleIcon): Component<IconProps> => {
  return (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      {...props}
    >
      <title>{icon.title}</title>
      <path d={icon.path} />
    </svg>
  );
};

/** Custom SVG path wrapper for brands missing from simple-icons. */
const createCustomIcon = (title: string, path: string): Component<IconProps> => {
  return (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      {...props}
    >
      <title>{title}</title>
      <path d={path} />
    </svg>
  );
};

/** LinkedIn "in" logomark. */
export const IconLinkedin: Component<IconProps> = createCustomIcon(
  "LinkedIn",
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
);

/** Twitter legacy bird mark. */
export const IconTwitter: Component<IconProps> = createCustomIcon(
  "Twitter",
  "M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z",
);

/** Skype speech-bubble logomark. */
export const IconSkype: Component<IconProps> = createCustomIcon(
  "Skype",
  "M12.069 18.874c-4.023 0-5.82-1.979-5.82-3.464 0-.765.561-1.296 1.333-1.296 1.723 0 1.273 2.477 4.487 2.477 1.641 0 2.55-.895 2.55-1.811 0-.551-.269-1.16-1.354-1.429l-3.576-.949c-2.886-.765-3.417-2.42-3.417-3.979 0-3.227 3.036-4.45 5.892-4.45 2.627 0 5.399 1.453 5.399 3.208 0 .79-.593 1.244-1.373 1.244-1.471 0-1.197-2.037-4.164-2.037-1.471 0-2.294.655-2.294 1.606 0 .944 1.149 1.247 2.148 1.49l2.651.627c2.886.686 3.773 2.381 3.773 4.134 0 2.618-2.013 4.629-6.235 4.629M23.43 13.454C23.764 12.346 23.94 11.176 23.94 9.963c0-5.27-4.311-9.54-9.628-9.54-1.064 0-2.09.17-3.053.493C10.08.313 8.72 0 7.278 0 3.263 0 0 3.213 0 7.178c0 1.341.319 2.608.878 3.738-.202.94-.31 1.92-.31 2.93 0 5.27 4.309 9.54 9.625 9.54 1.125 0 2.208-.19 3.217-.55C14.554 23.59 15.903 24 17.338 24 21.353 24 24.615 20.788 24.615 16.823c.002-1.174-.256-2.326-.74-3.38-.147.003-.295.006-.444.011z",
);

/** Generic wallet icon (filled, 24x24). */
export const IconWallet: Component<IconProps> = (props: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...props}
  >
    <title>Wallet</title>
    <path d="M21 7H3a1 1 0 00-1 1v10a2 2 0 002 2h16a2 2 0 002-2V8a1 1 0 00-1-1zm-3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    <path d="M4 7V5.5A1.5 1.5 0 015.5 4h11.382a1.5 1.5 0 011.342.829L19.5 7H4z" />
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
