import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(process.cwd(), "output", "playwright", "vs5-live");

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.body.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "No horizontal overflow").toBe(false);
}

// ─── Facility list ────────────────────────────────────────────────────────────

test("facilities: keyword search returns results", async ({ page }, testInfo) => {
  const keyword = "김치";
  const apiRes = await page.request.get(`/api/facilities?q=${encodeURIComponent(keyword)}&pageSize=10`);
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const items = apiJson.data as Array<{ name: string }> | undefined;
  if (!items || items.length === 0) {
    test.skip();
    return;
  }
  // All returned items must contain the keyword in their name
  for (const item of items) {
    expect(item.name.toLowerCase()).toContain(keyword.toLowerCase());
  }

  const res = await page.goto(`/facilities?q=${encodeURIComponent(keyword)}`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".facility-card").first()).toBeVisible();
  await shot(page, `facilities-keyword-${testInfo.project.name}`);
});

test("facilities: sido filter", async ({ page }, testInfo) => {
  const sido = "경기도";
  const apiRes = await page.request.get(`/api/facilities?sido=${encodeURIComponent(sido)}&pageSize=10`);
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const items = apiJson.data as Array<{ region_sido: string }> | undefined;
  if (!items || items.length === 0) {
    test.skip();
    return;
  }
  // All returned items must belong to the selected sido
  for (const item of items) {
    expect(item.region_sido).toBe(sido);
  }

  const res = await page.goto(`/facilities?sido=${encodeURIComponent(sido)}`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".facility-card").first()).toBeVisible();
  await shot(page, `facilities-sido-${testInfo.project.name}`);
});

test("facilities: businessType filter", async ({ page }, testInfo) => {
  const businessType = "식품제조가공업";
  const apiRes = await page.request.get(`/api/facilities?businessType=${encodeURIComponent(businessType)}&pageSize=10`);
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const items = apiJson.data as Array<{ business_type: string }> | undefined;
  if (!items || items.length === 0) {
    test.skip();
    return;
  }
  // All returned items must match the selected business type
  for (const item of items) {
    expect(item.business_type).toBe(businessType);
  }

  const res = await page.goto(`/facilities?businessType=${encodeURIComponent(businessType)}`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".facility-card").first()).toBeVisible();
  await shot(page, `facilities-businesstype-${testInfo.project.name}`);
});

test("facilities: haccp filter", async ({ page }, testInfo) => {
  const apiRes = await page.request.get("/api/facilities?haccp=1&pageSize=10");
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const items = apiJson.data as Array<{ is_haccp: boolean }> | undefined;
  if (!items || items.length === 0) {
    test.skip();
    return;
  }
  // All returned items must have HACCP certification
  for (const item of items) {
    expect(item.is_haccp).toBe(true);
  }

  const res = await page.goto("/facilities?haccp=1");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".facility-card").first()).toBeVisible();
  await shot(page, `facilities-haccp-${testInfo.project.name}`);
});

test("facilities: status filter all", async ({ page }, testInfo) => {
  const res = await page.goto("/facilities?status=all");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  // status=all should not error out
  const hasError = await page.locator(".state-panel--error").isVisible().catch(() => false);
  expect(hasError).toBe(false);
  await shot(page, `facilities-status-all-${testInfo.project.name}`);
});

test("facilities: multiple filters combined", async ({ page }, testInfo) => {
  const sido = "경기도";
  const apiRes = await page.request.get(`/api/facilities?sido=${encodeURIComponent(sido)}&haccp=1&pageSize=10`);
  expect(apiRes.status()).toBe(200);
  const apiJson = await apiRes.json();
  const items = apiJson.data as Array<{ region_sido: string; is_haccp: boolean }> | undefined;
  if (!items || items.length === 0) {
    test.skip();
    return;
  }
  // All returned items must satisfy both conditions simultaneously
  for (const item of items) {
    expect(item.region_sido).toBe(sido);
    expect(item.is_haccp).toBe(true);
  }

  const res = await page.goto(`/facilities?sido=${encodeURIComponent(sido)}&haccp=1`);
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".facility-card").first()).toBeVisible();
  await shot(page, `facilities-combined-${testInfo.project.name}`);
});

