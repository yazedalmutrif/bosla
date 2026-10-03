// Check every link in data/dataset.json (companies, programmes, platforms).
// 1) plain GET with a browser user agent; 2) if blocked or timed out, load it in the installed Chrome.
// A page counts as live only if it loads (2xx/3xx) and doesn't look like an error page.
// Usage: node scripts/check-links.mjs [--only-unverified] [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const FILE = new URL("../data/dataset.json", import.meta.url);
const ds = JSON.parse(readFileSync(FILE, "utf8"));
const onlyUnverified = process.argv.includes("--only-unverified");
const write = process.argv.includes("--write");
const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Riyadh date
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const ERROR_TITLE = /(404|not found|page not found|error|غير موجود|access denied|forbidden|just a moment|attention required)/i;

const entries = [
  ...ds.companies.map((c) => ({ kind: "company", item: c, url: c.careersUrl })),
  ...ds.programs.map((p) => ({ kind: "program", item: p, url: p.url })),
  ...ds.platforms.map((p) => ({ kind: "platform", item: p, url: p.url })),
].filter((e) => !onlyUnverified || e.item.linkCheck?.ok !== true);

async function plain(url) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA, accept: "text/html,*/*;q=0.8", "accept-language": "en,ar;q=0.9" }, signal: AbortSignal.timeout(15_000) });
    const body = r.ok ? (await r.text()).slice(0, 20_000) : "";
    const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    return { status: r.status, finalUrl: r.url, title };
  } catch (e) {
    return { status: null, error: e.name };
  }
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ userAgent: UA, locale: "en-US" });
async function inChrome(url) {
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(2500);
    const title = (await page.title()).trim();
    const text = ((await page.locator("body").innerText().catch(() => "")) || "").slice(0, 400).replace(/\s+/g, " ");
    return { status: resp?.status() ?? null, finalUrl: page.url(), title, text };
  } catch (e) {
    return { status: null, error: e.name + ": " + String(e.message).split("\n")[0].slice(0, 80) };
  } finally {
    await page.close();
  }
}

const results = [];
for (const e of entries) {
  let r = await plain(e.url);
  let via = "fetch";
  const good = (x) => x.status && x.status < 400 && !ERROR_TITLE.test(x.title ?? "");
  if (!good(r)) {
    const c = await inChrome(e.url);
    via = "chrome";
    r = { ...c, fetchStatus: r.status ?? r.error };
  }
  const ok = good(r) ? true : r.status === 403 || r.status === 999 || r.status === 429 ? null : false;
  results.push({ kind: e.kind, id: e.item.id, url: e.url, via, ok, status: r.status, finalUrl: r.finalUrl, title: r.title, fetchStatus: r.fetchStatus, error: r.error, text: r.text?.slice(0, 160) });
  console.log(`${ok === true ? "OK  " : ok === null ? "BLK " : "DEAD"} ${String(r.status ?? "-").padEnd(4)} ${via.padEnd(6)} ${e.kind.padEnd(8)} ${e.item.id.padEnd(28)} ${(r.title ?? r.error ?? "").slice(0, 60)}`);
  if (write) {
    const note = ok === true ? (via === "chrome" ? "Opened in Chrome (blocks plain scripted requests)." : "") : ok === null ? `Blocks automated checks (HTTP ${r.status}); open it in a browser.` : `Not reachable: ${r.error ?? "HTTP " + r.status} ${r.title ?? ""}`.trim();
    e.item.linkCheck = { checkedOn: today, ok, status: r.status ?? null, note };
  }
}
await browser.close();
writeFileSync(new URL("../lighthouse/link-report.json", import.meta.url), JSON.stringify(results, null, 2));
if (write) writeFileSync(FILE, JSON.stringify(ds, null, 2) + "\n", "utf8");
const count = (v) => results.filter((r) => r.ok === v).length;
console.log(`\nchecked ${results.length}: ok ${count(true)}, blocked ${count(null)}, dead ${count(false)}${write ? " (dataset updated)" : ""}`);
