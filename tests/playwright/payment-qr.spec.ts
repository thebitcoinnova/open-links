import { type Locator, type Page, expect, test } from "@playwright/test";

const fixturePath = "/__playwright/payment-qr";
const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
} as const;

const openFixturePage = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Payment QR fixtures" })).toBeVisible();
};

const fixtureCard = (page: Page, fixtureId: string): Locator =>
  page.locator(`[data-payment-qr-fixture="${fixtureId}"] .payment-link-card`);

const fullscreenButton = (scope: Locator): Locator =>
  scope.getByRole("button", { name: /(?:Open|Tap for) Full Screen/ });

const fullscreenQrActivator = (scope: Locator, railLabel: string): Locator =>
  scope.getByRole("button", {
    name: new RegExp(`(?:Open|Tap for) Full Screen for ${railLabel} QR code`),
  });

const waitForRenderedQr = async (scope: Locator, ariaLabel: string): Promise<Locator> => {
  const qr = scope.getByRole("img", { name: ariaLabel });
  await expect(qr).toBeVisible();
  await expect(qr.locator("svg")).toHaveCount(1);
  return qr;
};

const expectHorizontallyCentered = async (
  container: Locator,
  item: Locator,
  tolerance = 6,
): Promise<void> => {
  const [containerBox, itemBox] = await Promise.all([container.boundingBox(), item.boundingBox()]);

  expect(containerBox).not.toBeNull();
  expect(itemBox).not.toBeNull();

  if (!containerBox || !itemBox) {
    return;
  }

  const containerCenter = containerBox.x + containerBox.width / 2;
  const itemCenter = itemBox.x + itemBox.width / 2;

  expect(Math.abs(containerCenter - itemCenter)).toBeLessThanOrEqual(tolerance);
};

test("single-rail fixture keeps inline and fullscreen QR states stable", async ({ page }) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "single-inline");

  await waitForRenderedQr(card, "Bitcoin Tip Jar QR code");
  await expect(card).toHaveScreenshot("payment-qr-single-inline.png", screenshotOptions);

  await fullscreenQrActivator(card, "Bitcoin Tip Jar").click();

  const dialog = page.getByRole("dialog", { name: "Bitcoin Tip Jar QR code" });
  await waitForRenderedQr(dialog, "Bitcoin Tip Jar payment QR code");
  await expect(dialog).toHaveScreenshot("payment-qr-fullscreen-dialog.png", screenshotOptions);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("toggle fixture reveals, hides, and re-reveals a web payment QR without clipping", async ({
  page,
}) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "single-toggle");
  const qr = card.getByRole("img", { name: "Cash App Support QR code" });
  const qrPanel = card.locator(".payment-rail-qr-panel");

  await expect(qr).toHaveCount(0);
  await expect(qrPanel).toHaveCount(0);
  await card.getByRole("button", { name: "Show Cash App Support QR code" }).click();

  await waitForRenderedQr(card, "Cash App Support QR code");
  await expect(qrPanel).toHaveCount(1);
  await expect(fullscreenButton(card)).toBeVisible();

  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expectHorizontallyCentered(card, qrPanel);
  }

  await expect(card).toHaveScreenshot("payment-qr-toggle-expanded.png", screenshotOptions);

  await card.getByRole("button", { name: "Hide Cash App Support QR code" }).click();
  await expect(qr).toHaveCount(0);
  await expect(qrPanel).toHaveCount(0);

  await card.getByRole("button", { name: "Show Cash App Support QR code" }).click();
  await waitForRenderedQr(card, "Cash App Support QR code");
  await expect(qrPanel).toHaveCount(1);
  await expect(fullscreenButton(card)).toBeVisible();

  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expectHorizontallyCentered(card, qrPanel);
  }

  await expect(card).toHaveScreenshot("payment-qr-toggle-expanded.png", screenshotOptions);
});

test("multi-rail fixture expands a single rail without revealing the others", async ({ page }) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "multi-rail");

  await expect(card.locator(".payment-card-effects")).toHaveCount(1);
  await expect(card.locator(".payment-card-effects-particle--lightning")).toHaveCount(6);
  await expect(card.locator(".payment-card-effects-particle--glitter")).toHaveCount(7);
  await expect(card.getByRole("img", { name: "Lightning Support QR code" })).toHaveCount(0);
  await expect(card.getByRole("img", { name: "Project Cash App QR code" })).toHaveCount(0);

  await card.getByRole("button", { name: "Show Project Cash App QR code" }).click();

  await waitForRenderedQr(card, "Project Cash App QR code");
  await expect(card.getByRole("img", { name: "Lightning Support QR code" })).toHaveCount(0);
  await expect(card).toHaveScreenshot("payment-qr-multi-rail-expanded.png", screenshotOptions);
});

test("composite auto-badge fixture keeps the inline and fullscreen badge stable", async ({
  page,
}) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "composite-auto-badge");
  const qr = await waitForRenderedQr(card, "Club Orange Lightning QR code");

  await expect(qr.locator("svg image")).toHaveCount(1);
  await expect(fullscreenQrActivator(card, "Club Orange Lightning")).toBeVisible();
  await expect(card).toHaveScreenshot("payment-qr-composite-auto-badge.png", screenshotOptions);

  await fullscreenButton(card).click();

  const dialog = page.getByRole("dialog", { name: "Club Orange Lightning QR code" });
  const fullscreenQr = await waitForRenderedQr(dialog, "Club Orange Lightning payment QR code");

  await expect(fullscreenQr.locator("svg image")).toHaveCount(1);
  await expect(dialog).toHaveScreenshot(
    "payment-qr-composite-auto-badge-dialog.png",
    screenshotOptions,
  );
});
