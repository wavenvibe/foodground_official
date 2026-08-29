import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_GATE_2_URL ?? "http://127.0.0.1:4178";
const outputDir = resolve("output/playwright/ui-gate-2");
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  const response = await page.goto(`${baseUrl}/state-board.html`, { waitUntil: "networkidle" });
  const dimensions = await page.evaluate(() => ({
    rootOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
    mainOverflow: document.querySelector("main").scrollWidth - document.querySelector("main").clientWidth,
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
  }));

  if (viewport.name === "mobile") {
    const menu = page.locator(".mobile-menu");
    if (!(await menu.isVisible())) errors.push("mobile menu is not visible");
    await menu.click();
    if (!(await page.locator(".mobile-drawer.open").isVisible())) errors.push("mobile drawer did not open");
  } else if (!(await page.locator(".desktop-nav").isVisible())) {
    errors.push("desktop navigation is not visible");
  }

  const panelCount = await page.locator(".state-panel").count();
  if (panelCount !== 8) errors.push(`state panel count mismatch: ${panelCount}`);

  const badgeTypes = ["exact", "substring", "fuzzy", "synonym", "unmatched"];
  for (const badgeType of badgeTypes) {
    if ((await page.locator(`.match-badge.${badgeType}`).count()) === 0) {
      errors.push(`match badge missing: ${badgeType}`);
    }
  }

  const unmatchedPanel = page.locator(".state-panel", { hasText: "ST-07" });
  if ((await unmatchedPanel.count()) !== 1) errors.push("ST-07 panel is missing or duplicated");
  if (!(await unmatchedPanel.locator(".no-score").isVisible())) errors.push("ST-07 no-score notice is missing");
  if ((await unmatchedPanel.locator(".candidate, .metric, .sim-bars").count()) !== 0) {
    errors.push("ST-07 exposes candidate or similarity components");
  }

  await page.locator("#demo-copy").click();
  try {
    await page.locator("#demo-feedback").evaluate((element) => {
      if (!element.textContent?.trim()) throw new Error("copy feedback is empty");
    });
  } catch (error) {
    errors.push(error.message);
  }

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(100);
  await page.screenshot({
    path: resolve(outputDir, `${viewport.name}-state-board.png`),
    fullPage: true,
  });

  const row = {
    viewport: viewport.name,
    status: response?.status() ?? 0,
    panelCount,
    ...dimensions,
    errors,
  };
  if (
    row.status !== 200 ||
    row.rootOverflow !== 0 ||
    row.bodyOverflow !== 0 ||
    row.mainOverflow !== 0 ||
    !row.heading ||
    errors.length
  ) {
    failed = true;
  }
  results.push(row);
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ pass: !failed, cases: results.length, results }, null, 2));
process.exitCode = failed ? 1 : 0;
