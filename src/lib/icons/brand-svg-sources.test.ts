import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { resolvePaymentRailLogoUrl } from "../payments/rail-logos";
import { PAYMENT_RAIL_TYPES, type PaymentRailType } from "../payments/types";
import {
  ACTIVE_PAYMENT_LOGO_SOURCE_ENTRIES,
  BRAND_SVG_SOURCE_ENTRIES,
  DEFERRED_BRAND_SVG_SOURCE_ENTRIES,
  findBrandSvgSourceEntry,
} from "./brand-svg-sources";

const ROOT = process.cwd();

test("active migrated non-simple brands have explicit source catalog entries", () => {
  for (const brandId of ["cluborange", "primal", "lemonade", "strike"]) {
    const entry = findBrandSvgSourceEntry(brandId);
    assert.ok(entry, `missing brand SVG source entry for ${brandId}`);
    assert.equal(entry?.status, "active");
    assert.ok(entry?.sourceUrl);
    assert.ok(entry?.surfaceTargets.length);
  }
});

test("every payment rail logo path has an active source entry and an asset on disk", () => {
  const activePaymentByRail = new Map(
    ACTIVE_PAYMENT_LOGO_SOURCE_ENTRIES.map((entry) => [entry.paymentRailType, entry]),
  );

  for (const railType of PAYMENT_RAIL_TYPES) {
    const entry = activePaymentByRail.get(railType);
    assert.ok(entry, `missing active payment-logo source entry for rail ${railType}`);

    const assetUrl = resolvePaymentRailLogoUrl({
      railType: railType as PaymentRailType,
    });
    assert.ok(assetUrl, `missing payment-logo asset URL for rail ${railType}`);
    assert.equal(
      assetUrl,
      entry?.paymentLogoAssetPath,
      `catalog asset path mismatch for rail ${railType}`,
    );

    assert.ok(assetUrl);
    const absoluteAssetPath = path.join(ROOT, "public", assetUrl.replace(/^\//u, ""));
    assert.ok(
      fs.existsSync(absoluteAssetPath),
      `missing payment-logo asset at ${absoluteAssetPath}`,
    );
  }
});

test("deferred brands are explicit in the source catalog", () => {
  assert.deepEqual(DEFERRED_BRAND_SVG_SOURCE_ENTRIES.map((entry) => entry.brandId).sort(), [
    "linkedin",
    "skype",
    "twitter",
  ]);
});

test("brand source catalog keeps one entry per brand id", () => {
  const brandIds = BRAND_SVG_SOURCE_ENTRIES.map((entry) => entry.brandId);
  assert.equal(new Set(brandIds).size, brandIds.length);
});
