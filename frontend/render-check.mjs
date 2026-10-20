// Headless smoke test: load dev server in Edge, exercise tabs + state filter,
// report render state + console/page errors. Verification tool, not app.
import puppeteer from "puppeteer-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const URL = process.env.URL || "http://localhost:5173/";

const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`console.error: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

const snap = () =>
  page.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent ?? null,
    kpis: [...document.querySelectorAll(".kpi .value")].map((n) => n.textContent),
    h2s: [...document.querySelectorAll("h2")].map((n) => n.textContent),
    svgCount: document.querySelectorAll("svg").length,
    pathCount: document.querySelectorAll("svg path").length,
    hasForecast: [...document.querySelectorAll("h2")].some((n) => /forecast/i.test(n.textContent)),
    coloredStates: document.querySelectorAll("svg path[fill^='rgb']").length,
  }));

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".kpi .value", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
console.log("=== INDIA ==="); console.log(JSON.stringify(await snap(), null, 2));

await page.evaluate(() => [...document.querySelectorAll(".sidebar button")].find((b) => b.textContent.includes("State Level"))?.click());
await page.waitForSelector("select", { timeout: 10000 });
await new Promise((r) => setTimeout(r, 5000)); // lazy-load 51MB district geojson
console.log("=== STATE (default) ==="); console.log(JSON.stringify(await snap(), null, 2));

console.log("=== ERRORS (" + errors.length + ") ===");
errors.forEach((e) => console.log(" - " + e));
await browser.close();
process.exit(errors.length ? 1 : 0);
