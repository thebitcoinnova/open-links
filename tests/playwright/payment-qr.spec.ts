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

const waitForRenderedQr = async (scope: Locator, ariaLabel: string): Promise<Locator> => {
  const qr = scope.getByRole("img", { name: ariaLabel });
  await expect(qr).toBeVisible();
  await expect(qr.locator("svg")).toHaveCount(1);
  return qr;
};

test("single-rail fixture keeps inline and fullscreen QR states stable", async ({ page }) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "single-inline");

  await waitForRenderedQr(card, "Bitcoin Tip Jar QR code");
  await expect(card).toHaveScreenshot("payment-qr-single-inline.png", screenshotOptions);

  await fullscreenButton(card).click();

  const dialog = page.getByRole("dialog", { name: "Bitcoin Tip Jar QR code" });
  await waitForRenderedQr(dialog, "Bitcoin Tip Jar payment QR code");
  await expect(dialog).toHaveScreenshot("payment-qr-fullscreen-dialog.png", screenshotOptions);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("toggle fixture reveals and hides a web payment QR", async ({ page }) => {
  await openFixturePage(page);

  const card = fixtureCard(page, "single-toggle");
  const qr = card.getByRole("img", { name: "Cash App Support QR code" });

  await expect(qr).toHaveCount(0);
  await card.getByRole("button", { name: "Show Cash App Support QR code" }).click();

  await waitForRenderedQr(card, "Cash App Support QR code");
  await expect(card).toHaveScreenshot("payment-qr-toggle-expanded.png", screenshotOptions);

  await card.getByRole("button", { name: "Hide Cash App Support QR code" }).click();
  await expect(qr).toHaveCount(0);
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
