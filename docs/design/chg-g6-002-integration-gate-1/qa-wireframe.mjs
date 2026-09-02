import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, "screenshots");
const screens = ["workspace", "product", "substitutes", "brief", "matching", "facility"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
let failures = 0;

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", error => errors.push(`page: ${error.message}`));

  for (const screen of screens) {
    await page.goto(`${pathToFileURL(path.join(here, "index.html")).href}?screen=${screen}`);
    await page.waitForLoadState("load");
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      main: document.querySelector("main").scrollWidth - document.querySelector("main").clientWidth,
    }));
    if (Object.values(overflow).some(value => value > 1) || errors.length) {
      failures += 1;
      console.error(`[FAIL] ${viewport.name}/${screen}`, { overflow, errors: [...errors] });
    } else {
      console.log(`[PASS] ${viewport.name}/${screen}`);
    }
    await page.screenshot({ path: path.join(output, `${viewport.name}-${screen}.png`), fullPage: true });
    errors.length = 0;
  }
  await page.close();
}

await browser.close();
if (failures) process.exit(1);
console.log(`[PASS] ${screens.length * viewports.length} wireframe views`);
