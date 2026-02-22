# Phase 1: Bootstrap + Data Contract - Research

**Researched:** 2026-02-22
**Domain:** SolidJS static app bootstrap + JSON schema validation pipeline
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use an extended profile model in v1 (core identity plus richer profile metadata blocks).
- Link objects use required baseline identity fields plus metadata-capable fields.
- Support hybrid organization: flat list is valid, optional user-defined groups are valid, and explicit user-defined ordering is supported.
- Unknown fields may exist at top level with warnings (non-failing in non-strict mode).
- Validation model supports errors, warnings, and an optional strict mode that can fail on warnings.
- Validation runs locally in prebuild flows and in CI.
- URL policy allows `http`, `https`, and selected special schemes (`mailto`, `tel`).
- Validation output must provide human-friendly and machine-readable forms.
- Validation messages should include remediation guidance where possible.
- Support both top-level and per-entity custom blocks.
- Core/custom key conflicts fail validation explicitly.
- Custom fields get basic type validation.
- Custom compatibility is best-effort, not a hard stability contract.
- Starter fork should include minimal profile + 3 links.
- Data should be split into files with an examples directory.
- README should include local validate/build and first-publish checklist.
- Include two starter themes in config with one active by default.

### Claude's Discretion
- Exact JSON field names and naming style where semantics are preserved.
- Exact error/warning layout so long as human + machine-readable outputs exist.
- Exact examples/docs folder naming so long as split-file + examples strategy is maintained.

### Deferred Ideas (OUT OF SCOPE)
- None.

## Summary

Phase 1 should establish deterministic project foundations, not polish UI. The strongest approach is: scaffold SolidStart with split content files (`profile`, `links`, `site/theme`), define explicit JSON Schemas, and enforce validation through an executable script wired into local prebuild and CI-ready commands.

For validation, the practical standard is AJV + ajv-formats with custom rule checks for project-specific policies (custom-key collisions, scheme allowlist, warning model). Keep schema strict for core keys but permit extension blocks and top-level unknown fields as warnings, then let strict mode elevate warnings to failure.

Primary recommendation: implement schema validation as a dedicated script with dual output modes (readable table + structured JSON), then make `npm run validate:data` a mandatory step in build/prebuild commands from day one.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@solidjs/start` + `solid-js` | `1.3.0` + `1.9.11` | Static-capable app scaffold for OpenLinks | Official Solid path for app routing/build and future expansion. |
| `typescript` | `5.9.3` | Typed data contracts and scripts | Prevents drift between schema, loader, and render logic. |
| `ajv` + `ajv-formats` | `8.18.0` + `3.0.1` | JSON Schema validation + URL/email/date formats | Fast, stable, CI-friendly validator for schema-first workflows. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json-schema-to-ts` | `3.1.1` | Infer TypeScript types from schema | Use if you want schema-as-source for runtime + type safety. |
| `zod` | `4.3.6` | Alternative runtime validation | Use only if moving away from JSON Schema interop goals. |
| `vitest` | `4.0.18` | Validation script tests | Use for fixtures: valid/invalid data + strict-mode behavior. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AJV + JSON Schema | Zod-only contracts | Simpler local TS ergonomics, weaker schema interoperability for fork tooling. |
| SolidStart app scaffold | Vite + `vite-plugin-solid` | Slightly simpler bootstrap, less built-in app structure for growth. |

**Installation:**

```bash
npm install @solidjs/start solid-js ajv ajv-formats
npm install -D typescript vitest json-schema-to-ts
```

## Architecture Patterns

### Recommended Project Structure

```text
.github/
  workflows/

data/
  profile.json
  links.json
  site.json
  examples/
    minimal/
      profile.json
      links.json
      site.json

schema/
  profile.schema.json
  links.schema.json
  site.schema.json

scripts/
  validate-data.ts
  validation/
    format-errors.ts

src/
  lib/content/
    load-content.ts
```

### Pattern 1: Schema-First Contract + Policy Layer

**What:** Keep structural rules in schema and project-specific semantics in script policy checks.
**When to use:** Always for configurable template repos where contributors and AI agents edit data.
**Example:**

```typescript
const profileOk = ajv.validate(profileSchema, profile);
const policyIssues = checkPolicyRules({ profile, links, site });
```

### Pattern 2: Warning Escalation via Strict Mode

