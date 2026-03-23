# Enrichment Strategy Audit

Audit date: `2026-03-23`

This matrix is the migration source of truth for the unified enrichment strategy framework.

| Strategy | Branch | Source kind | Source rewrite | Normalization focus | Placeholder / blocker handling | Cache / policy dependencies |
| --- | --- | --- | --- | --- | --- | --- |
| `public-direct-html` | `public_direct` | `html` | none | generic title/description/image extraction from HTML + JSON-LD | known-blocker policy enforced unless a public augmentation strategy replaces it | `public_rich_metadata`, public cache |
| `primal-public-profile` | `public_augmented` | `html` | none | avatar-first profile normalization, handle extraction | provider-specific DOM/content placeholder detection | `public_rich_metadata`, public cache |
| `medium-public-feed` | `public_augmented` | `xml` | profile URL -> Medium RSS feed | feed title/description/image + profile image/handle normalization | feed challenge/sign-in placeholder detection | `public_rich_metadata`, public cache |
| `substack-public-profile` | `public_augmented` | `html` | custom domain -> canonical `substack.com/@handle` when available | JSON-LD + preload extraction, canonical handle, profile image vs preview image selection | generic page validity via parsed metadata; no auth blocker path | `public_rich_metadata`, public cache |
| `x-public-oembed` | `public_augmented` | `oembed` | profile URL -> `publish.twitter.com/oembed` | oEmbed title + synthetic description/avatar-first normalization | oEmbed unavailable/sign-in/challenge checks | `public_rich_metadata`, public cache |
| `instagram-public-profile` | `public_augmented` | `html` | canonical profile URL normalization | public page title/description/image + follower/following extraction | login/challenge/not-found checks | `public_rich_metadata`, public cache |
| `youtube-public-profile` | `public_augmented` | `html` | canonical channel/profile URL normalization | public page metadata + thumbnail/profile image + subscriber extraction | consent/sign-in/challenge/unavailable checks | `public_rich_metadata`, public cache |
| `linkedin-auth-browser` | `authenticated_required` | `authenticated_browser` | none | authenticated DOM extraction + asset download + diagnostics | authwall/login placeholder checks in `ensureSession` and extraction | authenticated extractor policy, authenticated cache, `authenticated_asset_images` |
| `facebook-auth-browser` | `authenticated_required` | `authenticated_browser` | none | authenticated DOM extraction + candidate image scoring + asset download | login/MFA/consent/blocked handling through auth-flow runtime | authenticated extractor policy, authenticated cache, `authenticated_asset_images` |

