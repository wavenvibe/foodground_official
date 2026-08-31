import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.VSC_BASE_URL ?? "http://127.0.0.1:3011";
const EVIDENCE_DIR = path.join(process.cwd(), "output", "playwright", "chg-g6-002-vs-c");

test.beforeAll(() => fs.mkdirSync(EVIDENCE_DIR, { recursive: true }));

test("actual 308-profile contract excludes 43 review rows and exposes evidence decisions", async ({ request }) => {
  const base = await request.get(`${BASE}/api/manufacturing/candidates?item=${encodeURIComponent("과자")}`);
  expect(base.status()).toBe(200);
  const baseJson = await base.json();
  expect(baseJson.data.totalItemMatched).toBe(46);
  expect(baseJson.data.qualifiedCount).toBe(46);
  expect(baseJson.data.excludedReviewProfiles).toBe(43);
  expect(baseJson.data.candidates.every((candidate: { facilityMgtNo: string; facility: unknown }) => candidate.facilityMgtNo && candidate.facility)).toBeTruthy();

  const qualified = await request.get(`${BASE}/api/manufacturing/candidates?item=${encodeURIComponent("과자")}&region=${encodeURIComponent("경상북도")}&ccp=CCP-S01`);
  const qualifiedJson = await qualified.json();
  expect(qualifiedJson.data.qualifiedCount).toBe(5);
  expect(qualifiedJson.data.candidates[0].verdict).toBe("qualified");
  expect(qualifiedJson.data.candidates[0].evidence.every((entry: { status: string }) => entry.status === "match")).toBeTruthy();

  const unmet = await request.get(`${BASE}/api/manufacturing/candidates?item=${encodeURIComponent("과자")}&ccp=CCP-S16&sterilize=1`);
  const unmetJson = await unmet.json();
  expect(unmetJson.data.qualifiedCount).toBe(0);
  expect(unmetJson.data.reviewCount).toBe(46);
  expect(unmetJson.data.candidates.some((candidate: { evidence: { status: string }[] }) => candidate.evidence.some((entry) => entry.status === "unmet"))).toBeTruthy();
});

test("productization brief to candidate to facility evidence keeps context", async ({ page }, testInfo) => {
    const viewportName = testInfo.project.name;
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(`${BASE}/manufacturing-brief?sourceType=product&sourceId=20130368349509&sourceName=${encodeURIComponent("버터그린밀")}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "어떤 제품을, 어떤 공정으로 만들까요?" })).toBeVisible();
    await expect(page.getByText("제품 · 버터그린밀", { exact: true })).toBeVisible();
    await page.locator('select[name="item"]').selectOption("과자");
    await page.locator('select[name="region"]').selectOption("경상북도");
    await page.locator('input[name="ccp"][value="CCP-S01"]').check();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewportName}-brief.png`), fullPage: true });
    await page.getByRole("button", { name: "이 요건으로 제조 후보 확인" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "공동제조 후보 근거 비교" })).toBeVisible();
    await expect(page.getByText("제품유형 일치").locator("..").getByText("46", { exact: true })).toBeVisible();
    await expect(page.getByText("전체 요건 충족").locator("..").getByText("5", { exact: true })).toBeVisible();
    await expect(page.getByText("매핑 검토대상 제외").locator("..").getByText("43", { exact: true })).toBeVisible();
    await expect(page.getByText("충족", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewportName}-candidates.png`), fullPage: true });

    await page.getByRole("link", { name: "업체 제품·HACCP 근거 검증" }).first().click();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /후보 근거 검증/ })).toBeVisible();
    await expect(page.getByText("과자", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("CCP-S01", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "이 업체의 생산제품" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "HACCP 인증·CCP 정보" })).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, `${viewportName}-facility-context.png`), fullPage: true });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
});
