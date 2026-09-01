import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(process.cwd(), "output", "playwright", "vs6-local");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.body.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "No horizontal overflow").toBe(false);
}

// ─── Home ─────────────────────────────────────────────────────────────────────

test("home: loads 200 with no console errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `home-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

test("home: shows nav links", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav.getByRole("link", { name: "레시피", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "식재료", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "대체 식재료", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "제조시설", exact: true })).toBeVisible();
});

test("home: mobile hamburger opens menu", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const hamburger = page.getByRole("button", { name: /메뉴/ });
  await expect(hamburger).toBeVisible();
  await hamburger.click();
  await expect(page.getByRole("navigation", { name: "모바일 주요 메뉴" })).toBeVisible();
  await noOverflow(page);
  await shot(page, `home-mobile-menu-${testInfo.project.name}`);
});

// ─── /recipes ─────────────────────────────────────────────────────────────────

test("recipes: list loads with results", async ({ page }, testInfo) => {
  const res = await page.goto("/recipes");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `recipes-list-${testInfo.project.name}`);
});

test("recipes: no error state on list", async ({ page }) => {
  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".state-panel--error")).toHaveCount(0);
});

test("recipes: detail page loads", async ({ page }, testInfo) => {
  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/recipes/']").first();
  if (!(await firstLink.isVisible().catch(() => false))) { test.skip(); return; }
  const href = await firstLink.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `recipes-detail-${testInfo.project.name}`);
});

test("recipes: detail not-found returns 404 page", async ({ page }) => {
  await page.goto("/recipes/NONEXISTENT_RECIPE_999999");
  await page.waitForLoadState("networkidle");
  // Next.js notFound() renders 404 page
  await expect(page.getByRole("heading")).toBeVisible();
});

// ─── legacy /ingredients redirect ─────────────────────────────────────────────

test("ingredients: legacy list route redirects to substitutes", async ({ page }, testInfo) => {
  const res = await page.goto("/ingredients");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/substitutes$/);
  await noOverflow(page);
  await shot(page, `ingredients-redirect-${testInfo.project.name}`);
});

test("ingredients: legacy detail route redirects to substitutes", async ({ page }, testInfo) => {
  const res = await page.goto("/ingredients/99999999");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/substitutes$/);
  await noOverflow(page);
  await shot(page, `ingredients-detail-redirect-${testInfo.project.name}`);
});

// ─── /substitutes ─────────────────────────────────────────────────────────────

test("substitutes: initial empty state shows prompt", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("식재료 이름을 검색하세요")).toBeVisible();
  await noOverflow(page);
  await shot(page, `substitutes-initial-${testInfo.project.name}`);
});

test("substitutes: exact match shows sim bars and nutrition table", async ({ page }, testInfo) => {
  await page.goto("/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--exact")).toBeVisible();
  await expect(page.locator(".sim-bars").first()).toBeVisible();
  await expect(page.locator(".nutrition-table").first()).toBeVisible();
  await noOverflow(page);
  await shot(page, `substitutes-exact-${testInfo.project.name}`);
});

test("substitutes: nonexistent shows empty-state not error", async ({ page }, testInfo) => {
  await page.goto("/substitutes?ingredient=XYZNONEXISTENT999");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("대체 식재료를 찾지 못했습니다")).toBeVisible();
  await expect(page.locator(".state-panel--error")).toHaveCount(0);
  await noOverflow(page);
  await shot(page, `substitutes-empty-${testInfo.project.name}`);
});

test("substitutes: unmatched hides sim bars", async ({ page }, testInfo) => {
  await page.goto("/substitutes?ingredient=A");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".match-badge--unmatched")).toBeVisible();
  await expect(page.locator(".sim-bars")).not.toBeVisible();
  await noOverflow(page);
  await shot(page, `substitutes-unmatched-${testInfo.project.name}`);
});

test("substitutes: long query (100 chars) loads safely", async ({ page }, testInfo) => {
  const long = encodeURIComponent("가".repeat(100));
  const res = await page.goto(`/substitutes?ingredient=${long}`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `substitutes-long-${testInfo.project.name}`);
});

test("substitutes: special chars in query loads safely", async ({ page }, testInfo) => {
  const special = encodeURIComponent("<script>alert(1)</script>");
  const res = await page.goto(`/substitutes?ingredient=${special}`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
});

// ─── /facilities ─────────────────────────────────────────────────────────────

test("facilities: list loads", async ({ page }, testInfo) => {
  const res = await page.goto("/facilities");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `facilities-list-${testInfo.project.name}`);
});

test("facilities: no error state on initial load", async ({ page }) => {
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".state-panel--error")).toHaveCount(0);
});

test("facilities: keyword filter returns valid JSON structure", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities?q=삼성&limit=5");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json).toHaveProperty("data");
  expect(Array.isArray(json.data)).toBe(true);
});

test("facilities: sido filter — API items match sido", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities?sido=경기도&limit=10");
  expect(res.status()).toBe(200);
  const json = await res.json();
  const items: Array<{ region_sido: string }> = json.data ?? [];
  if (items.length > 0) {
    for (const item of items) {
      expect(item.region_sido).toBe("경기도");
    }
  }
});

test("facilities: haccp filter — API items all have is_haccp=true", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities?haccp=1&limit=10");
  expect(res.status()).toBe(200);
  const json = await res.json();
  const items: Array<{ is_haccp: boolean }> = json.data ?? [];
  if (items.length > 0) {
    for (const item of items) {
      expect(item.is_haccp).toBe(true);
    }
  }
});

