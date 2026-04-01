---
created: 2026-03-30T21:39
title: Fix referral card content column
area: ui
files:
  - src/components/cards/NonPaymentLinkCardShell.tsx:305
  - src/styles/base.css:1270
  - src/components/cards/referral-card-rendering.test.tsx:257
---

## Problem

Referral card disclosure content is not lining up with the normal card content column. The referral badge, benefit rows, terms copy, or related referral-specific text is being laid out in a way that makes it feel like a separate column from the main title/description/content stack instead of part of the same content column the rest of the non-payment card uses.

That breaks the intended shared-card layout and makes referral cards feel structurally different from normal cards in a way that reads like a layout bug rather than an intentional disclosure treatment.

## Solution

Adjust the shared non-payment card shell and supporting CSS so referral-specific content renders inside the same text/content column as the normal title, metadata, and description flow. Keep the referral badge/benefits/terms visible, but make them participate in the same column layout instead of splitting the referral chrome away from the main content stack.

Add or update focused rendering regression coverage so rich and simple referral cards prove the referral content stays in the intended column without regressing existing promo-image or non-referral card behavior.
