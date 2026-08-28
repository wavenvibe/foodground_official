import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(process.cwd(), "output", "playwright", "vs4-live");

async function shot(page: Page, name: string) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.body.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "No horizontal overflow").toBe(false);
}

async function noConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

// ─── Home ────────────────────────────────────────────────────────────────────

test("home: loads without error", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `home-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

// ─── Header navigation ───────────────────────────────────────────────────────

test("header: desktop nav shows 4 approved links", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "레시피", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "식재료", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "대체 식재료", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "제조시설", exact: true })).toBeVisible();

  // Removed nav items must not be present within header nav
  await expect(nav.getByRole("link", { name: "제품 검색" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "관심업체/제품" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "알림" })).toHaveCount(0);
});

test("header: mobile hamburger accessible at 390px", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();
  await page.goto("/");

  const hamburger = page.getByRole("button", { name: /메뉴/ });
  await expect(hamburger).toBeVisible();

  // Desktop nav should be hidden on mobile
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeHidden();

  // Open mobile menu
  await hamburger.click();
  await expect(page.getByRole("navigation", { name: "모바일 주요 메뉴" })).toBeVisible();
  await expect(page.getByRole("link", { name: "레시피" }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "식재료" }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "대체 식재료" }).last()).toBeVisible();
  await expect(page.getByRole("link", { name: "제조시설" }).last()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, `header-mobile-open-${testInfo.project.name}`);
});

// ─── /substitutes ─────────────────────────────────────────────────────────────

test("substitutes: initial state (no query)", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("식재료 이름을 검색하세요")).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-initial-${testInfo.project.name}`);
});

test("substitutes: exact match 가시오갈피", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");

  // Should show results section with candidate list
  await expect(page.getByText("의 대체 식재료")).toBeVisible();
  // Exact match badge must be present and labeled
  await expect(page.locator(".match-badge--exact")).toBeVisible();
  await expect(page.locator(".match-badge--exact")).toContainText("정확 일치");
  await expect(page.locator(".substitute-results")).toBeVisible();
  // Score bars exist (at least one)
  await expect(page.locator(".sim-bars").first()).toBeVisible();
  // Nutrition table exists
  await expect(page.locator(".nutrition-table").first()).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-exact-${testInfo.project.name}`);
});

test("substitutes: synonym match 계란", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=%EA%B3%84%EB%9E%80");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--synonym")).toBeVisible();
  await expect(page.locator(".match-badge--synonym")).toContainText("동의어 일치");
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-synonym-${testInfo.project.name}`);
});

test("substitutes: substring match 들기름", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=a%20%EB%93%A4%EA%B8%B0%EB%A6%84");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--substring")).toBeVisible();
  await expect(page.locator(".match-badge--substring")).toContainText("부분 일치");
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-substring-${testInfo.project.name}`);
});

test("substitutes: fuzzy match A 다시육수", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=A%20%EB%8B%A4%EC%8B%9C%EC%9C%A1%EC%88%98");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--fuzzy")).toBeVisible();
  await expect(page.locator(".match-badge--fuzzy")).toContainText("유사 일치");
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-fuzzy-${testInfo.project.name}`);
});

test("substitutes: unmatched state renders correctly", async ({ page }, testInfo) => {
  // 'A' is confirmed in DB as match_type: "unmatched" — must show badge and notice text
  const res = await page.goto("/substitutes?ingredient=A");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--unmatched")).toBeVisible();
  await expect(page.locator(".match-badge--unmatched")).toContainText("미매칭");
  await expect(page.getByText("표준 식품 데이터와 연결되지 않은 식재료입니다")).toBeVisible();
  await expect(page.locator(".sim-bars")).not.toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-unmatched-${testInfo.project.name}`);
});

test("substitutes: nonexistent ingredient shows empty state", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=XYZNONEXISTENT999");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("대체 식재료를 찾지 못했습니다")).toBeVisible();
  await noHorizontalOverflow(page);
  await shot(page, `substitutes-nonexistent-${testInfo.project.name}`);
});

// ─── /recipes ────────────────────────────────────────────────────────────────

test("recipes: list page loads", async ({ page }, testInfo) => {
  const res = await page.goto("/recipes");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `recipes-list-${testInfo.project.name}`);
});

test("recipes: detail page loads", async ({ page }, testInfo) => {
  // Navigate to list first and pick first recipe link
  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/recipes/']").first();
  const hasLink = await firstLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  const href = await firstLink.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `recipes-detail-${testInfo.project.name}`);
});

// ─── /ingredients ─────────────────────────────────────────────────────────────

test("ingredients: list page loads", async ({ page }, testInfo) => {
  const res = await page.goto("/ingredients");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `ingredients-list-${testInfo.project.name}`);
});

test("ingredients: detail page loads", async ({ page }, testInfo) => {
  await page.goto("/ingredients");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/ingredients/']").first();
  const hasLink = await firstLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  const href = await firstLink.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `ingredients-detail-${testInfo.project.name}`);
});

// ─── /api/ingredients/[id] ────────────────────────────────────────────────────

test("api/ingredients/[id]: returns JSON without private columns", async ({ page }) => {
  // Get an ingredient id first
  const listRes = await page.request.get("/api/ingredients?limit=1");
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const items = listJson.data ?? listJson.items ?? listJson;
  const firstId = Array.isArray(items) ? items[0]?.id ?? items[0]?.ingredient_id : null;

  if (!firstId) {
    test.skip();
    return;
  }

  const res = await page.request.get(`/api/ingredients/${firstId}`);
  expect(res.status()).toBe(200);
  const json = await res.json();

  // Must not expose private/internal columns
  const text = JSON.stringify(json);
  expect(text).not.toContain("service_role");
  expect(text).not.toContain("rls_policy");
  expect(text).not.toContain("internal_note");
});

// ─── /facilities ─────────────────────────────────────────────────────────────

test("facilities: list page loads", async ({ page }, testInfo) => {
  const res = await page.goto("/facilities");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `facilities-list-${testInfo.project.name}`);
});

test("facilities: detail page loads", async ({ page }, testInfo) => {
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  const href = await firstLink.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `facilities-detail-${testInfo.project.name}`);
});
