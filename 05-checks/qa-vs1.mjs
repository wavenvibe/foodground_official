import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "file:///C:/Users/rlove/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3100";
const outputDir = new URL("../output/playwright/vs1/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});
const report = { baseUrl, checkedAt: new Date().toISOString(), views: [], compatibility: {}, api: {} };

for (const view of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(`${baseUrl}/facilities?q=곡물`, { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    heading: document.querySelector("h1")?.textContent?.trim() ?? "",
    stateTitle: document.querySelector(".state-panel h2")?.textContent?.trim() ?? "",
    traceVisible: Boolean(document.querySelector(".state-panel__trace")),
    searchInputVisible: Boolean(document.querySelector("#facility-q")),
  }));

  await page.screenshot({ path: fileURLToPath(new URL(`facilities-${view.name}.png`, outputDir)), fullPage: true });
  report.views.push({
    ...view,
    status: response?.status() ?? null,
    ...metrics,
    horizontalOverflow: metrics.scrollWidth > metrics.innerWidth,
    consoleErrors,
    pageErrors,
  });
  await context.close();
}

const compatibilityPage = await browser.newPage();
await compatibilityPage.goto(`${baseUrl}/search?q=곡물&haccp=1`, { waitUntil: "networkidle" });
report.compatibility = {
  finalUrl: compatibilityPage.url(),
  preservedQuery: compatibilityPage.url().includes("q=%EA%B3%A1%EB%AC%BC") && compatibilityPage.url().includes("haccp=1"),
};
await compatibilityPage.close();

const apiContext = await browser.newContext();
const apiResponse = await apiContext.request.get(`${baseUrl}/api/search/facilities?q=곡물`);
const apiBody = await apiResponse.json();
report.api = {
  status: apiResponse.status(),
  code: apiBody?.error?.code ?? null,
  hasTraceId: typeof apiBody?.traceId === "string" && apiBody.traceId.length > 0,
  leakedProviderDetail: JSON.stringify(apiBody).includes("supabase.co") || JSON.stringify(apiBody).includes("facilities"),
};
await apiContext.close();

await browser.close();
await writeFile(new URL("qa-report.json", outputDir), `${JSON.stringify(report, null, 2)}\n`, "utf8");

const failures = [
  ...report.views.flatMap((view) => [
    view.status !== 200 ? `${view.name}: status ${view.status}` : null,
    view.heading !== "제조업체 찾기" ? `${view.name}: heading mismatch` : null,
    view.stateTitle !== "결과를 불러오지 못했습니다" ? `${view.name}: unavailable state missing` : null,
    !view.traceVisible ? `${view.name}: trace missing` : null,
    !view.searchInputVisible ? `${view.name}: search input missing` : null,
    view.horizontalOverflow ? `${view.name}: horizontal overflow` : null,
    view.consoleErrors.length ? `${view.name}: console errors` : null,
    view.pageErrors.length ? `${view.name}: page errors` : null,
  ]),
  !report.compatibility.preservedQuery ? "compatibility redirect failed" : null,
  report.api.status !== 503 ? `api: expected 503, got ${report.api.status}` : null,
  report.api.code !== "FG_DATA_UNAVAILABLE" ? "api: error contract mismatch" : null,
  !report.api.hasTraceId ? "api: trace missing" : null,
  report.api.leakedProviderDetail ? "api: provider detail leaked" : null,
].filter(Boolean);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, report }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, report }, null, 2));
}