test("facilities: empty results state", async ({ page }, testInfo) => {
  const res = await page.goto("/facilities?q=XYZNOTEXIST");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("검색 결과가 없습니다")).toBeVisible();
  await shot(page, `facilities-empty-${testInfo.project.name}`);
});

// ─── Facility detail ──────────────────────────────────────────────────────────

test("facilities: detail page has back link", async ({ page }, testInfo) => {
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstDetailLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstDetailLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  await firstDetailLink.click();
  await page.waitForLoadState("networkidle");
  // Back link must be present
  await expect(page.getByText("검색 결과로 돌아가기")).toBeVisible();
  await shot(page, `facilities-detail-back-${testInfo.project.name}`);
});

test("facilities: back link preserves search state", async ({ page }, testInfo) => {
  // Navigate to a filtered list
  await page.goto("/facilities?sido=%EA%B2%BD%EA%B8%B0%EB%8F%84");
  await page.waitForLoadState("networkidle");
  const firstDetailLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstDetailLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  const href = await firstDetailLink.getAttribute("href");
  // Verify backUrl is embedded in the detail link
  expect(href).toContain("back=");
  await firstDetailLink.click();
  await page.waitForLoadState("networkidle");
  const backLink = page.locator(".facility-detail__back a");
  await expect(backLink).toBeVisible();
  // Verify the back link href contains the original sido filter (no navigation needed)
  const backHref = await backLink.getAttribute("href");
  expect(backHref).toMatch(/sido=/);
  await shot(page, `facilities-back-preserved-${testInfo.project.name}`);
});

test("facilities: detail shows only public columns", async ({ page }) => {
  // Retrieve first facility via API
  const listRes = await page.request.get("/api/facilities?pageSize=1");
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const firstItem = listJson.data?.[0];
  if (!firstItem) {
    test.skip();
    return;
  }
  const text = JSON.stringify(listJson);
  // Private columns must not appear
  expect(text).not.toContain("road_addr");
  expect(text).not.toContain("coord_x");
  expect(text).not.toContain("coord_y");
  expect(text).not.toContain("suspension_count");
});

// ─── FG-FUN-034 — filter context on detail page ───────────────────────────────

test("facilities: filter context shows on detail from filtered list", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  // Navigate via a filtered list so back URL carries filter params
  await page.goto("/facilities?sido=%EA%B2%BD%EA%B8%B0%EB%8F%84&haccp=1");
  await page.waitForLoadState("networkidle");
  const firstDetailLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstDetailLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  await firstDetailLink.click();
  await page.waitForLoadState("networkidle");
  // Filter context panel must be present
  await expect(page.locator(".facility-detail__filter-context")).toBeVisible();
  // Must show 경기도 and HACCP labels
  await expect(page.locator(".facility-detail__filter-context")).toContainText("경기도");
  await expect(page.locator(".facility-detail__filter-context")).toContainText("HACCP");
  await noHorizontalOverflow(page);
  await shot(page, `facilities-filter-context-${testInfo.project.name}`);
});

// ─── ContactButton ────────────────────────────────────────────────────────────

test("facilities: ContactButton copy success", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  // Grant clipboard permissions
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstDetailLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstDetailLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  await firstDetailLink.click();
  await page.waitForLoadState("networkidle");

  const copyBtn = page.getByRole("button", { name: "문의내용 복사" });
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  // Button text changes to "복사되었습니다" after successful copy
  await expect(page.getByRole("button", { name: "복사되었습니다" })).toBeVisible();
  await shot(page, `facilities-contactbtn-copy-${testInfo.project.name}`);
});

test("facilities: ContactButton fallback when clipboard denied", async ({ page, context }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  // Do NOT grant clipboard permission — should trigger fallback
  await context.clearPermissions();

  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  const firstDetailLink = page.locator("a[href^='/facilities/']").first();
  const hasLink = await firstDetailLink.isVisible().catch(() => false);
  if (!hasLink) {
    test.skip();
    return;
  }
  await firstDetailLink.click();
  await page.waitForLoadState("networkidle");

  // Override clipboard API after page is loaded to simulate denial
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: () => Promise.reject(new Error("Permission denied")),
        readText: () => Promise.reject(new Error("Permission denied")),
      },
      configurable: true,
      writable: true,
    });
  });

  const copyBtn = page.getByRole("button", { name: "문의내용 복사" });
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();
  // Fallback textarea should appear
  await expect(page.getByText("클립보드 접근이 거부되었습니다")).toBeVisible();
  await shot(page, `facilities-contactbtn-fallback-${testInfo.project.name}`);
});

