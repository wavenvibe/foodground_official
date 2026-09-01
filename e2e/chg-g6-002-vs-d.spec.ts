import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.VSD_BASE_URL ?? "http://127.0.0.1:3013";
const EVIDENCE_DIR = path.join(process.cwd(), "output", "playwright", "chg-g6-002-vs-d");

test.beforeAll(() => fs.mkdirSync(EVIDENCE_DIR, { recursive: true }));

test("recipe ingredient substitute manufacturing facility inquiry keeps one visible context", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  const assertPage = async (step: string) => {
    await expect(page.getByRole("navigation", { name: "제품화 진행 단계" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${step} horizontal overflow`).toBeLessThanOrEqual(1);
  };

  await page.goto(`${BASE}/recipes/6920615`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "청국장", exact: true })).toBeVisible();
  await assertPage("recipe");
  await page.getByRole("link", { name: "돼지고기", exact: true }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "돼지고기", exact: true })).toBeVisible();
  await expect(page.getByLabel("현재 제품화 선택")).toContainText("청국장");
  await expect(page.getByLabel("현재 제품화 선택")).toContainText("돼지고기");
  await assertPage("ingredient");
  await page.getByRole("link", { name: "대체 식재료 분석" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /돼지고기, 살코기, 생것의 대체 식재료/ })).toBeVisible();
  await expect(page.locator(".sim-bars").first()).toBeVisible();
  await expect(page.locator(".candidate-card").first().getByRole("heading", { name: "오리고기, 살코기, 생것" })).toBeVisible();
  await assertPage("substitute");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${testInfo.project.name}-substitute-context.png`), fullPage: true });
  await page.locator(".candidate-card").first().getByRole("link", { name: "이 후보로 제품화 요건 확인" }).click();
  await page.waitForLoadState("networkidle");

  const currentWork = page.getByLabel("현재 제품화 선택");
  await expect(currentWork).toContainText("청국장");
  await expect(currentWork).toContainText("돼지고기");
  await expect(currentWork).toContainText("오리고기, 살코기, 생것");
  await expect(page.locator('select[name="item"]')).toHaveValue("");
  await assertPage("brief");
  await page.locator('select[name="item"]').selectOption("과자");
  await page.locator('select[name="region"]').selectOption("경상북도");
  await page.locator('input[name="ccp"][value="CCP-S01"]').check();
  await page.getByRole("button", { name: "이 요건으로 제조 후보 확인" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "공동제조 후보 근거 비교" })).toBeVisible();
  await expect(page.getByLabel("현재 제품화 선택")).toContainText("오리고기, 살코기, 생것");
  await expect(page.getByLabel("현재 제품화 선택")).toContainText("과자");
  await expect(page.getByText("전체 요건 충족").locator("..").getByText("5", { exact: true })).toBeVisible();
  await assertPage("candidates");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${testInfo.project.name}-manufacturing-context.png`), fullPage: true });
  await page.getByRole("link", { name: "업체 제품·스마트 HACCP 근거 검증" }).first().click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /후보 근거 검증/ })).toBeVisible();
  await expect(page.getByLabel("제품화 브리프 맥락")).toContainText("청국장");
  await expect(page.getByLabel("제품화 브리프 맥락")).toContainText("과자");
  await assertPage("facility");
  await page.getByRole("link", { name: "문의 준비하기" }).click();
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: "문의 준비" })).toBeVisible();
  await expect(page.getByLabel("문의 맥락")).toContainText("청국장");
  await expect(page.getByLabel("문의 맥락")).toContainText("돼지고기");
  await expect(page.getByLabel("문의 맥락")).toContainText("오리고기, 살코기, 생것");
  await expect(page.getByLabel("문의 맥락")).toContainText("과자");
  await expect(page.getByRole("textbox", { name: "문의 내용" })).toHaveValue(/참고 레시피: 청국장/);
  await assertPage("inquiry");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${testInfo.project.name}-inquiry-context.png`), fullPage: true });
  expect(errors).toEqual([]);
});
