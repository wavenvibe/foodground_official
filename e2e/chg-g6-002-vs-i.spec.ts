import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.VSD_BASE_URL ?? "http://127.0.0.1:3013";
const EVIDENCE_DIR = path.join(process.cwd(), "output", "playwright", "chg-g6-002-vs-i");

type ProductItem = {
  report_no: string;
  facility_mgt_no: string | null;
  facility_is_haccp: boolean;
};

let realReportNo = "";
let realFacilityMgtNo = "";

test.beforeAll(async ({ request }) => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  // Fetch a real product with a facility for use in subsequent tests.
  const res = await request.get(`${BASE}/api/products?pageSize=20`);
  if (res.status() !== 200) return;
  const items = (await res.json()).data as ProductItem[];
  const withFacility = items.find((i) => i.facility_mgt_no);
  if (withFacility) {
    realReportNo = withFacility.report_no;
    realFacilityMgtNo = withFacility.facility_mgt_no!;
  }
});

// ---------------------------------------------------------------------------
// VS-I-001: manufacturing candidates returns 200 with non-empty candidates
// ---------------------------------------------------------------------------
test("VS-I-001 GET /api/manufacturing/candidates returns 200 with non-empty candidates", async ({ request }) => {
  const res = await request.get(`${BASE}/api/manufacturing/candidates?item=과자&limit=5`);
  expect(res.status(), `Expected 200, got ${res.status()}`).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("data");
  expect(body.data).toHaveProperty("candidates");
  expect(Array.isArray(body.data.candidates)).toBe(true);
  expect(body.data.candidates.length, "Expected non-empty candidates for item=과자").toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// VS-I-002: product list returns 200 with items array
// ---------------------------------------------------------------------------
test("VS-I-002 GET /api/products returns 200 with non-empty items", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products?page=1`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data), "body.data must be an array").toBe(true);
  expect(body.data.length, "Product list must not be empty").toBeGreaterThan(0);
  expect(body).toHaveProperty("traceId");
});

// ---------------------------------------------------------------------------
// VS-I-003: product detail returns exact 200 for dynamically obtained real ID
// ---------------------------------------------------------------------------
test("VS-I-003 GET /api/products/[reportNo] returns 200 for real product", async ({ request }) => {
  expect(realReportNo, "beforeAll must obtain a real report_no").not.toBe("");
  const res = await request.get(`${BASE}/api/products/${realReportNo}`);
  expect(res.status(), `Expected 200 for report_no=${realReportNo}, got ${res.status()}`).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("data");
  expect(body.data.report_no).toBe(realReportNo);
});

// ---------------------------------------------------------------------------
// VS-I-004: facility products returns exact 200 for dynamically obtained facility
// ---------------------------------------------------------------------------
test("VS-I-004 GET /api/facilities/[id]/products returns 200 for real facility", async ({ request }) => {
  expect(realFacilityMgtNo, "beforeAll must obtain a real facility_mgt_no").not.toBe("");
  const res = await request.get(`${BASE}/api/facilities/${realFacilityMgtNo}/products?page=1`);
  expect(res.status(), `Expected 200 for facility=${realFacilityMgtNo}, got ${res.status()}`).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data)).toBe(true);
});

// ---------------------------------------------------------------------------
// VS-I-004A: facility-scoped totals must be exact and internally consistent.
// Prevents a planned-count estimate from showing linked products when none exist.
// ---------------------------------------------------------------------------
test("VS-I-004A facility product totals are exact and consistent", async ({ request }) => {
  expect(realFacilityMgtNo, "beforeAll must obtain a real facility_mgt_no").not.toBe("");

  const [searchRes, evidenceRes] = await Promise.all([
    request.get(`${BASE}/api/products?facility=${encodeURIComponent(realFacilityMgtNo)}&pageSize=20`),
    request.get(`${BASE}/api/facilities/${encodeURIComponent(realFacilityMgtNo)}/products?page=1`),
  ]);

  expect(searchRes.status()).toBe(200);
  expect(evidenceRes.status()).toBe(200);

  const searchBody = await searchRes.json();
  const evidenceBody = await evidenceRes.json();
  expect(searchBody.meta.totalIsEstimate).toBe(false);
  expect(evidenceBody.meta.total).toBe(searchBody.meta.total);
  expect(evidenceBody.data.length).toBe(Math.min(evidenceBody.meta.total, 12));
});

// ---------------------------------------------------------------------------
// VS-I-005: Smart HACCP filter — all returned items must have facility_is_haccp=true
// ---------------------------------------------------------------------------
test("VS-I-005 GET /api/products?haccp=1 returns only Smart-HACCP-linked products", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products?haccp=1&pageSize=10`);
  expect(res.status()).toBe(200);
  const items = (await res.json()).data as ProductItem[];
  expect(items.length, "Expected at least one Smart-HACCP-linked product").toBeGreaterThan(0);
  for (const item of items) {
    expect(item.facility_is_haccp, `product ${item.report_no} must have facility_is_haccp=true`).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// VS-I-006: bad product ID format → 400 FG_BAD_REQUEST
// ---------------------------------------------------------------------------
test("VS-I-006 bad product ID returns 400", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products/!!!bad!!!`);
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe("FG_BAD_REQUEST");
});

// ---------------------------------------------------------------------------
// VS-I-007: nonexistent product ID → 404
// ---------------------------------------------------------------------------
test("VS-I-007 nonexistent product ID returns 404", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products/NONEXISTENT000000`);
  expect(res.status()).toBe(404);
});

// ---------------------------------------------------------------------------
// VS-I-008: bad facility ID format → 400 FG_BAD_REQUEST
// ---------------------------------------------------------------------------
test("VS-I-008 bad facility ID returns 400", async ({ request }) => {
  const res = await request.get(`${BASE}/api/facilities/!!!bad!!!/products`);
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe("FG_BAD_REQUEST");
});

// ---------------------------------------------------------------------------
// VS-I-009: private columns absent from product detail response
// ---------------------------------------------------------------------------
test("VS-I-009 product detail contains no private columns", async ({ request }) => {
  if (!realReportNo) { test.skip(); return; }
  const res = await request.get(`${BASE}/api/products/${realReportNo}`);
  if (res.status() !== 200) { test.skip(); return; }
  const data = (await res.json()).data ?? {};
  const privateKeys = [
    "supabase_project", "internal_note", "raw_json", "source_file",
    "row_hash", "company_id_raw", "source_updated_at",
  ];
  for (const key of privateKeys) {
    expect(data, `Private column '${key}' must not appear in response`).not.toHaveProperty(key);
  }
});

// ---------------------------------------------------------------------------
// VS-I-010: pagination — page 1 and page 2 return distinct report_no values
// ---------------------------------------------------------------------------
test("VS-I-010 pagination returns distinct items per page", async ({ request }) => {
  const [r1, r2] = await Promise.all([
    request.get(`${BASE}/api/products?page=1&pageSize=5`),
    request.get(`${BASE}/api/products?page=2&pageSize=5`),
  ]);
  expect(r1.status()).toBe(200);
  expect(r2.status()).toBe(200);
  const items1 = (await r1.json()).data as Array<{ report_no: string }>;
  const items2 = (await r2.json()).data as Array<{ report_no: string }>;
  if (items1.length === 0 || items2.length === 0) { test.skip(); return; }
  const ids1 = new Set(items1.map((i) => i.report_no));
  for (const item of items2) {
    expect(ids1.has(item.report_no), `report_no ${item.report_no} appears on both page 1 and page 2`).toBe(false);
  }
});

// ---------------------------------------------------------------------------
// VS-I-011: no FG_DATA_UNAVAILABLE from valid requests with complete Supabase config
// ---------------------------------------------------------------------------
test("VS-I-011 no FG_DATA_UNAVAILABLE from product list with complete Supabase config", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products?page=1`);
  expect(res.status(), "Product list must return 200 — not 503 — with complete Supabase config").toBe(200);
  const body = await res.json();
  expect(body).not.toHaveProperty("error");
});

// ---------------------------------------------------------------------------
// VS-I-012: desktop 1440x1000 — /products page
// ---------------------------------------------------------------------------
test("VS-I-012 /products desktop 1440x1000 — no errors, no overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-012-products-desktop-1440.png") });

  expect(overflow, "Horizontal overflow on /products @ 1440px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on /products desktop: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-013: mobile 390x844 — /products page
// ---------------------------------------------------------------------------
test("VS-I-013 /products mobile 390x844 — no errors, no overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-013-products-mobile-390.png") });

  expect(overflow, "Horizontal overflow on /products @ 390px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on /products mobile: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-014: desktop 1440x1000 — real product detail page
// ---------------------------------------------------------------------------
test("VS-I-014 product detail desktop 1440x1000 — no errors, no overflow", async ({ page }) => {
  if (!realReportNo) { test.skip(); return; }
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/products/${realReportNo}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-014-product-detail-desktop-1440.png") });

  expect(overflow, "Horizontal overflow on product detail @ 1440px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on product detail desktop: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-015: mobile 390x844 — real product detail page
// ---------------------------------------------------------------------------
test("VS-I-015 product detail mobile 390x844 — no errors, no overflow", async ({ page }) => {
  if (!realReportNo) { test.skip(); return; }
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/products/${realReportNo}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-015-product-detail-mobile-390.png") });

  expect(overflow, "Horizontal overflow on product detail @ 390px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on product detail mobile: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-016: desktop 1440x1000 — facility evidence page
// ---------------------------------------------------------------------------
test("VS-I-016 facility evidence desktop 1440x1000 — no errors, no overflow", async ({ page }) => {
  if (!realFacilityMgtNo) { test.skip(); return; }
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/facilities/${realFacilityMgtNo}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-016-facility-desktop-1440.png") });

  expect(overflow, "Horizontal overflow on facility evidence @ 1440px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on facility evidence desktop: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-017: mobile 390x844 — facility evidence page
// ---------------------------------------------------------------------------
test("VS-I-017 facility evidence mobile 390x844 — no errors, no overflow", async ({ page }) => {
  if (!realFacilityMgtNo) { test.skip(); return; }
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/facilities/${realFacilityMgtNo}`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-017-facility-mobile-390.png") });

  expect(overflow, "Horizontal overflow on facility evidence @ 390px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on facility evidence mobile: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-018: desktop 1440x1000 — /manufacturing-brief page
// ---------------------------------------------------------------------------
test("VS-I-018 /manufacturing-brief desktop 1440x1000 — no errors, no overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/manufacturing-brief`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-018-manufacturing-brief-desktop-1440.png") });

  expect(overflow, "Horizontal overflow on /manufacturing-brief @ 1440px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on /manufacturing-brief desktop: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-020: q=김치 free-text search returns 200, non-empty, product-name relevant
// ---------------------------------------------------------------------------
test("VS-I-020 GET /api/products?q=김치 returns 200 with non-empty 김치-relevant results", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products?q=김치&pageSize=10`);
  expect(res.status(), `Expected 200 for q=김치, got ${res.status()}`).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.data), "body.data must be an array").toBe(true);
  expect(body.data.length, "q=김치 must return at least one product").toBeGreaterThan(0);
  const hasKimchi = (body.data as Array<{ product_name: string }>).some((item) =>
    item.product_name.includes("김치"),
  );
  expect(hasKimchi, "At least one result should have 김치 in product_name").toBe(true);
});

// ---------------------------------------------------------------------------
// VS-I-021: meta.totalIsEstimate present and true on Supabase path
// ---------------------------------------------------------------------------
test("VS-I-021 GET /api/products meta includes totalIsEstimate=true on Supabase path", async ({ request }) => {
  const res = await request.get(`${BASE}/api/products?page=1&pageSize=5`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("meta");
  // On the Supabase path, planned count is used; totalIsEstimate must be true.
  // On the SQLite path, totalIsEstimate is absent (exact count). Skip gracefully if SQLite.
  if (body.meta.totalIsEstimate !== undefined) {
    expect(body.meta.totalIsEstimate, "meta.totalIsEstimate must be true on Supabase planned-count path").toBe(true);
  }
  expect(body.meta).toHaveProperty("total");
  expect(typeof body.meta.total).toBe("number");
});

// ---------------------------------------------------------------------------
// VS-I-019: mobile 390x844 — /manufacturing-brief page
// ---------------------------------------------------------------------------
test("VS-I-019 /manufacturing-brief mobile 390x844 — no errors, no overflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/manufacturing-brief`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-019-manufacturing-brief-mobile-390.png") });

  expect(overflow, "Horizontal overflow on /manufacturing-brief @ 390px").toBe(false);
  const jsErrors = errors.filter((e) => !e.includes("favicon") && !e.includes("404"));
  expect(jsErrors, `JS errors on /manufacturing-brief mobile: ${jsErrors.join("; ")}`).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// VS-I-022: /products category filter contains approved top categories on first load.
// Proves snapshot-based approach renders 소스, 과자, 김치 without a category network loop.
// ---------------------------------------------------------------------------
test("VS-I-022 /products category filter contains 소스, 과자, 김치 on first load", async ({ page }) => {
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const select = page.locator('aside[aria-label="제품 필터"] select');
  await expect(select).toBeVisible();
  const options = await select.locator("option").allTextContents();
  const names = new Set(options);
  expect(names.has("소스"), "Filter must contain 소스 (rank-1 category)").toBe(true);
  expect(names.has("과자"), "Filter must contain 과자 (rank-12 category)").toBe(true);
  expect(names.has("김치"), "Filter must contain 김치 (rank-17 category)").toBe(true);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "vs-i-022-category-filter.png") });
});

