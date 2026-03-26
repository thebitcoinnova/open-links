import { type Locator, type Page, expect, test } from "@playwright/test";

const fixturePath = "/__playwright/navigation-menu";

const openFixturePage = async (page: Page) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(fixturePath, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: "Navigation menu fixtures", exact: true }),
  ).toBeVisible();
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

const readWidthMetrics = async (
  locator: Locator,
): Promise<{ clientWidth: number; scrollWidth: number }> =>
  locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

const openDesktopSiteMenu = async (page: Page): Promise<{ panel: Locator; trigger: Locator }> => {
  const trigger = page.getByRole("button", { name: "Open site menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const panel = page.getByRole("dialog", { name: "Site menu" });
  await expect(panel).toBeVisible();
  await expect(page.locator(".utility-menu-overlay")).toHaveCount(0);
  const openTrigger = page.getByRole("button", { name: "Close site menu" });
  await expect(openTrigger).toBeVisible();

  return { panel, trigger: openTrigger };
};

const openMobileSiteMenu = async (page: Page): Promise<{ panel: Locator; trigger: Locator }> => {
  const trigger = page.getByRole("button", { name: "Open site menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const panel = page.getByRole("dialog", { name: "Site menu" });
  await expect(panel).toBeVisible();
  await expect(page.locator(".utility-menu-overlay")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close site menu" })).toBeVisible();

  return { panel, trigger };
};

test.describe("navigation menu mobile layout", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile-only navigation menu coverage");

  test("opens as a drawer dialog with only tappable rows", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 390, height: 844 });
    await openFixturePage(page);
    const fixtureArticle = page.locator("article").first();
    const topBar = page.locator(".top-utility-bar");
    const articleBoxBeforeOpen = await requireBoundingBox(
      fixtureArticle,
      "Fixture article before open",
    );
    const topBarBoxBeforeOpen = await requireBoundingBox(topBar, "Top utility bar before open");

    // Act
    const { panel } = await openMobileSiteMenu(page);
    const rowTypes = await panel
      .locator(".utility-menu-list > *")
      .evaluateAll((elements) => elements.map((element) => element.tagName.toLowerCase()));
    const articleBoxAfterOpen = await requireBoundingBox(
      fixtureArticle,
      "Fixture article after open",
    );
    const topBarBoxAfterOpen = await requireBoundingBox(topBar, "Top utility bar after open");
    const panelBox = await requireBoundingBox(panel, "Site menu panel");
    const viewportWidth = page.viewportSize()?.width ?? 390;

    // Assert
    expect(rowTypes).toEqual(["a", "a", "a", "button"]);
    expect(Math.abs(topBarBoxAfterOpen.height - topBarBoxBeforeOpen.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(articleBoxAfterOpen.y - articleBoxBeforeOpen.y)).toBeLessThanOrEqual(1);
    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("keeps the flat row stack readable without horizontal overflow on narrow screens", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 320, height: 700 });
    await openFixturePage(page);

    // Act
    const { panel } = await openMobileSiteMenu(page);
    const homeLink = panel.getByRole("link", { name: "Home", exact: true });
    const analyticsLink = panel.getByRole("link", { name: "Analytics", exact: true });
    const panelMetrics = await readWidthMetrics(panel);
    const homeBox = await requireBoundingBox(homeLink, "Home row");
    const analyticsBox = await requireBoundingBox(analyticsLink, "Analytics row");
    const panelBox = await requireBoundingBox(panel, "Site menu panel");

    // Assert
    expect(panelMetrics.scrollWidth).toBeLessThanOrEqual(panelMetrics.clientWidth + 1);
    expect(homeBox.width).toBeGreaterThanOrEqual(panelBox.width - 28);
    expect(analyticsBox.width).toBeGreaterThanOrEqual(panelBox.width - 28);
  });

  test("closes via overlay interaction and restores focus to the trigger", async ({ page }) => {
    // Arrange
    await openFixturePage(page);
    await openMobileSiteMenu(page);

    // Act
    await page.locator(".utility-menu-overlay").click({ position: { x: 8, y: 8 } });

    // Assert
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
  });

  test("closes via Escape and restores focus to the trigger", async ({ page }) => {
    // Arrange
    await openFixturePage(page);
    await openMobileSiteMenu(page);

    // Act
    await page.keyboard.press("Escape");

    // Assert
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
  });

  test("closes and restores focus after selecting a navigation row", async ({ page }) => {
    // Arrange
    await openFixturePage(page);
    const { panel } = await openMobileSiteMenu(page);

    // Act
    await panel.getByRole("link", { name: "Home", exact: true }).click();

    // Assert
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
  });

  test("keeps the final row reachable on short mobile viewports", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 390, height: 520 });
    await openFixturePage(page);

    // Act
    const { panel } = await openMobileSiteMenu(page);
    const themeButton = panel.getByRole("button", { name: "Switch to light mode", exact: true });
    const viewportHeight = page.viewportSize()?.height ?? 520;
    const themeButtonBox = await requireBoundingBox(themeButton, "Theme action row");

    // Assert
    expect(themeButtonBox.y + themeButtonBox.height).toBeLessThanOrEqual(viewportHeight);
  });

  test("toggles the theme row and closes the menu", async ({ page }) => {
    // Arrange
    await openFixturePage(page);
    const { panel } = await openMobileSiteMenu(page);

    // Act
    await panel.getByRole("button", { name: "Switch to light mode", exact: true }).click();

    // Assert
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
    await expect.poll(() => page.locator("html").getAttribute("data-mode")).toBe("light");

    const { panel: reopenedPanel } = await openMobileSiteMenu(page);
    await expect(
      reopenedPanel.getByRole("button", { name: "Switch to dark mode", exact: true }),
    ).toBeVisible();
  });
});

test.describe("navigation menu desktop layout", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop-only navigation menu coverage");

  test("opens as the same floating region below the top bar on desktop", async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 1100, height: 900 });
    await openFixturePage(page);
    const fixtureArticle = page.locator("article").first();
    const topBar = page.locator(".top-utility-bar");
    const articleBoxBeforeOpen = await requireBoundingBox(
      fixtureArticle,
      "Desktop fixture article before open",
    );
    const topBarBoxBeforeOpen = await requireBoundingBox(
      topBar,
      "Desktop top utility bar before open",
    );

    // Act
    const { panel, trigger } = await openDesktopSiteMenu(page);
    const articleBoxAfterOpen = await requireBoundingBox(
      fixtureArticle,
      "Desktop fixture article after open",
    );
    const topBarBoxAfterOpen = await requireBoundingBox(
      topBar,
      "Desktop top utility bar after open",
    );
    const triggerBox = await requireBoundingBox(trigger, "Desktop site menu trigger");
    const panelBox = await requireBoundingBox(panel, "Desktop site menu panel");
    const viewportWidth = page.viewportSize()?.width ?? 1100;

    // Assert
    expect(panelBox.y).toBeGreaterThan(triggerBox.y + triggerBox.height - 4);
    expect(Math.abs(topBarBoxAfterOpen.height - topBarBoxBeforeOpen.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(articleBoxAfterOpen.y - articleBoxBeforeOpen.y)).toBeLessThanOrEqual(1);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("closes and restores focus after selecting the analytics row on desktop", async ({
    page,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1100, height: 900 });
    await openFixturePage(page);
    const { panel } = await openDesktopSiteMenu(page);

    // Act
    await panel.getByRole("link", { name: "Analytics", exact: true }).click();

    // Assert
    await expect(page.getByRole("dialog", { name: "Site menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
  });
});