**What:** Distinguish hard errors from warnings and promote warnings to failures under strict mode.
**When to use:** When onboarding should be forgiving but CI can be made stricter by maintainers.
**Example:**

```typescript
const hasBlocking = errors.length > 0 || (strictMode && warnings.length > 0);
process.exit(hasBlocking ? 1 : 0);
```

### Anti-Patterns to Avoid
- **Validation only in CI:** slows feedback loop and increases churn for contributors.
- **Unknown-field hard failure everywhere:** blocks customization and fork experimentation.
- **Human-only error output:** limits AI/tool integration and machine checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing + ad-hoc checks | Custom nested if/else validators | AJV schemas + targeted policies | Reduces edge-case misses and keeps contract explicit. |
| URL parsing regexes | Handwritten URL regex | WHATWG URL parsing + scheme allowlist | Regex URL validation is brittle and hard to maintain. |
| Error formatting per command | Repeated one-off formatter code | Shared formatter utility | Keeps warnings/errors consistent across local and CI usage. |

**Key insight:** use mature validators for structure and spend custom logic only on OpenLinks-specific policy semantics.

## Common Pitfalls

### Pitfall 1: Schema and docs diverge
**What goes wrong:** README examples no longer match accepted schema.
**Why it happens:** docs are edited independently from validation fixtures.
**How to avoid:** maintain fixtures under `data/examples/` and validate them in tests.
**Warning signs:** starter data fails immediately after clone.

### Pitfall 2: Strict mode is unclear
**What goes wrong:** contributors cannot tell why local pass becomes CI fail.
**Why it happens:** strict escalation rules are undocumented or inconsistently implemented.
**How to avoid:** print strict-mode banner and include remediation hints in output.
**Warning signs:** repeated contributor confusion around warnings vs failures.

### Pitfall 3: Custom-field conflicts are silently accepted
**What goes wrong:** custom keys shadow core behavior and produce unpredictable rendering later.
**Why it happens:** no explicit conflict detector between core and custom namespaces.
**How to avoid:** fail fast when custom keys collide with reserved core keys.
**Warning signs:** runtime behavior differs unexpectedly after metadata customization.

## Code Examples

### AJV setup for multiple schemas

```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

ajv.addSchema(profileSchema, "profile");
ajv.addSchema(linksSchema, "links");
ajv.addSchema(siteSchema, "site");
```

### Dual-mode output model

```typescript
if (output === "json") {
  console.log(JSON.stringify({ errors, warnings }, null, 2));
} else {
  printHumanSummary(errors, warnings);
}
```

### URL scheme allowlist check

```typescript
const allowed = new Set(["http:", "https:", "mailto:", "tel:"]);
const scheme = new URL(value).protocol;
if (!allowed.has(scheme)) {
  warnings.push({ path, message: `Unsupported scheme ${scheme}` });
}
```

## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad-hoc JSON config checks | Schema-first + CI validation | Ongoing ecosystem norm | Better reliability for template/fork projects. |
| Single opaque validation output | Human + machine dual output | Current tooling expectation | Better local debugging and automation integration. |

**Deprecated/outdated:**
- Large custom regex-based validators for URLs and metadata fields.

## Open Questions

1. **Reserved key policy scope**
   - What we know: collisions must fail explicitly.
   - What's unclear: whether reserved key list should include future-only keys now.
   - Recommendation: maintain a conservative reserved-key set and expand with changelog notes.

2. **Strict mode default target**
   - What we know: strict mode is required as an option.
   - What's unclear: whether default CI should run strict from phase 1 or phase 4.
   - Recommendation: implement flag now; decide default CI behavior in Phase 4 workflow hardening.

## Sources

### Primary (HIGH confidence)
- Phase 1 context: `.planning/phases/01-bootstrap-data-contract/01-CONTEXT.md`
- Existing project artifacts: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
- npm registry version checks gathered in current workspace session

### Secondary (MEDIUM confidence)
- Solid and static-site ecosystem conventions captured in `.planning/research/STACK.md`

## Metadata

**Research scope:** bootstrap architecture, JSON schema strategy, validation UX, extension safety

**Confidence breakdown:**
- Standard stack: HIGH
- Architecture: HIGH
- Pitfalls: HIGH
- Code examples: MEDIUM

**Research date:** 2026-02-22
**Valid until:** 2026-03-24

---

*Phase: 01-bootstrap-data-contract*
*Research completed: 2026-02-22*
*Ready for planning: yes*