// ---------------------------------------------------------------------------
// VS-I-023: /products page HTML does not expose source hash or aggregate counts.
// Ensures snapshot metadata (hash, raw counts) never leaks to the browser.
// ---------------------------------------------------------------------------
test("VS-I-023 /products page HTML does not expose source hash or aggregate counts", async ({ page }) => {
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const html = await page.content();
  expect(html.includes("23104bfccc0163fb"), "Source hash must not appear in page HTML").toBe(false);
  expect(html.includes("141933"), "Aggregate count 141933 (rank-1) must not appear in page HTML").toBe(false);
  expect(html.includes("20676"), "Aggregate count 20676 (rank-17) must not appear in page HTML").toBe(false);
});

// ---------------------------------------------------------------------------
// VS-I-024: 소스 is the first non-default option in the category filter (rank order).
// ---------------------------------------------------------------------------
test("VS-I-024 소스 is the first non-default category option (rank 1 from snapshot)", async ({ page }) => {
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const select = page.locator('aside[aria-label="제품 필터"] select');
  await expect(select).toBeVisible();
  // option[0] = "전체" (default), option[1] = rank-1 = 소스
  const firstNonDefault = await select.locator("option").nth(1).textContent();
  expect(firstNonDefault?.trim(), "First non-default option must be 소스 (rank 1)").toBe("소스");
});
