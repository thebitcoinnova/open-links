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
  const trigger = page.getByRole("button", { name: "Open site menu" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.getByRole("dialog", { name: "Site menu" });
  await expect(drawer).toBeVisible();
  return drawer;
};

const openDesktopPopover = async (page: Page): Promise<Locator> => {
  const trigger = page.locator(".utility-menu-button--desktop");
  await expect(trigger).toBeVisible();
  await trigger.click();

  const panel = page.locator(".utility-menu-panel");
  await expect(panel).toBeVisible();
  return panel;
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

const readScrollMetrics = async (
  locator: Locator,
): Promise<{ clientHeight: number; scrollHeight: number; scrollTop: number }> =>
  locator.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));

const readWidthMetrics = async (
  locator: Locator,
): Promise<{ clientWidth: number; scrollWidth: number }> =>
  locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));

test.describe("navigation menu mobile drawer", () => {
  test.skip(({ isMobile }) => !isMobile, "Mobile-only navigation drawer coverage");

  test("keeps stacked navigation rows readable on narrow screens", async ({ page }) => {
    await openFixturePage(page);

    const drawer = await openMobileDrawer(page);
    const homeLink = drawer.getByRole("link", { name: /Home Links and profile/u });
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
    const homeLink = drawer.getByRole("link", { name: /Home Links and profile/u });

    await homeLink.click();

    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "Open site menu" })).toBeFocused();
  });

  test("stacks drawer header controls without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openFixturePage(page);

    const drawer = await openMobileDrawer(page);
    const header = drawer.locator(".utility-menu-header");
    const headerCopy = header.locator(".utility-menu-header-copy");
    const headerActions = header.locator(".utility-menu-header-actions");
    const closeButton = drawer.getByRole("button", { name: "Close Site menu" });

    await expect(headerCopy).toBeVisible();
    await expect(closeButton).toBeVisible();

    const headerFlexDirection = await header.evaluate(
      (element) => getComputedStyle(element).flexDirection,
    );
    expect(headerFlexDirection).toBe("column");

    const drawerBox = await requireBoundingBox(drawer, "Drawer");
    const headerCopyBox = await requireBoundingBox(headerCopy, "Drawer header copy");
    const headerActionsBox = await requireBoundingBox(headerActions, "Drawer header actions");
    const closeButtonBox = await requireBoundingBox(closeButton, "Drawer close button");
    const drawerWidthMetrics = await readWidthMetrics(drawer);

    expect(headerCopyBox.width).toBeGreaterThan(drawerBox.width - 48);
    expect(headerActionsBox.y).toBeGreaterThan(headerCopyBox.y + headerCopyBox.height - 4);
    expect(closeButtonBox.x + closeButtonBox.width).toBeLessThanOrEqual(
      drawerBox.x + drawerBox.width + 1,
    );
    expect(drawerWidthMetrics.scrollWidth).toBeLessThanOrEqual(drawerWidthMetrics.clientWidth + 1);
  });

  test("keeps the final menu items reachable on short mobile viewports", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 520 });
    await openFixturePage(page);

    const drawer = await openMobileDrawer(page);
    const paymentGalleryLink = drawer.getByRole("link", {
      name: /Tip card sparks Visual effect sandbox/u,
    });
    const viewportHeight = page.viewportSize()?.height ?? 520;

    const initialDrawerMetrics = await readScrollMetrics(drawer);
    const drawerBox = await requireBoundingBox(drawer, "Drawer");
    expect(drawerBox.y + drawerBox.height).toBeLessThanOrEqual(viewportHeight);
    const paymentGalleryBoxBeforeScroll = await requireBoundingBox(
      paymentGalleryLink,
      "Payment gallery link",
    );

    if (initialDrawerMetrics.scrollHeight > initialDrawerMetrics.clientHeight) {
      expect(
        paymentGalleryBoxBeforeScroll.y + paymentGalleryBoxBeforeScroll.height,
      ).toBeGreaterThan(drawerBox.y + drawerBox.height);

      await drawer.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect.poll(async () => (await readScrollMetrics(drawer)).scrollTop).toBeGreaterThan(0);

      const paymentGalleryBoxAfterScroll = await requireBoundingBox(
        paymentGalleryLink,
        "Payment gallery link after scrolling",
      );
      expect(
        paymentGalleryBoxAfterScroll.y + paymentGalleryBoxAfterScroll.height,
      ).toBeLessThanOrEqual(drawerBox.y + drawerBox.height);
      return;
    }

    expect(
      paymentGalleryBoxBeforeScroll.y + paymentGalleryBoxBeforeScroll.height,
    ).toBeLessThanOrEqual(drawerBox.y + drawerBox.height);
  });
});

test.describe("navigation menu desktop popover", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop-only navigation popover coverage");

  test("keeps popover header and navigation rows aligned on desktop widths", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await openFixturePage(page);

    await expect(page.locator(".utility-menu-button--mobile")).toBeHidden();
    const panel = await openDesktopPopover(page);
    const viewportWidth = page.viewportSize()?.width ?? 1024;
    const headerCopy = panel.locator(".utility-menu-header-copy");
    const headerActions = panel.locator(".utility-menu-header-actions");
    const homeLink = panel.getByRole("link", { name: /Home Links and profile/u });
    const homeCopy = homeLink.locator(".utility-menu-row-copy");
    const homeBadge = homeLink.locator(".utility-menu-badge");

    const panelBox = await requireBoundingBox(panel, "Desktop popover");
    const headerCopyBox = await requireBoundingBox(headerCopy, "Desktop header copy");
    const headerActionsBox = await requireBoundingBox(headerActions, "Desktop header actions");
    const homeCopyBox = await requireBoundingBox(homeCopy, "Desktop home copy");
    const homeBadgeBox = await requireBoundingBox(homeBadge, "Desktop home badge");

    expect(panelBox.x).toBeGreaterThanOrEqual(0);
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewportWidth);
    expect(headerCopyBox.width).toBeGreaterThan(140);
    expect(Math.abs(headerActionsBox.y - headerCopyBox.y)).toBeLessThan(8);
    expect(homeBadgeBox.x).toBeGreaterThan(homeCopyBox.x + homeCopyBox.width - 4);
  });
});
