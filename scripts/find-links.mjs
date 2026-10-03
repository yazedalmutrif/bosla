// List links on a page whose text or URL looks like careers/jobs. Usage: node scripts/find-links.mjs <url>
import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome" });
const p = await b.newPage();
await p.goto(process.argv[2], { waitUntil: "domcontentloaded", timeout: 30_000 });
await p.waitForTimeout(2500);
const links = await p.$$eval("a", (as) => as.map((a) => [a.textContent.trim().slice(0, 30), a.href]));
console.log(JSON.stringify(links.filter(([t, h]) => /join|career|job|وظائف|انضم|توظيف/i.test(t + h)).slice(0, 12), null, 1));
await b.close();
