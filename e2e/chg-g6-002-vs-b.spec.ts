import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.VSB_BASE_URL ?? "http://localhost:3003";
const FACILITY_ID = "4490000-106-2013-00033";
const PRODUCT_ID = "20130368349509";
const EVIDENCE_DIR = path.join(process.cwd(), "output", "playwright", "chg-g6-002-vs-b");

test.beforeAll(() => fs.mkdirSync(EVIDENCE_DIR, { recursive: true }));

test("actual-source APIs preserve direct product, facility, HACCP and safety linkage", async ({ request }) => {
  const products = await request.get(`${BASE}/api/products?q=${encodeURIComponent("버터그린밀")}`);
  expect(products.status()).toBe(200);
  const productsJson = await products.json();
  expect(productsJson.data.some((item: { report_no: string }) => item.report_no === PRODUCT_ID)).toBeTruthy();

  const detail = await request.get(`${BASE}/api/products/${PRODUCT_ID}`);
  expect(detail.status()).toBe(200);
  const detailJson = await detail.json();
  expect(detailJson.data.facility_mgt_no).toBe(FACILITY_ID);
  expect(detailJson.data.haccp[0].cert_no).toBe("2024-6-0026");
  expect(detailJson.data.safety[0].reason).toContain("대장균군");

  for (const endpoint of ["products", "haccp", "safety"]) {
    const response = await request.get(`${BASE}/api/facilities/${FACILITY_ID}/${endpoint}`);
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).not.toMatch(/maker_addr|biz_addr|raw_payload|road_addr|coord_x|coord_y/);
  }
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name}: product-to-facility evidence flow is visible and responsive`, async ({ browser }) => {
    const page = await browser.newPage({ viewport });
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "제품화 검토 흐름" })).toBeVisible();
    if (viewport.name === "mobile") {
      await page.getByRole("button", { name: "메뉴 열기" }).click();
      await expect(page.getByRole("link", { name: "제품", exact: true })).toBeVisible();
    }
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewport.name}-home-flow.png`), fullPage: true });

    await page.goto(`${BASE}/products?q=${encodeURIComponent("버터그린밀")}`, { waitUntil: "networkidle" });
    await expect(page.getByText("버터그린밀", { exact: true })).toBeVisible();
    await expect(page.getByText("HACCP 시설", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewport.name}-product-search.png`), fullPage: true });

    await page.goto(`${BASE}/products/${PRODUCT_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "실제 제조업체 연결" })).toBeVisible();
    await expect(page.getByText("2024-6-0026", { exact: true })).toBeVisible();
    await expect(page.getByText(/대장균군 기준 규격 부적합/)).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewport.name}-product-detail.png`), fullPage: true });

    await page.goto(`${BASE}/facilities/${FACILITY_ID}?product=${PRODUCT_ID}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "주식회사소울네이처푸드" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "이 업체의 생산제품" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "HACCP 인증·CCP 정보" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "업체 직접 연결 안전정보" })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewport.name}-facility-evidence.png`), fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.close();
  });
}
