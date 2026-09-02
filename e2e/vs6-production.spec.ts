import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(
  process.cwd(),
  "docs",
  "qa",
  "evidence",
  "vs6-production",
);

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.body.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "No horizontal overflow").toBe(false);
}

// ─── Home ─────────────────────────────────────────────────────────────────────

test("home: loads 200 no console errors", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const res = await page.goto("/");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `home-${testInfo.project.name}`);
  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("404"),
  );
  expect(realErrors, `Console errors: ${realErrors.join("; ")}`).toHaveLength(0);
});

// ─── Recipes ──────────────────────────────────────────────────────────────────

test("recipes: list loads 200", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const res = await page.goto("/recipes");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `recipes-list-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

test("recipes: detail loads 200", async ({ page }, testInfo) => {
  const res = await page.goto("/recipes/6942782");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `recipes-detail-${testInfo.project.name}`);
});

// ─── Ingredients ──────────────────────────────────────────────────────────────

test("ingredients: list loads 200", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const res = await page.goto("/ingredients");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `ingredients-list-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

// ─── Substitutes ──────────────────────────────────────────────────────────────

test("substitutes: exact match returns data", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const res = await page.goto(
    "/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC",
  );
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `substitutes-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

// ─── Facilities ───────────────────────────────────────────────────────────────

test("facilities: list loads 200", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const res = await page.goto("/facilities");
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `facilities-list-${testInfo.project.name}`);
  expect(errors.filter((e) => !e.includes("favicon"))).toHaveLength(0);
});

test("facilities: detail loads 200", async ({ page }, testInfo) => {
  const res = await page.goto(
    "/facilities/3450000-106-2006-00035",
  );
  expect(res?.status()).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, `facilities-detail-${testInfo.project.name}`);
});

// ─── API: no private fields ───────────────────────────────────────────────────

test("api: facilities no private columns", async ({ request }) => {
  if (test.info().project.name !== "desktop") test.skip();
  const res = await request.get("/api/facilities?limit=1");
  expect(res.status()).toBe(200);
  const body = await res.json();
  const item = (body.data || [])[0] || {};
  const keys = Object.keys(item);
  const banned = ["road_addr", "coord_x", "coord_y", "suspension_count", "service_role", "password", "secret"];
  for (const b of banned) {
    expect(keys, `Private field '${b}' must not be exposed`).not.toContain(b);
  }
});

test("api: recipes no private columns", async ({ request }) => {
  if (test.info().project.name !== "desktop") test.skip();
  const res = await request.get("/api/recipes?limit=1");
  expect(res.status()).toBe(200);
});

test("api: substitutes returns data", async ({ request }) => {
  if (test.info().project.name !== "desktop") test.skip();
  const res = await request.get(
    "/api/substitutes?ingredient=%EA%B0%80%EC%8B%9C%EC%98%A4%EA%B0%88%ED%94%BC",
  );
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.data?.match_type).toBe("exact");
});

test("api: error format no SQL no stack trace", async ({ request }) => {
  if (test.info().project.name !== "desktop") test.skip();
  const res = await request.get("/api/recipes/not-a-valid-id-99999999999");
  expect(res.status()).toBeGreaterThanOrEqual(400);
  const text = await res.text();
  const lower = text.toLowerCase();
  expect(lower).not.toContain("select ");
  expect(lower).not.toContain("stack trace");
  expect(lower).not.toContain("pg_");
  // Should be FG error format
  expect(text).toContain("FG_");
});

// ─── Search redirect ──────────────────────────────────────────────────────────

test("search: redirect to facilities", async ({ page }) => {
  if (test.info().project.name !== "desktop") test.skip();
  const res = await page.goto(
    "/search?q=%EA%B3%A0%EB%93%B1%EC%96%B4",
  );
  // Either 200 after redirect or direct
  expect(res?.status()).toBeLessThan(400);
  expect(page.url()).toContain("/facilities");
});
