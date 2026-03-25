# Rich Extractor Public-First Audit

Audit date: `2026-03-07`

This artifact records the current branch classification for every rich metadata extractor path that existed when the public-first workflow was adopted.

| Platform | Previous implementation surface | Public-source evidence | Final branch | Disposition |
|---|---|---|---|---|
| LinkedIn | `linkedin-auth-browser` | Direct fetch still returns `HTTP 999` / authwall metadata | `authenticated_required` | Keep on authenticated cache workflow |
| Facebook | `facebook-auth-browser` | Direct fetch still returns generic metadata and misses required rich-card image data | `authenticated_required` | Keep on authenticated cache workflow |
| Medium | `medium-auth-browser` | Stable public RSS/feed endpoint provides title, description, and image; public browser capture can overlay follower counts without authentication | `public_augmented` | Moved into built-in public augmentation + committed public cache, with optional public browser count refresh |
| X | `x-auth-browser` | Stable public oEmbed endpoint plus public avatar endpoint provide usable profile metadata | `public_augmented` | Moved into built-in public augmentation + committed public cache |
| Instagram | `instagram-auth-browser` | Public profile page metadata exposes title, description, image, and follower/following text | `public_augmented` | Moved into built-in public augmentation + committed public cache |
| YouTube | `youtube-auth-browser` | Public channel/profile page metadata exposes title, description, image, and subscriber text | `public_augmented` | Moved into built-in public augmentation + committed public cache |

Current public-profile reference examples outside the authenticated framework:

- Club Orange: direct public HTML metadata at `app.cluborange.org/<handle>` exposes title, bio, and avatar without authentication
- GitHub: public HTML augmentation for avatar + follower/following counts
- Primal: generic public enrichment with profile-image normalization
- Rumble: public `about` pages expose the authored description, follower count, avatar, and preview image without authentication
- Substack: canonical public profile fetch with original custom-domain source-label preservation

Current authenticated reference examples:

- LinkedIn: interactive auth/session workflow
- Facebook: interactive auth/session workflow

## Downstream Social-Card Consumers

This public-first/authenticated-required split now feeds multiple runtime and artifact surfaces:

- avatar-first social profile cards
- `profileDescription` precedence for supported profile links
- card/header audience metrics
- append-only follower-history artifacts under `public/history/followers/`
- analytics and share verification flows documented in `docs/social-card-verification.md`

## Current Audience-History Participants

As of `2026-03-10`, the public follower-history index currently exposes:

- GitHub
- Instagram
- Medium
- Primal
- Substack
- X
- YouTube

Those entries are published through `public/history/followers/index.json` and per-platform CSVs. The history pipeline is intentionally append-only and keeps audit columns for `linkId`, `platform`, `handle`, and `canonicalUrl` so maintainers can trace how a row was produced later.
