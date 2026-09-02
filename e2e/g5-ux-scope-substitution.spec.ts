import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    "document must not overflow horizontally",
  ).toBe(false);
}

test("G5-UX-001: home exposes approved 2-step product-development and 3-step factory flows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "제품 개발하기" })).toBeVisible();
  await expect(page.getByRole("link", { name: /레시피 찾기/ })).toHaveAttribute("href", "/recipes");
  await expect(page.getByRole("link", { name: /대체 식재료 찾기/ })).toHaveAttribute("href", "/substitutes");

  await expect(page.getByRole("heading", { name: "적정 제조공장 찾기" })).toBeVisible();
  await expect(page.getByRole("link", { name: /기존 제품명 조회하기/ })).toHaveAttribute("href", "/products");
  await expect(page.getByRole("link", { name: /조건 맞춤 제조공장 찾기/ })).toHaveAttribute("href", "/manufacturing-brief");
  await expect(page.getByRole("link", { name: /제조 후보 비교/ })).toHaveAttribute("href", "/facilities/compare");

  await expect(page.locator("header a[href='/ingredients']")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("G5-UX-002: company-name product search returns Wave & Vibe linked products", async ({ request, page }) => {
  const response = await request.get(`/api/products?q=${encodeURIComponent("웨이브앤바이브")}&pageSize=50`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.meta.total).toBe(31);
  expect(body.data).toHaveLength(31);
  expect(body.data.every((item: { facility_name?: string }) => item.facility_name?.includes("웨이브앤바이브"))).toBe(true);

  await page.goto(`/products?q=${encodeURIComponent("웨이브앤바이브")}`);
  await expect(page.getByText("총 31건 · 품목보고번호순")).toBeVisible();
  await expect(page.getByRole("link", { name: "웨이브앤바이브", exact: true }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("G5-UX-003: long product category chip stays compact and separate from facts", async ({ page }) => {
  await page.goto("/products");
  const chip = page.locator(".product-evidence-card .chip", { hasText: "땅콩 또는 견과류가공품" }).first();
  await expect(chip).toBeVisible();

  const geometry = await chip.evaluate((node) => {
    const card = node.closest(".product-evidence-card");
    const facts = card?.querySelector(".product-evidence-card__facts");
    const chipBox = node.getBoundingClientRect();
    const factsBox = facts?.getBoundingClientRect();
    return {
      height: chipBox.height,
      gap: factsBox ? factsBox.top - chipBox.bottom : -1,
      overlap: factsBox ? chipBox.bottom > factsBox.top : true,
    };
  });

  expect(geometry.height).toBeLessThanOrEqual(32);
  expect(geometry.gap).toBeGreaterThanOrEqual(8);
  expect(geometry.overlap).toBe(false);
  await expectNoHorizontalOverflow(page);
});

test("G5-UX-004: legacy ingredient routes redirect to substitute search", async ({ page }) => {
  await page.goto("/ingredients");
  await expect(page).toHaveURL(/\/substitutes$/);
  await page.goto("/ingredients/99999999");
  await expect(page).toHaveURL(/\/substitutes$/);
  await expectNoHorizontalOverflow(page);
});

test("G5-UX-005: saved recipe, substitute and two facilities flow into comparison", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "stateful end-to-end flow runs once on desktop");
  test.setTimeout(60000);

  await page.goto("/recipes/6942782");
  await page.getByRole("button", { name: /레시피 검토함에 저장/ }).click();
  await expect(page.getByRole("button", { name: /레시피 저장됨/ })).toBeVisible();

  await page.goto(`/substitutes?ingredient=${encodeURIComponent("가시오갈피")}`);
  const substituteSave = page.getByRole("button", { name: /대체 후보 저장/ }).first();
  await expect(substituteSave).toBeVisible({ timeout: 15000 });
  await substituteSave.click();
  await expect(page.getByRole("button", { name: /대체 후보 저장됨/ }).first()).toBeVisible();

  await page.goto(`/facilities?q=${encodeURIComponent("웨이브앤바이브")}&status=all`);
  const facilitySaves = page.getByRole("button", { name: "검토함에 저장", exact: true });
  await expect(facilitySaves).toHaveCount(2);
  await facilitySaves.first().click();
  await page.getByRole("button", { name: "검토함에 저장", exact: true }).first().click();

  await page.goto("/saved");
  await expect(page.getByText("4개 저장")).toBeVisible();
  await expect(page.getByRole("heading", { name: "레시피" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "대체 식재료" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "제조 후보" })).toBeVisible();

  await page.getByRole("link", { name: "저장 후보 비교" }).click();
  await expect(page.getByRole("heading", { name: "저장한 제조 후보 비교" })).toBeVisible();
  await expect(page.locator(".facility-compare-table thead th")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "업체 근거 보기" })).toHaveCount(2);
  await expectNoHorizontalOverflow(page);
});

test("G5-UX-006: mobile menu and review tray remain accessible without page overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-specific assertion");

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("link", { name: "검토함", exact: true }).last()).toBeVisible();
  await expect(page.locator(".review-tray-fab")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/facilities/compare");
  await expectNoHorizontalOverflow(page);
  expect(errors).toHaveLength(0);
});