test("facilities: status filter — API items match status", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities?status=영업&limit=10");
  expect(res.status()).toBe(200);
  const json = await res.json();
  const items: Array<{ status: string }> = json.data ?? [];
  if (items.length > 0) {
    for (const item of items) {
      expect(item.status).toBe("영업");
    }
  }
});

test("facilities: pagination — page 2 returns different items", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const r1 = await page.request.get("/api/facilities?limit=5&page=1");
  const r2 = await page.request.get("/api/facilities?limit=5&page=2");
  expect(r1.status()).toBe(200);
  expect(r2.status()).toBe(200);
  const j1 = await r1.json();
  const j2 = await r2.json();
  const ids1: string[] = (j1.data ?? []).map((x: { mgt_no: string }) => x.mgt_no);
  const ids2: string[] = (j2.data ?? []).map((x: { mgt_no: string }) => x.mgt_no);
  if (ids1.length > 0 && ids2.length > 0) {
    const overlap = ids1.filter((id) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  }
});

test("facilities: write request rejected (POST 405)", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.post("/api/facilities", { data: {} });
  expect(res.status()).toBeGreaterThanOrEqual(405);
});

test("facilities: detail loads", async ({ page }, testInfo) => {
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/facilities/']").first();
  if (!(await firstLink.isVisible().catch(() => false))) { test.skip(); return; }
  const href = await firstLink.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `facilities-detail-${testInfo.project.name}`);
});

test("facilities: detail back link returns to list", async ({ page }, testInfo) => {
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/facilities/']").first();
  if (!(await firstLink.isVisible().catch(() => false))) { test.skip(); return; }
  const href = await firstLink.getAttribute("href");
  await page.goto(href!);
  await page.waitForLoadState("networkidle");
  const backHref = await page.locator(".facility-detail__back a").getAttribute("href");
  expect(backHref).toMatch(/^\/facilities/);
});

test("facilities: invalid ID returns error state, not crash", async ({ page }, testInfo) => {
  await page.goto("/facilities/INVALID_ID_THAT_DOES_NOT_EXIST_999");
  await page.waitForLoadState("networkidle");
  // Should show either 404 or error state — not a white blank page
  const hasHeading = await page.getByRole("heading").first().isVisible().catch(() => false);
  const hasStatePanel = await page.locator(".state-panel").isVisible().catch(() => false);
  expect(hasHeading || hasStatePanel).toBe(true);
  await noOverflow(page);
  await shot(page, `facilities-invalid-id-${testInfo.project.name}`);
});

test("facilities: filter context panel (FG-FUN-034) shows on detail from filtered list", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  // FacilityListCard already embeds ?back=... in the link href
  await page.goto("/facilities?sido=경기도&haccp=1");
  await page.waitForLoadState("networkidle");
  const firstLink = page.locator("a[href^='/facilities/']").first();
  if (!(await firstLink.isVisible().catch(() => false))) { test.skip(); return; }
  await firstLink.click();
  await page.waitForLoadState("networkidle");
  const panel = page.locator(".facility-detail__filter-context");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("경기도");
  await expect(panel).toContainText("스마트 HACCP");
  await expect(page.locator(".filter-condition__status").first()).toBeVisible();
  await noOverflow(page);
  await shot(page, `facilities-filter-context-${testInfo.project.name}`);
});

// ─── API security ─────────────────────────────────────────────────────────────

test("api: facilities list — no private columns exposed", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities?limit=3");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).not.toContain("service_role");
  expect(text).not.toContain("road_addr");
  expect(text).not.toContain("coord_x");
  expect(text).not.toContain("coord_y");
  expect(text).not.toContain("suspension_count");
});

test("api: facilities detail — allowlisted columns only", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const listRes = await page.request.get("/api/facilities?limit=1");
  const listJson = await listRes.json();
  const firstId: string | undefined = (listJson.data ?? [])[0]?.mgt_no;
  if (!firstId) { test.skip(); return; }
  const res = await page.request.get(`/api/facilities/${firstId}`);
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).not.toContain("service_role");
  expect(text).not.toContain("road_addr");
  expect(text).not.toContain("coord_x");
  expect(text).not.toContain("coord_y");
  expect(text).not.toContain("suspension_count");
});

test("api: facilities — Korean chars in ID returns 400", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities/한글아이디");
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json?.error?.code).toBe("FG_BAD_REQUEST");
});

test("api: facilities — nonexistent ID returns 404", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/facilities/NONEXISTENT_9999999999");
  expect(res.status()).toBe(404);
});

test("api: ingredients — no private columns", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/ingredients?limit=3");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).not.toContain("service_role");
  expect(text).not.toContain("rls_policy");
  expect(text).not.toContain("internal_note");
});

test("api: substitutes — returns json with data array", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  const res = await page.request.get("/api/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json).toHaveProperty("data");
});

// ─── Responsive & accessibility ───────────────────────────────────────────────

test("responsive: / no overflow desktop", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
});

test("responsive: / no overflow mobile", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
});

test("responsive: /facilities no overflow desktop", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
});

test("responsive: /facilities no overflow mobile", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
});

test("a11y: nav links keyboard navigable", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(["A", "BUTTON", "INPUT"].includes(focused ?? "")).toBe(true);
});

test("a11y: state panels have role or aria-live", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/substitutes?ingredient=XYZNONEXISTENT999");
  await page.waitForLoadState("networkidle");
  const panel = page.locator(".state-panel").first();
  const hasRole = await panel.isVisible().catch(() => false);
  if (hasRole) {
    const role = await panel.getAttribute("role");
    const ariaLive = await panel.getAttribute("aria-live");
    expect(role ?? ariaLive).toBeTruthy();
  }
});
