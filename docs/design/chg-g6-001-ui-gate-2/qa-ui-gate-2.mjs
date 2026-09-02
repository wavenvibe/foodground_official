import { chromium } from "playwright";

const baseUrl = process.env.UI_GATE_2_URL ?? "http://127.0.0.1:4178";
const screens = ["home", "recipes", "recipe-detail", "ingredients", "ingredient-detail", "substitutes", "facilities", "facility-detail", "inquiry"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];
let failed = false;

for (const viewport of viewports) {
  const context = await browser.newContext({ viewport });
  for (const screen of screens) {
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    const response = await page.goto(`${baseUrl}/?screen=${screen}`, { waitUntil: "networkidle" });
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

    if (screen === "substitutes") {
      if ((await page.locator(".candidate").count()) !== 3) errors.push("substitute candidate count mismatch");
      if ((await page.locator(".metric").count()) !== 18) errors.push("six metrics per candidate are not present");
      if (!(await page.getByText("이용 전 확인:").isVisible())) errors.push("substitute limitation notice is missing");
    }
    if (screen === "facilities" && !(await page.getByText("HACCP 표시 경계:").isVisible())) {
      errors.push("facility HACCP boundary notice is missing");
    }

    const row = {
      viewport: viewport.name,
      screen,
      status: response?.status() ?? 0,
      ...dimensions,
      errors,
    };
    if (row.status !== 200 || row.rootOverflow !== 0 || row.bodyOverflow !== 0 || row.mainOverflow !== 0 || !row.heading || errors.length) failed = true;
    results.push(row);
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ pass: !failed, cases: results.length, results }, null, 2));
process.exitCode = failed ? 1 : 0;
