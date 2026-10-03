// Load candidate URLs in the installed Chrome and print status, final URL and title.
// Usage: node scripts/probe-urls.mjs <url> [url...]
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });
for (const url of process.argv.slice(2)) {
  const page = await ctx.newPage();
  try {
    const r = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2000);
    const text = ((await page.locator("body").innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 140);
    console.log(`${r?.status() ?? "-"} ${url}\n    -> ${page.url()}\n    title: ${(await page.title()).slice(0, 90)}\n    text: ${text}`);
  } catch (e) {
    console.log(`ERR ${url}: ${String(e.message).split("\n")[0].slice(0, 100)}`);
  }
  await page.close();
}
await browser.close();
