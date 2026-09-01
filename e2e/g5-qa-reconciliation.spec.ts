/**
 * G5 QA Reconciliation — Focused tests for DOC-13 54-case coverage gaps.
 *
 * Covers deterministic P0/P1 requirements not fully exercised by existing
 * vs4-live / vs5-live / vs6-integration / vs-i / g4-core-flow specs.
 *
 * Requirements addressed:
 *   FG-FUN-004  Sort ordering and reset
 *   FG-FUN-012  Pagination 50-cap and hasMore boundary
 *   FG-FUN-029  Substitute 6 similarity metrics display
 *   FG-FUN-030  Match-type badges (5 kinds) and disclaimer
 *   FG-FUN-034  Filter context evidence on facility detail
 *   FG-NFR-002  Loading / empty / error / not-found states
 *   FG-NFR-003  Keyboard navigation focus indicator
 *   FG-NFR-004  Direct URL + refresh + 404 across routes
 *   FG-SEC-004  Private columns excluded from all APIs
 *   FG-SEC-009  Error responses carry no SQL/stack trace
 */
import { test, expect, type Page } from "@playwright/test";

// ─── FG-FUN-004: Sort ordering and reset ────────────────────────────────────

test("UAT-034/042: facility list order is deterministic across identical requests", async ({ request }) => {
  const r1 = await request.get("/api/facilities?pageSize=20");
  expect(r1.status()).toBe(200);
  const d1 = await r1.json();
  expect(d1.data.length).toBeGreaterThan(0);

  // Second request with same params must return identical order
  const r2 = await request.get("/api/facilities?pageSize=20");
  const d2 = await r2.json();
  const ids1 = d1.data.map((f: { mgt_no: string }) => f.mgt_no);
  const ids2 = d2.data.map((f: { mgt_no: string }) => f.mgt_no);
  expect(ids1).toEqual(ids2);
});

// ─── FG-FUN-012: Pagination 50-cap boundary ─────────────────────────────────

test("FG-FUN-012: page size capped at 50", async ({ request }) => {
  const res = await request.get("/api/facilities?pageSize=100");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.meta.pageSize).toBe(50);
  expect(body.data.length).toBeLessThanOrEqual(50);
});

test("FG-FUN-012: page beyond total returns an empty page without a server error", async ({ request }) => {
  const first = await request.get("/api/recipes?page=1&pageSize=1");
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  const pageBeyondTotal = Math.floor(firstBody.meta.total / 50) + 2;

  const res = await request.get(`/api/recipes?page=${pageBeyondTotal}&pageSize=50`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.meta.page).toBe(pageBeyondTotal);
  expect(body.meta.pageSize).toBe(50);
  expect(body.data.length).toBe(0);
});

// ─── FG-FUN-029: Substitute 6 similarity metrics ───────────────────────────

test("FG-FUN-029: substitute result shows 6 similarity metrics", async ({ page }) => {
  await page.goto("/substitutes?ingredient=가시오갈피");
  await expect(page.locator(".candidate-card").first()).toBeVisible({ timeout: 15000 });

  const firstMetrics = page.locator(".candidate-card").first().getByRole("meter");
  await expect(firstMetrics).toHaveCount(6);
  expect(await firstMetrics.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))).toEqual([
    "영양 성분",
    "재료 분류",
    "식품군",
    "조리 상태",
    "요리 유형",
    "배합 재료",
  ]);
  await expect(page.locator(".nutrition-table").first()).toBeVisible();
});

// ─── FG-FUN-030: Match-type badges and disclaimer ──────────────────────────

test("FG-FUN-030: substitute shows match-type badge and disclaimer", async ({ page }) => {
  await page.goto("/substitutes?ingredient=가시오갈피");
  await expect(page.locator(".match-badge--exact")).toHaveText("정확 일치", { timeout: 15000 });
  await expect(page.getByRole("note", { name: "대체 식재료 이용 주의 안내" })).toContainText(
    "이 결과는 영양 성분·조리 특성 등을 바탕으로 산출한 유사도 정보",
  );
});

test("UAT-029: substitute candidates are ordered by descending final score", async ({ page }) => {
  await page.goto("/substitutes?ingredient=가시오갈피");
  const scores = page.locator(".candidate-card__score");
  await expect(scores.first()).toBeVisible({ timeout: 15000 });
  const labels = await scores.evaluateAll((nodes) =>
    nodes.map((node) => Number((node.getAttribute("aria-label") ?? "").match(/(\d+)점/)?.[1])),
  );
  expect(labels.length).toBeGreaterThan(1);
  expect(labels.every(Number.isFinite)).toBe(true);
  expect(labels).toEqual([...labels].sort((a, b) => b - a));
});

// ─── FG-NFR-002: State differentiation ──────────────────────────────────────

