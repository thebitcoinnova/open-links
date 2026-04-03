import { type Locator, type Page, expect, test } from "@playwright/test";

const fixturePath = "/__playwright/referral-card";
const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
} as const;

const openFixturePage = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Referral card fixtures" })).toBeVisible();
};

const fixtureCard = (page: Page): Locator =>
  page.locator('[data-referral-card-fixture="cluborange-rich"] .non-payment-card-frame');

test("club orange referral card keeps the terms rail aligned with the summary column", async ({
  page,
}) => {
  await openFixturePage(page);

  const card = fixtureCard(page);
  const summary = card.locator(".non-payment-card-summary");
  const secondaryLinks = card.locator(".non-payment-card-secondary-links");
  const termsLink = card.locator(".non-payment-card-referral-terms-link");

  await expect(summary).toBeVisible();
  await expect(secondaryLinks).toBeVisible();
  await expect(termsLink).toBeVisible();

  const summaryBox = await summary.boundingBox();
  const railBox = await secondaryLinks.boundingBox();
  const termsBox = await termsLink.boundingBox();

  expect(summaryBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  expect(termsBox).not.toBeNull();

  if (!summaryBox || !railBox || !termsBox) {
    return;
  }

  if ((page.viewportSize()?.width ?? 1440) > 760) {
    expect(Math.abs(summaryBox.x - railBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(summaryBox.width - railBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(railBox.x - termsBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(railBox.width - termsBox.width)).toBeLessThanOrEqual(2);
  }

  await expect(card).toHaveScreenshot("referral-card-cluborange-rich.png", screenshotOptions);
});
