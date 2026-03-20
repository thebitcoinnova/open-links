# Surface Patterns

Use this file after resolving the fork's canonical URL and preferred display label.

## 1. Websites and app UIs

Default order:

1. Footer
2. About page or profile panel
3. Settings or account page
4. Header or nav only when the user explicitly wants more self-promotion

Promotion modes:

- `subtle`: text link in the footer or profile meta row
- `standard`: small icon plus link in footer/about/profile
- `prominent`: dedicated "Find me" card or profile module, still secondary to the host product brand

Use the favicon badge for tight slots and the full logo mark when the layout has room.

## 2. README and docs

Default order:

1. Existing author/contact section
2. New `Find me` or `Links` section near the end
3. Intro area only when the repository is intentionally personal-brand-forward

## 3. Package and app metadata

Look for fields such as:

- `homepage`
- `author.url`
- marketplace website or support URL fields
- profile/about metadata surfaces

Choose the most semantically correct field instead of pasting the URL into every available slot.

## 4. Service profiles

Prefer built-in profile fields in this order:

1. website URL
2. profile/about/bio link section
3. custom button or featured link slot
4. icon or avatar only if the service explicitly supports it

## 5. Web metadata

Add metadata only when the page already exposes editable head or metadata config.

Recommended additions:

- visible link in page body
- `rel="me"` on self-owned profile links when identity verification or discovery matters
- JSON-LD `sameAs` using the fork's deployed URL when the site already emits structured data

## Anti-patterns

- Do not recommend both header and footer placement by default.
- Do not suggest modal or popup promotion.
- Do not replace the host project's primary brand with the OpenLinks fork logo.
- Do not guess the fork URL when `quality.seo.canonicalBaseUrl` is absent.

## Verification checklist

- The chosen surface is easy to find but not dominant.
- The URL matches the fork's canonical deployed OpenLinks URL.
- The icon source matches the available space and file-type requirements.
- The host project's primary brand is still visually primary.
- Metadata additions match the visible identity surface instead of contradicting it.
