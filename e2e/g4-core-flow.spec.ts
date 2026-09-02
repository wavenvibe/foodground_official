/**
 * CHG-G6-001-G4-VS-01-CONTEXT-FIX-004 Core Flow E2E
 * 제품화 URL 맥락 보존: 레시피 → 대체 식재료 → 제조요건 → 공동제조 후보 → 제조시설 → 문의 준비
 * 규칙: 핵심 구간에서 값이 없을 때 if-return/skip 금지.
 *       데이터가 계약을 충족하지 않으면 명시적으로 실패.
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOT_DIR = path.join(process.cwd(), "output", "playwright", "g4-core-flow");

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

// ─── Step 1: Recipe → substitute with ingredient+recipe params ─────────────

test("context: recipe detail links directly to substitute with ingredient+recipe params", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();
  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");

  const firstLink = page.locator("article a").first();
  const href = await firstLink.getAttribute("href");
  expect(href, "Recipe list must have links").toMatch(/^\/recipes\//);
  await page.goto(href!);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "01-recipe-detail");

  const recipeId = page.url().split("/recipes/")[1]?.split("?")[0];
  expect(recipeId, "Must extract recipeId from URL").toBeTruthy();

  const substituteLinks = page.locator("a[href^='/substitutes?'][href*='ingredient=']");
  const count = await substituteLinks.count();
  expect(count, "Recipe detail must have at least one substitute-search link").toBeGreaterThan(0);

  const substituteHref = await substituteLinks.first().getAttribute("href");
  const substituteUrl = new URL(substituteHref!, "http://localhost:3000");
  expect(substituteUrl.searchParams.get("ingredient"), "Substitute link must carry ingredient param").toBeTruthy();
  expect(substituteUrl.searchParams.get("recipe"), "Substitute link must carry recipe param").toBe(recipeId);
});

// ─── Step 2: Substitute page receives recipe context directly ──────────────

test("context: recipe-linked substitute page preserves ingredient and recipe", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto("/recipes");
  await page.waitForLoadState("networkidle");
  const firstRecipeHref = await page.locator("article a").first().getAttribute("href");
  expect(firstRecipeHref).toMatch(/^\/recipes\//);

  await page.goto(firstRecipeHref!);
  await page.waitForLoadState("networkidle");

  const recipeId = page.url().split("/recipes/")[1]?.split("?")[0];
  expect(recipeId, "Must extract recipeId").toBeTruthy();

  const substituteLinks = page.locator("a[href^='/substitutes?'][href*='ingredient=']");
  const count = await substituteLinks.count();
  expect(count, "Must have substitute links in recipe detail").toBeGreaterThan(0);

  const substituteHref = await substituteLinks.first().getAttribute("href");
  const substituteUrl = new URL(substituteHref!, "http://localhost:3000");
  const ingredient = substituteUrl.searchParams.get("ingredient");
  expect(ingredient, "Must carry an ingredient name").toBeTruthy();
  await page.goto(substituteHref!);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "02-substitutes-from-recipe");

  await expect(page.locator("input[name='ingredient']")).toHaveValue(ingredient!);
  await expect(page.locator("input[type='hidden'][name='recipe']")).toHaveValue(recipeId!);
});

// ─── Step 3: Substitute page receives recipe and shows per-candidate action ──

test("context: substitute candidate card has manufacturing brief action with ingredient+substitute+recipe", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const testIngredient = "두부";
  const testRecipe = "12345";
  await page.goto(`/substitutes?ingredient=${encodeURIComponent(testIngredient)}&recipe=${testRecipe}`);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "03-substitutes-result");

  // Must have results (not unmatched/empty)
  const results = page.locator(".substitute-results");
  await expect(results, "Substitute results section must be visible").toBeVisible();

  // First candidate card must lead to the manufacturing brief before facility matching.
  const firstAction = page.locator(".candidate-card__action a").first();
  await expect(firstAction, "First candidate must have facility action link").toBeVisible();

  const actionHref = await firstAction.getAttribute("href");
  expect(actionHref, "Facility action must contain ingredient").toContain(`ingredient=${encodeURIComponent(testIngredient)}`);
  expect(actionHref, "Facility action must contain substitute").toContain("substitute=");
  expect(actionHref, "Facility action must contain recipe").toContain(`recipe=${testRecipe}`);
  expect(actionHref, "Candidate action must point to /manufacturing-brief").toContain("/manufacturing-brief");
});

// ─── Step 4: Substitute search form preserves recipe on submit ───────────────

test("context: substitute form hidden recipe input preserves recipe", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto("/substitutes?ingredient=%EB%91%90%EB%B6%80&recipe=99999");
  await page.waitForLoadState("networkidle");

  // hidden input must exist
  const hiddenInput = page.locator("input[type='hidden'][name='recipe']");
  await expect(hiddenInput, "Hidden recipe input must exist in form").toBeAttached();
  const hiddenVal = await hiddenInput.getAttribute("value");
  expect(hiddenVal, "Hidden recipe input must have value 99999").toBe("99999");
});

// ─── Step 5: Facility list preserves ingredient+substitute+recipe ────────────

test("context: facility list card links carry ingredient+substitute+recipe", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const testIngredient = "두부";
  const testSubstitute = "곤약콩두부";
  const testRecipe = "777";
  await page.goto(
    `/facilities?ingredient=${encodeURIComponent(testIngredient)}&substitute=${encodeURIComponent(testSubstitute)}&recipe=${testRecipe}`,
  );
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "04-facility-list-with-context");

  // Context banner must be visible
  const banner = page.locator(".facility-context-note");
  await expect(banner, "Context note must be visible").toBeVisible();
  await expect(banner).toContainText(testSubstitute);

  // Facility detail links must carry all three context params
  const detailLinks = page.locator("article a[href^='/facilities/']");
  const count = await detailLinks.count();
  expect(count, "Must have at least one facility").toBeGreaterThan(0);

  const firstHref = await detailLinks.first().getAttribute("href");
  expect(firstHref, "Detail link must contain ingredient").toContain(`ingredient=${encodeURIComponent(testIngredient)}`);
  expect(firstHref, "Detail link must contain substitute").toContain(`substitute=${encodeURIComponent(testSubstitute)}`);
  expect(firstHref, "Detail link must contain recipe").toContain(`recipe=${testRecipe}`);
});

// ─── Step 6: Facility filter preserves context through submit ────────────────

test("context: facility filter hidden inputs preserve context on submit", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto("/facilities?ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80&recipe=555");
  await page.waitForLoadState("networkidle");

  const hiddenIngredient = page.locator("form input[type='hidden'][name='ingredient']");
  const hiddenSubstitute = page.locator("form input[type='hidden'][name='substitute']");
  const hiddenRecipe = page.locator("form input[type='hidden'][name='recipe']");

  await expect(hiddenIngredient, "ingredient hidden input must exist").toBeAttached();
  await expect(hiddenSubstitute, "substitute hidden input must exist").toBeAttached();
  await expect(hiddenRecipe, "recipe hidden input must exist").toBeAttached();

  expect(await hiddenIngredient.getAttribute("value"), "ingredient value").toBe("두부");
  expect(await hiddenSubstitute.getAttribute("value"), "substitute value").toBe("곤약콩두부");
  expect(await hiddenRecipe.getAttribute("value"), "recipe value").toBe("555");

  // 조건 초기화 link must preserve context
  const resetLink = page.locator(".facility-filters__actions a").first();
  const resetHref = await resetLink.getAttribute("href");
  expect(resetHref, "Reset link must include ingredient context").toContain("ingredient=");
  expect(resetHref, "Reset link must include substitute context").toContain("substitute=");
  expect(resetHref, "Reset link must include recipe context").toContain("recipe=");
});

// ─── Step 7: Facility detail shows inquiry button with all 3 context params ──

test("context: facility detail inquiry button carries ingredient+substitute+recipe", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const testIngredient = "두부";
  const testSubstitute = "곤약콩두부";
  const testRecipe = "1234";
  await page.goto(
    `/facilities?ingredient=${encodeURIComponent(testIngredient)}&substitute=${encodeURIComponent(testSubstitute)}&recipe=${testRecipe}`,
  );
  await page.waitForLoadState("networkidle");

  const firstDetailLink = page.locator("article a[href^='/facilities/']").first();
  const detailHref = await firstDetailLink.getAttribute("href");
  expect(detailHref, "Detail href must exist").toBeTruthy();

  await page.goto(detailHref!);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "05-facility-detail-with-context");

  const inquiryBtn = page.locator("a[href^='/inquiry']").filter({ hasText: "문의 준비하기" });
  await expect(inquiryBtn, "Inquiry button must be visible").toBeVisible();

  const inquiryHref = await inquiryBtn.getAttribute("href");
  expect(inquiryHref, "inquiry link must have facility=").toContain("facility=");
  expect(inquiryHref, "inquiry link must have facilityName=").toContain("facilityName=");
  expect(inquiryHref, "inquiry link must have ingredient=").toContain(`ingredient=${encodeURIComponent(testIngredient)}`);
  expect(inquiryHref, "inquiry link must have substitute=").toContain(`substitute=${encodeURIComponent(testSubstitute)}`);
  expect(inquiryHref, "inquiry link must have recipe=").toContain(`recipe=${testRecipe}`);
});

// ─── Step 8: Inquiry page shows "레시피 #ID" and carries all context ─────────

test("context: inquiry page shows recipe #ID and full context in aside and textarea", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto(
    "/inquiry?facility=TEST001&facilityName=%ED%85%8C%EC%8A%A4%ED%8A%B8%EC%8B%9D%ED%92%88&ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80&recipe=9999",
  );
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "06-inquiry-page-full-context");

  await expect(page.getByRole("heading", { name: "문의 준비" })).toBeVisible();

  // context aside
  const aside = page.locator(".inquiry-context");
  await expect(aside, "Context aside must be visible").toBeVisible();
  await expect(aside).toContainText("테스트식품");
  await expect(aside).toContainText("두부");
  await expect(aside).toContainText("곤약콩두부");
  await expect(aside).toContainText("레시피 #9999");

  // textarea must contain all context
  const textarea = page.locator("textarea.contact-button-section__template");
  await expect(textarea, "Textarea must be visible").toBeVisible();
  const content = await textarea.inputValue();
  expect(content, "Textarea must reference 테스트식품").toContain("테스트식품");
  expect(content, "Textarea must reference 두부").toContain("두부");
  expect(content, "Textarea must reference 곤약콩두부").toContain("곤약콩두부");
  expect(content, "Textarea must show 레시피 #9999").toContain("레시피 #9999");

  // copy button
  await expect(page.locator("button").filter({ hasText: "문의내용 복사" })).toBeVisible();
});

// ─── Step 9: Inquiry page without context shows no aside ────────────────────

test("context: inquiry page without params shows no context aside", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto("/inquiry");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);

  await expect(page.locator(".inquiry-context")).not.toBeVisible();
  await expect(page.locator("textarea.contact-button-section__template")).toBeVisible();
});

// ─── Step 10: /inquiry mobile overflow check ─────────────────────────────────

test("context: /inquiry no overflow mobile", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();

  await page.goto(
    "/inquiry?facility=X&facilityName=%EC%A0%9C%EC%A1%B0%EC%82%AC&ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD&recipe=111",
  );
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "10-inquiry-mobile");
});

// ─── Step 11: /facilities mobile overflow ────────────────────────────────────

test("context: /facilities no overflow mobile", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "mobile") test.skip();

  await page.goto("/facilities?ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);
  await shot(page, "11-facilities-mobile");
});

// ─── Step 12: Full end-to-end journey with ingredient+substitute+recipe ───────

test("context: full context-preserving journey from substitutes to inquiry", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const testIngredient = "두부";
  const testRecipe = "42";

  // 1. Start at substitutes with ingredient+recipe
  await page.goto(`/substitutes?ingredient=${encodeURIComponent(testIngredient)}&recipe=${testRecipe}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".substitute-results, .state-panel")).toBeVisible();
  await noOverflow(page);

  // 2. Get substitute from first candidate action (must exist)
  const firstAction = page.locator(".candidate-card__action a").first();
  await expect(firstAction, "First candidate action must be present").toBeVisible();
  const briefHref = await firstAction.getAttribute("href");
  expect(briefHref, "Manufacturing brief href must exist").toBeTruthy();
  expect(briefHref, "Manufacturing brief href must have ingredient").toContain("ingredient=");
  expect(briefHref, "Manufacturing brief href must have substitute").toContain("substitute=");
  expect(briefHref, "Manufacturing brief href must have recipe").toContain(`recipe=${testRecipe}`);

  // Parse substitute from href
  const briefUrl = new URL(briefHref!, "http://localhost:3000");
  const substitute = briefUrl.searchParams.get("substitute");
  expect(substitute, "Substitute param must be non-empty").toBeTruthy();

  // 3. Complete the manufacturing brief and navigate to evidence-ranked candidates.
  await page.goto(briefHref!);
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain("/manufacturing-brief");
  await noOverflow(page);
  await page.locator('select[name="item"]').selectOption("과자");
  await page.locator('select[name="region"]').selectOption("경상북도");
  await page.locator('input[name="ccp"][value="CCP-S01"]').check();
  await page.getByRole("button", { name: "이 요건으로 제조 후보 확인" }).click();
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain("/manufacturing-candidates");
  await noOverflow(page);
  await shot(page, "12a-journey-manufacturing-candidates");

  // 4. Navigate to the first evidence-backed facility detail.
  const firstDetailLink = page.getByRole("link", { name: "업체 제품·스마트 HACCP 근거 검증" }).first();
  await expect(firstDetailLink, "Evidence-backed facility link must exist").toBeVisible();
  const detailHref = await firstDetailLink.getAttribute("href");
  expect(detailHref, "Evidence-backed facility href must exist").toBeTruthy();
  await page.goto(detailHref!);
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain("/facilities/");
  await noOverflow(page);
  await shot(page, "12b-journey-facility-detail");

  // 5. Navigate to inquiry
  const inquiryLink = page.locator("a[href^='/inquiry']").first();
  const inquiryHref = await inquiryLink.getAttribute("href");
  expect(inquiryHref, "Inquiry href must exist").toBeTruthy();
  await page.goto(inquiryHref!);
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain("/inquiry");
  await noOverflow(page);
  await shot(page, "12c-journey-inquiry");

  // Inquiry page verifications
  await expect(page.getByRole("heading", { name: "문의 준비" })).toBeVisible();

  // Context aside must show recipe as #ID
  const aside = page.locator(".inquiry-context");
  await expect(aside, "Context aside must be visible").toBeVisible();
  await expect(aside).toContainText(`레시피 #${testRecipe}`);
  await expect(aside).toContainText(testIngredient);
  await expect(aside).toContainText(substitute!);

  // Textarea must have substitute and recipe
  const textarea = page.locator("textarea.contact-button-section__template");
  const content = await textarea.inputValue();
  expect(content, "Textarea must reference substitute").toContain(substitute!);
  expect(content, "Textarea must reference recipe #ID").toContain(`레시피 #${testRecipe}`);
  expect(content, "Textarea must reference ingredient").toContain(testIngredient);
});

// ─── Step 13: Facility list context banner — correct disclaimer text ──────────

test("context: facility list context banner shows inquiry disclaimer", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto("/facilities?ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80&recipe=42");
  await page.waitForLoadState("networkidle");

  const banner = page.locator(".facility-context-note");
  await expect(banner, "Context banner must be visible").toBeVisible();

  const bannerText = await banner.textContent();
  // Must NOT say "제조 가능 시설을 찾고 있습니다" (old misleading text)
  expect(bannerText, "Banner must not claim manufacturing readiness").not.toContain("제조 가능 시설을 찾고 있습니다");
  // Must indicate this is about finding facilities to inquire
  expect(bannerText, "Banner must mention inquiry context").toContain("문의할 시설");
  // Must have disclaimer about direct confirmation
  expect(bannerText, "Banner must have disclaimer").toContain("직접 문의");
});

// ─── Step 14: Facility detail shows selected context panel ───────────────────

test("context: facility detail shows selected context panel", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  await page.goto(
    "/facilities?ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80&recipe=42",
  );
  await page.waitForLoadState("networkidle");

  const firstDetailLink = page.locator("article a[href^='/facilities/']").first();
  const detailHref = await firstDetailLink.getAttribute("href");
  expect(detailHref, "Detail href must exist").toBeTruthy();

  await page.goto(detailHref!);
  await page.waitForLoadState("networkidle");

  // Context panel must be visible on detail page
  const contextPanel = page.locator(".facility-context-note--detail");
  await expect(contextPanel, "Context panel must be visible on detail").toBeVisible();
  const panelText = await contextPanel.textContent();
  // Must reference substitute and disclaimer
  expect(panelText, "Panel must mention inquiry purpose").toMatch(/문의|맥락/);
  expect(panelText, "Panel must have Smart HACCP/process disclaimer").toContain("직접 문의");
  await shot(page, "14-facility-detail-context");
});

// ─── Step 15: /inquiry context-lost when no facility param ───────────────────

test("context: /inquiry shows context-lost notice when no facility param", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  // Direct entry — no facility param
  await page.goto("/inquiry");
  await page.waitForLoadState("networkidle");
  await noOverflow(page);

  // Context-lost notice must appear
  const notice = page.locator(".inquiry-context-lost");
  await expect(notice, "Context-lost notice must be visible").toBeVisible();
  const noticeText = await notice.textContent();
  expect(noticeText, "Notice must explain direct entry").toMatch(/직접 진입|맥락 없음/);

  // Form must still be usable (textarea exists, copy button exists)
  await expect(
    page.locator("textarea.contact-button-section__template"),
    "Form textarea must still be present",
  ).toBeVisible();
  await expect(
    page.locator("button.button--point"),
    "Copy button must still be present",
  ).toBeVisible();

  // No context aside (no params provided)
  await expect(page.locator(".inquiry-context")).not.toBeVisible();
  await shot(page, "15-inquiry-context-lost");
});

// ─── Step 16: /inquiry with real facility ID shows tel or "정보 없음" ──────────

test("context: /inquiry with facility ID shows contact or no-info", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  // Use a real facility from the list to get a valid mgt_no
  await page.goto("/facilities");
  await page.waitForLoadState("networkidle");

  const firstCard = page.locator("article").first();
  await expect(firstCard, "At least one facility must exist").toBeVisible();
  const detailLink = firstCard.locator("a[href^='/facilities/']").first();
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref, "Detail href must exist").toBeTruthy();

  // Extract mgt_no from detail URL
  const mgtNo = detailHref!.replace("/facilities/", "").split("?")[0];
  expect(mgtNo, "mgt_no must be non-empty").toBeTruthy();

  await page.goto(`/inquiry?facility=${mgtNo}&facilityName=%ED%85%8C%EC%8A%A4%ED%8A%B8`);
  await page.waitForLoadState("networkidle");
  await noOverflow(page);

  // Contact section must be present (no context-lost)
  await expect(
    page.locator(".inquiry-context-lost"),
    "Context-lost must NOT appear when facility ID is present",
  ).not.toBeVisible();

  const contactSection = page.locator(".inquiry-facility-contact");
  await expect(contactSection, "Contact section must be visible").toBeVisible();

  // Either real tel link or "정보 없음" text must appear
  const telDd = contactSection.locator("dl dd").first();
  const telText = await telDd.textContent();
  const hasTel = telText?.trim() !== "" && telText !== null;
  expect(hasTel, "Tel dd must have content (real number or 정보 없음)").toBe(true);
  // Must NOT claim email automation
  const sectionText = await contactSection.textContent();
  expect(sectionText, "Contact section must say no auto-send").toContain("자동 발송하지 않습니다");
  await shot(page, "16-inquiry-facility-contact");
});

// ─── Step 17: malformed back= does not cause 500 ─────────────────────────────

test("context: malformed back param is handled safely", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // malformed percent-encoding in back param
  await page.goto("/facilities/TEST_ID?back=%");
  await page.waitForLoadState("networkidle");

  // Page must not show 500 or crash — should show facility error state or not-found, not a crash
  const title = await page.title();
  expect(title, "Page title must not indicate 500").not.toMatch(/500|Internal Server Error/i);

  // No uncaught pageerror that mentions URIError or decodeURIComponent
  const uriErrors = errors.filter((e) => /URIError|decodeURI/i.test(e));
  expect(uriErrors, "No URIError in page console").toHaveLength(0);

  // Inquiry page malformed back param
  errors.length = 0;
  await page.goto("/inquiry?facility=X&back=%25invalid");
  await page.waitForLoadState("networkidle");
  const title2 = await page.title();
  expect(title2, "Inquiry title must not indicate 500").not.toMatch(/500|Internal Server Error/i);
  await shot(page, "17-malformed-back");
});

// ─── Step 18: No console errors on core pages ─────────────────────────────────

test("context: no console pageerrors on core pages", async ({ page }, testInfo) => {
  if (testInfo.project.name !== "desktop") test.skip();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const pages = [
    "/substitutes?ingredient=%EB%91%90%EB%B6%80&recipe=42",
    "/facilities?ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD%EC%BD%A9%EB%91%90%EB%B6%80&recipe=42",
    "/inquiry?facility=X&facilityName=%EC%A0%9C%EC%A1%B0%EC%82%AC&ingredient=%EB%91%90%EB%B6%80&substitute=%EA%B3%A4%EC%95%BD&recipe=42",
    "/inquiry",
  ];

  for (const url of pages) {
    errors.length = 0;
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    expect(errors, `No pageerror on ${url}`).toHaveLength(0);
  }
});
