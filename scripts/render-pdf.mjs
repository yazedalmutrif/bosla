// Render the first pages of a PDF to PNG with pdf.js inside the installed Chrome (for visual checks).
// Usage: node scripts/render-pdf.mjs <in.pdf> <out-prefix> [pages=1]
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const [inPdf, outPrefix, pagesArg = "1"] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const pdfjsPath = require.resolve("pdfjs-dist/build/pdf.min.mjs");
const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const b = await chromium.launch({ channel: "chrome" });
const page = await b.newPage({ viewport: { width: 1000, height: 1400 } });
await page.route("https://pdf.local/**", (r) => {
  const u = new URL(r.request().url());
  if (u.pathname === "/pdf.mjs") return r.fulfill({ body: readFileSync(pdfjsPath), contentType: "text/javascript" });
  if (u.pathname === "/worker.mjs") return r.fulfill({ body: readFileSync(workerPath), contentType: "text/javascript" });
  if (u.pathname === "/doc.pdf") return r.fulfill({ body: readFileSync(inPdf), contentType: "application/pdf" });
  return r.fulfill({ body: "<html><body style='margin:0;background:#888'></body></html>", contentType: "text/html" });
});
await page.goto("https://pdf.local/");
const n = await page.evaluate(async (count) => {
  const pdfjs = await import("https://pdf.local/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://pdf.local/worker.mjs";
  const doc = await pdfjs.getDocument({ url: "https://pdf.local/doc.pdf" }).promise;
  for (let i = 1; i <= Math.min(count, doc.numPages); i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1.6 });
    const c = document.createElement("canvas");
    c.width = vp.width;
    c.height = vp.height;
    c.id = `p${i}`;
    c.style.display = "block";
    document.body.appendChild(c);
    await p.render({ canvasContext: c.getContext("2d"), viewport: vp, canvas: c }).promise;
  }
  return Math.min(count, doc.numPages);
}, Number(pagesArg));
for (let i = 1; i <= n; i++) await page.locator(`#p${i}`).screenshot({ path: `${outPrefix}-p${i}.png` });
await b.close();
console.log(`rendered ${n} page(s)`);
