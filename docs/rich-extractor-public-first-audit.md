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

- GitHub: public HTML augmentation for avatar + follower/following counts
- Primal: generic public enrichment with profile-image normalization

Current authenticated reference examples:

- LinkedIn: interactive auth/session workflow
- Facebook: interactive auth/session workflow
