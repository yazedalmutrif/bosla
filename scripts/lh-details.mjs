// Print the network requests and key timings from a saved Lighthouse report.
import { readFileSync } from "node:fs";
const r = JSON.parse(readFileSync(process.argv[2] ?? "lighthouse/mobile.json", "utf8"));
const a = r.audits;
console.log("FCP", a["first-contentful-paint"].displayValue, "| LCP", a["largest-contentful-paint"].displayValue, "| SI", a["speed-index"].displayValue);
for (const i of a["network-requests"].details.items) {
  console.log(
    `${i.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 70).padEnd(70)} ${String(Math.round(i.transferSize / 1024)).padStart(5)}KB xfer ${String(Math.round(i.resourceSize / 1024)).padStart(5)}KB raw ${i.priority ?? ""} ${Math.round(i.networkEndTime)}ms`,
  );
}
const lcpEl = a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet;
if (lcpEl) console.log("LCP element:", lcpEl.slice(0, 160));
