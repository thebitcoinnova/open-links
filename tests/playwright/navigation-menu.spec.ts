import { type Locator, type Page, expect, test } from "@playwright/test";

const fixturePath = "/__playwright/navigation-menu";

const openFixturePage = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Navigation menu fixtures", exact: true }),
  ).toBeVisible();
};

const openMobileDrawer = async (page: Page): Promise<Locator> => {
  const trigger = page.getByRole("button", { name: "Open site menu and display controls" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.getByRole("dialog", { name: "Site menu and display controls" });
  await expect(drawer).toBeVisible();
  return drawer;
};

const requireBoundingBox = async (
  locator: Locator,
  description: string,
): Promise<{ x: number; y: number; width: number; height: number }> => {
  const maybeBoundingBox = await locator.boundingBox();
  if (!maybeBoundingBox) {
    throw new Error(`${description} should have a bounding box`);
  }

  return maybeBoundingBox;
};

test.describe("navigation menu mobile drawer", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile-only navigation drawer coverage");

  test("keeps stacked navigation rows readable on narrow screens", async ({ page }) => {
    await openFixturePage(page);

    const drawer = await openMobileDrawer(page);
    const homeLink = drawer.getByRole("link", { name: /Home Return to the main links page\./ });
    const homeCopy = homeLink.locator(".utility-menu-row-copy");
    const homeBadge = homeLink.locator(".utility-menu-badge");

    await expect(homeCopy).toBeVisible();
    await expect(homeBadge).toBeVisible();

    const copyBox = await requireBoundingBox(homeCopy, "Home copy");
    const badgeBox = await requireBoundingBox(homeBadge, "Home badge");
    expect(copyBox.width).toBeGreaterThan(120);
    expect(badgeBox.y).toBeGreaterThan(copyBox.y + copyBox.height - 4);
  });

  test("closes the drawer after selecting a navigation destination", async ({ page }) => {
    await openFixturePage(page);

    const drawer = await openMobileDrawer(page);
    const homeLink = drawer.getByRole("link", { name: /Home Return to the main links page\./ });

    await homeLink.click();

    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Open site menu and display controls" }),
    ).toBeFocused();
  });
});