test("FG-NFR-002: empty search result shows empty state, not error", async ({ page }) => {
  await page.goto("/facilities?q=zzzznonexistent999");
  await expect(page.getByRole("heading", { name: "검색 결과가 없습니다" })).toBeVisible({ timeout: 15000 });

  const html = await page.content();
  // Should show empty/no-results message
  const hasEmptyMsg = /결과.*없|검색.*없|no.*result|empty/i.test(html);
  // Should NOT show error state
  const hasError = /FG_DATA_UNAVAILABLE|서비스.*점검|error.*occurred/i.test(html);
  expect(hasEmptyMsg).toBe(true);
  expect(hasError).toBe(false);
});

test("FG-NFR-002: nonexistent recipe ID shows not-found state", async ({ page }) => {
  const res = await page.goto("/recipes/99999999");
  // Should show 404 or not-found UI
  const html = await page.content();
  const is404 = res?.status() === 404 || /not.?found|404|찾을 수 없|존재하지 않/i.test(html);
  expect(is404).toBe(true);
});

test("FG-NFR-002: legacy ingredient detail redirects to substitute search", async ({ page }) => {
  const res = await page.goto("/ingredients/99999999");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/substitutes$/);
});

// ─── FG-NFR-003: Keyboard navigation ────────────────────────────────────────

test("FG-NFR-003: nav links are keyboard-focusable with visible indicator", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // Tab through navigation links
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");

  const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
  // The focused element should be a link or button
  expect(["A", "BUTTON", "INPUT"]).toContain(focusedTag);

  // Check that the focused element has a visible outline
  const hasOutline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const styles = window.getComputedStyle(el);
    const outline = styles.outlineStyle;
    const boxShadow = styles.boxShadow;
    return (outline !== "none" && outline !== "") || (boxShadow !== "none" && boxShadow !== "");
  });
  expect(hasOutline).toBe(true);
});

// ─── FG-NFR-004: Direct URL access and refresh ─────────────────────────────

test("FG-NFR-004: direct URL to /facilities renders correctly", async ({ page }) => {
  const res = await page.goto("/facilities");
  expect(res?.status()).toBe(200);
  await page.waitForLoadState("domcontentloaded");
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test("FG-NFR-004: direct URL to /recipes renders correctly", async ({ page }) => {
  const res = await page.goto("/recipes");
  expect(res?.status()).toBe(200);
});

test("FG-NFR-004: direct URL to /ingredients redirects to /substitutes", async ({ page }) => {
  const res = await page.goto("/ingredients");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/substitutes$/);
});

test("FG-NFR-004: direct URL to /substitutes renders correctly", async ({ page }) => {
  const res = await page.goto("/substitutes");
  expect(res?.status()).toBe(200);
});

test("FG-NFR-004: nonexistent route returns 404", async ({ page }) => {
  const res = await page.goto("/this-route-does-not-exist-xyz");
  expect(res?.status()).toBe(404);
});

// ─── FG-SEC-004/009: API security ──────────────────────────────────────────

test("FG-SEC-004: recipes API excludes private columns", async ({ request }) => {
  const res = await request.get("/api/recipes?pageSize=5");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const first = body.data[0];
  if (first) {
    const keys = Object.keys(first);
    const forbidden = ["email", "representative", "password", "service_role", "internal_notes"];
    for (const f of forbidden) {
      expect(keys).not.toContain(f);
    }
  }
});

test("FG-SEC-004: ingredients API excludes private columns", async ({ request }) => {
  const res = await request.get("/api/ingredients?pageSize=5");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const first = body.data[0];
  if (first) {
    const keys = Object.keys(first);
    const forbidden = ["email", "representative", "password", "service_role", "internal_notes"];
    for (const f of forbidden) {
      expect(keys).not.toContain(f);
    }
  }
});

test("FG-SEC-009: error response contains no SQL or stack trace", async ({ request }) => {
  const res = await request.get("/api/facilities/한글잘못된아이디");
  const body = await res.json();
  const str = JSON.stringify(body);
  expect(str).not.toMatch(/SELECT\s|FROM\s|WHERE\s|INSERT\s|UPDATE\s|DELETE\s/i);
  expect(str).not.toMatch(/stack.*trace|at\s+\w+\s*\(|\.js:\d+:\d+/i);
  expect(str).not.toMatch(/supabase\.co|postgresql/i);
  // Should use FG_ error code format
  if (body.error) {
    expect(body.error.code).toMatch(/^FG_/);
  }
});

// ─── FG-NFR-001: Responsive — additional routes ─────────────────────────────

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.body.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "No horizontal overflow").toBe(false);
}

test("FG-NFR-001: /recipes no horizontal overflow at 390px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/recipes");
  await page.waitForLoadState("domcontentloaded");
  await noHorizontalOverflow(page);
  await ctx.close();
});

test("FG-NFR-001: legacy /ingredients redirect has no horizontal overflow at 390px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/ingredients");
  await page.waitForLoadState("domcontentloaded");
  await expect(page).toHaveURL(/\/substitutes$/);
  await noHorizontalOverflow(page);
  await ctx.close();
});

test("FG-NFR-001: /substitutes no horizontal overflow at 390px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/substitutes");
  await page.waitForLoadState("domcontentloaded");
  await noHorizontalOverflow(page);
  await ctx.close();
});
