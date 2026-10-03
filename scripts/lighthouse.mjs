// Lighthouse on the landing page (mobile and desktop presets) using the installed Chrome.
// Usage: start the site (npm run start:mock), then: node scripts/lighthouse.mjs [url]
import { mkdirSync, writeFileSync } from "node:fs";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const url = process.argv[2] ?? "http://127.0.0.1:8787/?lang=ar";
mkdirSync("lighthouse", { recursive: true });
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-sandbox"] });
const out = {};
try {
  for (const preset of ["mobile", "desktop"]) {
    const config = preset === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined;
    const r = await lighthouse(url, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] }, config);
    const c = r.lhr.categories;
    out[preset] = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v.score * 100)]));
    out[preset].LCP = r.lhr.audits["largest-contentful-paint"].displayValue;
    out[preset].CLS = r.lhr.audits["cumulative-layout-shift"].displayValue;
    out[preset].TBT = r.lhr.audits["total-blocking-time"].displayValue;
    const failing = Object.values(r.lhr.audits)
      .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable" && a.scoreDisplayMode !== "manual")
      .map((a) => `${a.id} (${a.score})`);
    out[preset].below90 = failing;
    writeFileSync(`lighthouse/${preset}.json`, r.report);
  }
} finally {
  console.log(JSON.stringify({ url, ...out }, null, 2));
  try {
    await chrome.kill();
  } catch {
    /* Windows sometimes keeps the temp profile locked; harmless */
  }
}
