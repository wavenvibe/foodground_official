import { expect, test } from "@playwright/test";

test("home v3: live layout is usable without browser errors", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");

  await expect(page.locator(".home-v3-shell")).toBeVisible();
  await expect(page.locator('.home-v3-hero-photo img[src*="hero-expert"]')).toBeVisible();
  await expect(page.locator('.home-v3-visual-card img[src*="home-r1"]')).toHaveCount(2);
  await expect(page.getByRole("heading", { name: /식품 아이디어를 찾고/ })).toBeVisible();
  await expect(page.locator(".home-v3-stats dd")).toHaveCount(4);
  await expect(page.getByRole("search", { name: "제품 검색" })).toBeVisible();

  const expectedPaths = [
    "/products",
    "/recipes",
    "/substitutes",
    "/manufacturing-brief",
    "/facilities",
    "/saved",
  ];
  const linkedPaths = await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
  );
  for (const path of expectedPaths) expect(linkedPaths).toContain(path);

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);

  if (testInfo.project.name === "mobile") {
    const menuButton = page.getByRole("button", { name: "메뉴 열기" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("navigation", { name: "모바일 주요 메뉴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "제조시설", exact: true }).last()).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "홈 주요 메뉴 왼쪽" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "홈 주요 메뉴 오른쪽" })).toBeVisible();
  }

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(page.locator(".review-tray-fab")).toBeVisible();

  expect(consoleErrors.filter((message) => !message.includes("favicon"))).toHaveLength(0);
  expect(pageErrors).toHaveLength(0);
});
