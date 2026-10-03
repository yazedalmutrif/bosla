// Loads key pages in Chrome and reports console errors (e.g. hydration mismatches) and failed requests.
// Usage: node scripts/console-check.mjs [base]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://127.0.0.1:8787";
const pages = ["/?lang=ar", "/?lang=en", "/tailor?lang=ar", "/map?lang=en", "/privacy?lang=ar", "/about?lang=en"];
const browser = await chromium.launch({ channel: "chrome" });
let problems = 0;
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: theme });
  for (const p of pages) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));
    page.on("requestfailed", (r) => !r.url().includes("challenges.cloudflare.com") && errs.push("requestfailed: " + r.url()));
    await page.goto(base + p, { waitUntil: "load" });
    await page.waitForTimeout(2500); // lazy route chunks + Turnstile keep the network busy
    const h1 = await page.locator("h1").first().textContent();
    const hidden = await page.evaluate(() => getComputedStyle(document.getElementById("root")).visibility);
    console.log(`${theme} ${p} -> h1="${h1?.slice(0, 40)}" root=${hidden} errors=${errs.length}`);
    errs.forEach((e) => console.log("   ", e));
    problems += errs.length + (hidden !== "visible" ? 1 : 0);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`${problems} problem(s)`);
process.exitCode = problems ? 1 : 0;
