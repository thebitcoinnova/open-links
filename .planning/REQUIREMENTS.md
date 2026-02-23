# Requirements: OpenLinks

**Defined:** 2026-02-22
**Core Value:** A developer can fork/template the repo, edit structured link data, and reliably publish a polished personal links site with minimal friction.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Repository Bootstrap

- [ ] **BOOT-01**: Developer can create a personal OpenLinks project by forking or templating the repository.
- [ ] **BOOT-02**: Repository provides starter data/theme files that render a working site without additional setup.
- [ ] **BOOT-03**: README documents bootstrap flow from fork/template to first deploy.

### Data Model & Validation

- [ ] **DATA-01**: User can define profile identity content (name, bio, avatar, social metadata) in JSON.
- [ ] **DATA-02**: User can define links in JSON with required canonical fields (`id`, `label`, `url`, `type`, visibility/order controls).
- [x] **DATA-03**: User can choose card type per link (`simple` or `rich`) through JSON config.
- [ ] **DATA-04**: Build fails with actionable errors when JSON content violates schema.
- [ ] **DATA-05**: URL fields are validated and restricted to approved schemes (`http`/`https`).
- [ ] **DATA-06**: Unknown/extended metadata fields can be stored in a safe extension area without breaking core schema.

### UI & Experience

- [x] **UI-01**: Site renders a profile page with a sleek card-based layout from JSON data.
- [x] **UI-02**: Simple cards render platform icon, label, and destination link.
- [x] **UI-03**: Rich cards render optional preview fields (for example title/description/image) with graceful fallback when absent.
- [x] **UI-04**: UI is fully responsive and usable on common mobile and desktop breakpoints.
- [x] **UI-05**: Default visual mode is dark with a user-selectable light mode.
- [x] **UI-06**: Theme choice persists across page reloads.

### Theme & Customization

- [x] **THEME-01**: Project includes at least two starter themes selectable by configuration.
- [x] **THEME-02**: Theme system uses tokens/variables so forks can add new themes without rewriting core card logic.
- [ ] **THEME-03**: Project exposes a documented path for custom CSS overrides.
- [ ] **THEME-04**: Project exposes documented layout template hooks for deeper UI customization.

### Deployment & CI

- [x] **DEP-01**: GitHub Actions validates schema and content on pull requests and pushes.
- [x] **DEP-02**: GitHub Actions builds the static SolidJS site on mainline changes.
- [x] **DEP-03**: GitHub Actions deploys build artifacts to GitHub Pages automatically.
- [x] **DEP-04**: Deployment configuration supports repository/project-page base path handling.
- [ ] **DEP-05**: Deployment workflow is structured so non-GitHub target adapters can be added later without app-code rewrites.

### Quality (Performance, Accessibility, SEO)

- [ ] **QUAL-01**: Generated site includes strong page-level SEO metadata (title, description, canonical/social tags).
- [ ] **QUAL-02**: Card interactions are keyboard accessible and screen-reader friendly.
- [ ] **QUAL-03**: Color contrast and focus styles meet accessibility baseline.
- [ ] **QUAL-04**: Production build is optimized for fast load and low client JS overhead.
- [ ] **QUAL-05**: CI includes automated checks for at least baseline performance/accessibility/SEO regressions.

### Documentation & Extensibility

- [ ] **DOC-01**: README documents JSON schema model with examples for simple and rich links.
- [ ] **DOC-02**: README documents theming and customization extension points for fork maintainers.
- [ ] **DOC-03**: README documents GitHub Pages deploy flow and troubleshooting basics.
- [ ] **DOC-04**: Project documents future deployment adapter interface expectations.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Tooling & Editing

- **TOOL-01**: User can manage link/profile data through a CLI CRUD workflow.
- **TOOL-02**: Repository includes an AI skill that supports guided CRUD operations on backing JSON data.
- **TOOL-03**: Optional in-site editor can open a pull request against the user repository with validated data updates.

### Deployment Expansion

- **HOST-01**: Project includes first-class deployment adapters beyond GitHub Pages (for example AWS/Railway).
- **HOST-02**: Project supports a documented custom-domain setup assistant flow.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Auth/account system | V1 assumes developer-managed repos and git-based edits |
| Analytics dashboard | Not required to validate core publish-and-share value |
| Full CMS | Conflicts with developer-first JSON workflow for v1 |
| Plugin marketplace | Premature platform complexity |
| Non-developer onboarding UX | Initial audience is developers and AI-agent-assisted maintainers |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 1 | Complete |
| BOOT-02 | Phase 1 | Complete |
| BOOT-03 | Phase 6 | Pending |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 3 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| UI-01 | Phase 2 | Complete |
| UI-02 | Phase 2 | Complete |
| UI-03 | Phase 3 | Complete |
| UI-04 | Phase 2 | Complete |
| UI-05 | Phase 2 | Complete |
| UI-06 | Phase 2 | Complete |
| THEME-01 | Phase 2 | Complete |
| THEME-02 | Phase 2 | Complete |
| THEME-03 | Phase 6 | Pending |
| THEME-04 | Phase 6 | Pending |
| DEP-01 | Phase 4 | Complete |
| DEP-02 | Phase 4 | Complete |
| DEP-03 | Phase 4 | Complete |
| DEP-04 | Phase 4 | Complete |
| DEP-05 | Phase 6 | Pending |
| QUAL-01 | Phase 5 | Pending |
| QUAL-02 | Phase 5 | Pending |
| QUAL-03 | Phase 5 | Pending |
| QUAL-04 | Phase 5 | Pending |
| QUAL-05 | Phase 5 | Pending |
| DOC-01 | Phase 6 | Pending |
| DOC-02 | Phase 6 | Pending |
| DOC-03 | Phase 6 | Pending |
| DOC-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-02-22*
*Last updated: 2026-02-23 after Phase 4 completion*