// ─── Detail tel and homepage ──────────────────────────────────────────────────

test("facilities: detail tel link when present", async ({ page }) => {
  // Check API response contains tel and verify the page renders a tel link
  const listRes = await page.request.get("/api/facilities?pageSize=20");
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const withTel = (listJson.data as Array<{ mgt_no: string; tel: string | null }>)?.find((f) => f.tel);
  if (!withTel) {
    test.skip();
    return;
  }
  await page.goto(`/facilities/${encodeURIComponent(withTel.mgt_no)}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(`a[href^="tel:"]`)).toBeVisible();
});

test("facilities: detail homepage safe link", async ({ page }) => {
  const listRes = await page.request.get("/api/facilities?pageSize=50");
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const withHomepage = (
    listJson.data as Array<{ mgt_no: string; homepage: string | null }>
  )?.find((f) => f.homepage && /^https?:\/\//i.test(f.homepage));
  if (!withHomepage) {
    test.skip();
    return;
  }
  await page.goto(`/facilities/${encodeURIComponent(withHomepage.mgt_no)}`);
  await page.waitForLoadState("networkidle");
  // Should render an external link (http/https)
  await expect(page.locator('a[href^="http"]').first()).toBeVisible();
});

// ─── Substitutes → facilities link ───────────────────────────────────────────

test("facilities: from substitutes to facilities link", async ({ page }, testInfo) => {
  const res = await page.goto("/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  // The facility link should be present in the results section
  await expect(page.getByRole("link", { name: "제조시설 찾기" })).toBeVisible();
  await shot(page, `facilities-from-substitutes-${testInfo.project.name}`);
});

// ─── Responsive ──────────────────────────────────────────────────────────────

test("facilities: no horizontal overflow desktop", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `facilities-overflow-desktop`);
});

test("facilities: no horizontal overflow mobile", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  await noHorizontalOverflow(page);
  await shot(page, `facilities-overflow-mobile`);
});

// ─── Console errors ───────────────────────────────────────────────────────────

test("facilities: no console errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");
  // Favicon errors are expected and should not fail the test
  const realErrors = errors.filter((e) => !e.includes("favicon"));
  expect(realErrors).toHaveLength(0);
  await shot(page, `facilities-no-errors-${testInfo.project.name}`);
});

// ─── Security: /api/facilities/[id] ──────────────────────────────────────────

test("api/facilities/[id]: allowlisted public columns only", async ({ page }) => {
  const listRes = await page.request.get("/api/facilities?pageSize=1");
  expect(listRes.status()).toBe(200);
  const listJson = await listRes.json();
  const firstItem = listJson.data?.[0] as { mgt_no: string } | undefined;
  if (!firstItem) {
    test.skip();
    return;
  }
  const detailRes = await page.request.get(`/api/facilities/${encodeURIComponent(firstItem.mgt_no)}`);
  expect(detailRes.status()).toBe(200);
  const text = JSON.stringify(await detailRes.json());
  // Private columns must not be exposed
  expect(text).not.toContain("road_addr");
  expect(text).not.toContain("coord_x");
  expect(text).not.toContain("coord_y");
  expect(text).not.toContain("suspension_count");
});

test("api/facilities/[id]: invalid mgt_no (Korean chars) returns 400", async ({ page }) => {
  const res = await page.request.get("/api/facilities/%EA%B0%80%EB%82%98%EB%8B%A4");
  expect(res.status()).toBe(400);
  const json = await res.json();
  expect(json?.error?.code).toBe("FG_BAD_REQUEST");
});

test("api/facilities/[id]: non-existent mgt_no returns 404", async ({ page }) => {
  const res = await page.request.get("/api/facilities/NONEXISTENT-FACILITY-XYZ-999");
  expect(res.status()).toBe(404);
});
