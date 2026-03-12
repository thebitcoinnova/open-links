---
created: 2026-03-11T20:49
title: Fix first-render theme initialization
area: general
files:
  - index.html:1
  - src/routes/index.tsx:212
  - src/routes/index.tsx:352
  - src/lib/theme/mode-controller.ts:32
---

## Problem

The app still initializes the route-level `mode` signal to `"dark"` on first render and only corrects it in `onMount()` by reading the saved preference from `localStorage`. That means a user with a persisted light-mode preference can still get a wrong first paint before the app settles, which is the same class of bug as the refreshed analytics-view issue we just fixed, just expressed as a theme flash instead of a stuck page.

Because `index.html` does not currently set `data-mode` or `color-scheme` before the app boots, the incorrect initial mode can leak into the very first paint and any view-swap/theme-sensitive UI that renders before mount completes.

## Solution

Initialize the route `mode` signal from `resolveInitialMode(modePolicy)` instead of hardcoding `"dark"` so the runtime state is correct before mount. Then evaluate a small inline bootstrap script in `index.html` that reads the stored mode preference and applies `data-mode` / `color-scheme` early enough to eliminate first-paint theme flash entirely.

Keep the fix narrow: preserve the existing mode-policy behavior, keep `static-dark` and `static-light` deterministic, and add focused regression coverage for the helper logic so future route/theme changes do not reintroduce post-mount-only initialization.
